import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { insertNptReportSchema } from "@shared/schema";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Plus, Copy, Trash2 } from "lucide-react";
import type { System, Equipment, Department, ActionParty } from "@shared/schema";
import type { BillingSheetRow } from "@shared/billingTypes";

const singleReportSchema = insertNptReportSchema.extend({
  date: z.string().min(1, "Date is required"),
  hours: z.number().min(0.1, "Hours must be greater than 0").max(24, "Hours cannot exceed 24"),
}).refine((data) => {
  // Conditional validation based on NPT type
  if (data.nptType === 'Contractual') {
    return !!data.contractualProcess && data.contractualProcess.trim().length > 0;
  } else if (data.nptType === 'Abraj') {
    return !!data.system && 
           !!data.parentEquipment && 
           !!data.partEquipment && data.partEquipment.trim().length > 0 &&
           !!data.department &&
           !!data.immediateCause && data.immediateCause.trim().length > 0 &&
           !!data.rootCause && data.rootCause.trim().length > 0 &&
           !!data.correctiveAction && data.correctiveAction.trim().length > 0 &&
           !!data.futureAction && data.futureAction.trim().length > 0 &&
           !!data.actionParty;
  }
  return true;
}, {
  message: "Please fill in all required fields based on NPT type",
  path: ["nptType"]
});

const formSchema = z.object({
  reports: z.array(singleReportSchema)
});

type FormData = z.infer<typeof formSchema>;

export default function NptFormMulti() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [billingData, setBillingData] = useState<BillingSheetRow | null>(null);

  // Get current date info
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'short' });

  useEffect(() => {
    const storedBillingData = sessionStorage.getItem('billingData');
    if (storedBillingData) {
      try {
        const data = JSON.parse(storedBillingData) as BillingSheetRow;
        setBillingData(data);
        sessionStorage.removeItem('billingData');
        sessionStorage.removeItem('allBillingData');
      } catch (error) {
        console.error('Error parsing billing data:', error);
      }
    }
  }, []);

  // Create default row data
  const createDefaultRow = (date?: Date) => {
    const dateToUse = date || new Date();
    return {
      rigId: user?.rigId || 0,
      userId: user?.id || "",
      date: dateToUse.toISOString().split('T')[0],
      hours: 0,
      nptType: "",
      system: "",
      parentEquipment: "",
      partEquipment: "",
      contractualProcess: "",
      department: "",
      immediateCause: "",
      rootCause: "",
      correctiveAction: "",
      futureAction: "",
      actionParty: "",
      notificationNumber: "",
      investigationReport: "",
      wellName: "",
      status: "Draft",
    };
  };

  // Initialize form with default days of the month
  const initializeFormData = () => {
    const daysInMonth = new Date(currentYear, currentDate.getMonth() + 1, 0).getDate();
    const reports = [];
    
    // If we have billing data, use it for the first row
    if (billingData) {
      const baseValues = createDefaultRow(new Date(billingData.date));
      baseValues.hours = billingData.hours || 0;
      baseValues.nptType = billingData.nbtType || "";
      
      if (billingData.nbtType === 'Contractual') {
        baseValues.contractualProcess = billingData.description || "";
        if (billingData.extractedSystem) {
          baseValues.system = billingData.extractedSystem;
        }
      } else if (billingData.nbtType === 'Abraj') {
        if (billingData.extractedSystem) {
          baseValues.system = billingData.extractedSystem;
        }
        if (billingData.extractedEquipment) {
          baseValues.parentEquipment = billingData.extractedEquipment;
        }
      }
      reports.push(baseValues);
    } else {
      // Create a row for each day of the current month
      for (let day = 1; day <= Math.min(daysInMonth, 10); day++) { // Limit to 10 for performance
        const date = new Date(currentYear, currentDate.getMonth(), day);
        reports.push(createDefaultRow(date));
      }
    }
    
    return { reports };
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initializeFormData(),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "reports"
  });

  // Fetch reference data
  const { data: systems = [] } = useQuery<System[]>({
    queryKey: ['/api/systems'],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ['/api/equipment'],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });

  const { data: actionParties = [] } = useQuery<ActionParty[]>({
    queryKey: ['/api/action-parties'],
  });

  const createReportsMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Filter out empty reports
      const validReports = data.reports.filter(report => 
        report.nptType && report.hours > 0
      );
      
      if (validReports.length === 0) {
        throw new Error("No valid reports to submit");
      }

      // Create all reports
      const promises = validReports.map(report => 
        apiRequest('POST', '/api/npt-reports', {
          ...report,
          date: new Date(report.date).toISOString(),
        })
      );
      
      await Promise.all(promises);
      return validReports.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: `Created ${count} NPT report${count > 1 ? 's' : ''} successfully`,
      });
      form.reset(initializeFormData());
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to create NPT reports",
        variant: "destructive",
      });
    },
  });

  const handleAddRow = () => {
    append(createDefaultRow());
  };

  const handleDuplicateRow = (index: number) => {
    const rowToDuplicate = form.getValues(`reports.${index}`);
    append({ ...rowToDuplicate });
  };

  const handleRemoveRow = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    } else {
      toast({
        title: "Cannot remove",
        description: "At least one row is required",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: FormData) => {
    createReportsMutation.mutate(data);
  };

  return (
    <Card>
      <CardContent className="p-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Excel Format Header */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <h3 className="text-sm font-semibold text-green-800 mb-1">Excel Format NPT Data Entry - Multiple Rows</h3>
              <p className="text-xs text-green-700">Create multiple NPT reports at once. Fill only the rows you need.</p>
            </div>

            {/* Billing Data Alert */}
            {billingData && (
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  First row has been pre-populated with data from the billing sheet.
                </AlertDescription>
              </Alert>
            )}

            {/* Add Row Button */}
            <div className="flex justify-end mb-2">
              <Button
                type="button"
                onClick={handleAddRow}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
            </div>

            {/* Excel-style Table */}
            <div className="border border-gray-300 rounded-lg overflow-x-auto">
              {/* Column Headers */}
              <div className="bg-gray-100 border-b border-gray-300">
                <div className="min-w-[2000px] grid grid-cols-[auto,repeat(19,minmax(0,1fr))] gap-0 text-xs font-medium text-gray-700">
                  <div className="p-2 border-r border-gray-300 text-center w-24">Actions</div>
                  <div className="p-2 border-r border-gray-300 text-center">A<br/>Rig Number</div>
                  <div className="p-2 border-r border-gray-300 text-center">B<br/>Year</div>
                  <div className="p-2 border-r border-gray-300 text-center">C<br/>Month</div>
                  <div className="p-2 border-r border-gray-300 text-center">D<br/>Date</div>
                  <div className="p-2 border-r border-gray-300 text-center">E<br/>Hours</div>
                  <div className="p-2 border-r border-gray-300 text-center">F<br/>NPT Type</div>
                  <div className="p-2 border-r border-gray-300 text-center">G<br/>System</div>
                  <div className="p-2 border-r border-gray-300 text-center">H<br/>Equipment</div>
                  <div className="p-2 border-r border-gray-300 text-center">I<br/>The Part</div>
                  <div className="p-2 border-r border-gray-300 text-center">J<br/>Contractual</div>
                  <div className="p-2 border-r border-gray-300 text-center">K<br/>Department</div>
                  <div className="p-2 border-r border-gray-300 text-center">L<br/>Failure Desc.</div>
                  <div className="p-2 border-r border-gray-300 text-center">M<br/>Root Cause</div>
                  <div className="p-2 border-r border-gray-300 text-center">N<br/>Corrective</div>
                  <div className="p-2 border-r border-gray-300 text-center">O<br/>Future Action</div>
                  <div className="p-2 border-r border-gray-300 text-center">P<br/>Action Party</div>
                  <div className="p-2 border-r border-gray-300 text-center">Q<br/>N2 Number</div>
                  <div className="p-2 border-r border-gray-300 text-center">R<br/>Investigation</div>
                  <div className="p-2 text-center">S<br/>Well Name</div>
                </div>
              </div>

              {/* Data Rows */}
              <div className="bg-white">
                {fields.map((field, index) => {
                  const selectedDate = form.watch(`reports.${index}.date`);
                  const selectedNptType = form.watch(`reports.${index}.nptType`);
                  const year = selectedDate ? new Date(selectedDate).getFullYear() : "";
                  const month = selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { month: 'short' }) : "";

                  return (
                    <div key={field.id} className="min-w-[2000px] grid grid-cols-[auto,repeat(19,minmax(0,1fr))] gap-0 text-xs border-b border-gray-200">
                      {/* Action Buttons */}
                      <div className="p-1 border-r border-gray-200 flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          onClick={() => handleDuplicateRow(index)}
                          variant="ghost"
                          size="sm"
                          className="p-1 h-6 w-6"
                          title="Duplicate Row"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          variant="ghost"
                          size="sm"
                          className="p-1 h-6 w-6"
                          title="Remove Row"
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* A - Rig Number */}
                      <div className="p-1 border-r border-gray-200">
                        <Input 
                          value={user?.rigId || "Not Assigned"} 
                          disabled 
                          className="bg-gray-50 text-gray-600 h-8 text-xs border-0 rounded-none text-center"
                        />
                      </div>

                      {/* B - Year */}
                      <div className="p-1 border-r border-gray-200">
                        <Input 
                          value={year}
                          disabled 
                          className="bg-gray-50 text-gray-600 h-8 text-xs border-0 rounded-none text-center"
                        />
                      </div>

                      {/* C - Month */}
                      <div className="p-1 border-r border-gray-200">
                        <Input 
                          value={month}
                          disabled 
                          className="bg-gray-50 text-gray-600 h-8 text-xs border-0 rounded-none text-center"
                        />
                      </div>

                      {/* D - Date */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.date`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                type="date" 
                                {...field} 
                                className="h-8 text-xs border-0 rounded-none"
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* E - Hours */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.hours`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.1" 
                                min="0" 
                                max="24"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs border-0 rounded-none text-center"
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* F - NPT Type */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.nptType`}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs border-0 rounded-none">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Contractual">Contractual</SelectItem>
                                <SelectItem value="Abraj">Abraj</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      {/* G - System */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.system`}
                          render={({ field }) => (
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ''} 
                              disabled={selectedNptType !== 'Abraj'}
                            >
                              <FormControl>
                                <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {systems.map((system) => (
                                  <SelectItem key={system.id} value={system.name}>
                                    {system.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      {/* H - Equipment */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.parentEquipment`}
                          render={({ field }) => (
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ''} 
                              disabled={selectedNptType !== 'Abraj'}
                            >
                              <FormControl>
                                <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {equipment.map((equip) => (
                                  <SelectItem key={equip.id} value={equip.name}>
                                    {equip.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      {/* I - The Part */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.partEquipment`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="Part"
                                {...field}
                                value={field.value || ''}
                                disabled={selectedNptType !== 'Abraj'}
                                className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* J - Contractual */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.contractualProcess`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="Process"
                                {...field}
                                value={field.value || ''}
                                disabled={selectedNptType !== 'Contractual'}
                                className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Contractual' ? 'bg-gray-100 opacity-50' : ''}`}
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* K - Department */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.department`}
                          render={({ field }) => (
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ''} 
                              disabled={selectedNptType !== 'Abraj'}
                            >
                              <FormControl>
                                <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.name}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      {/* L - Failure Description */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.immediateCause`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="Description"
                                {...field}
                                value={field.value || ''}
                                disabled={selectedNptType !== 'Abraj'}
                                className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* M - Root Cause */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.rootCause`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="Root Cause"
                                {...field}
                                value={field.value || ''}
                                disabled={selectedNptType !== 'Abraj'}
                                className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* N - Corrective Action */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.correctiveAction`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="Corrective"
                                {...field}
                                value={field.value || ''}
                                disabled={selectedNptType !== 'Abraj'}
                                className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* O - Future Action */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.futureAction`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="Future Action"
                                {...field}
                                value={field.value || ''}
                                disabled={selectedNptType !== 'Abraj'}
                                className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* P - Action Party */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.actionParty`}
                          render={({ field }) => (
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ''} 
                              disabled={selectedNptType !== 'Abraj'}
                            >
                              <FormControl>
                                <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {actionParties.map((party) => (
                                  <SelectItem key={party.id} value={party.name}>
                                    {party.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      {/* Q - Notification Number */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.notificationNumber`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="N2"
                                {...field}
                                value={field.value || ''}
                                className="h-8 text-xs border-0 rounded-none text-center"
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* R - Investigation Report */}
                      <div className="p-1 border-r border-gray-200">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.investigationReport`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="Report"
                                {...field}
                                value={field.value || ''}
                                className="h-8 text-xs border-0 rounded-none"
                              />
                            </FormControl>
                          )}
                        />
                      </div>

                      {/* S - Well Name */}
                      <div className="p-1">
                        <FormField
                          control={form.control}
                          name={`reports.${index}.wellName`}
                          render={({ field }) => (
                            <FormControl>
                              <Input 
                                placeholder="Well"
                                {...field}
                                value={field.value || ''}
                                className="h-8 text-xs border-0 rounded-none"
                              />
                            </FormControl>
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
              <Button 
                type="submit"
                disabled={createReportsMutation.isPending}
                data-testid="button-submit-all"
              >
                {createReportsMutation.isPending ? "Creating Reports..." : "Create All NPT Reports"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}