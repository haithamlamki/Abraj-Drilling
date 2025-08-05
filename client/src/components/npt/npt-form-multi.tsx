import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { BillingSheetRow } from "@shared/billingTypes";

const nptRowSchema = z.object({
  rigNumber: z.string(),
  date: z.string(),
  year: z.string(),
  month: z.string(),
  hours: z.string(),
  nptType: z.string(),
  system: z.string().optional(),
  equipment: z.string().optional(),
  partEquipment: z.string().optional(),
  contractualProcess: z.string().optional(),
  immediateCause: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  futureAction: z.string().optional(),
  department: z.string().optional(),
  actionParty: z.string().optional(),
  wellName: z.string().optional(),
  notificationNumber: z.string().optional(),
  investigationWellName: z.string().optional(),
});

const formSchema = z.object({
  rows: z.array(nptRowSchema),
});

type FormData = z.infer<typeof formSchema>;

interface NptFormMultiProps {
  billingData?: BillingSheetRow[];
}

export default function NptFormMulti({ billingData }: NptFormMultiProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [removedRows, setRemovedRows] = useState<number[]>([]);
  const [isSubmittingForReview, setIsSubmittingForReview] = useState(false);

  // Fetch reference data
  const { data: systems = [] } = useQuery<any[]>({
    queryKey: ['/api/systems'],
  });

  const { data: equipment = [] } = useQuery<any[]>({
    queryKey: ['/api/equipment'],
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['/api/departments'],
  });

  const { data: actionParties = [] } = useQuery<any[]>({
    queryKey: ['/api/action-parties'],
  });

  // Initialize form with billing data
  const defaultRows = billingData?.map(row => ({
    rigNumber: row.rigNumber || '',
    date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
    year: row.year || '',
    month: row.month || '',
    hours: row.hours || '',
    nptType: row.nbtType || '',
    system: row.extractedSystem || row.system || '',
    equipment: row.extractedEquipment || '',
    partEquipment: row.extractedFailure || '',
    contractualProcess: row.nbtType === 'Contractual' ? row.description : '',
    immediateCause: row.nbtType === 'Abroad' ? row.description : '',
    rootCause: '',
    correctiveAction: '',
    futureAction: '',
    department: '',
    actionParty: '',
    wellName: '',
    notificationNumber: '',
    investigationWellName: '',
  })) || [];

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rows: defaultRows,
    },
  });

  const createReportsMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Filter out removed rows
      const activeRows = data.rows.filter((_, index) => !removedRows.includes(index));
      
      // Convert to billing sheet row format for API
      const billingRows = activeRows.map(row => ({
        rigNumber: row.rigNumber,
        date: new Date(row.date),
        year: row.year,
        month: row.month,
        hours: parseFloat(row.hours.toString()),
        nbtType: row.nptType,
        description: row.contractualProcess || row.immediateCause || '',
        nptReportData: {
          rigId: row.rigNumber,
          date: row.date,
          year: row.year,
          month: row.month,
          hours: parseFloat(row.hours.toString()),
          nptType: row.nptType,
          system: row.system || null,
          parentEquipment: row.equipment || null,
          partEquipment: row.partEquipment || null,
          contractualProcess: row.contractualProcess || null,
          immediateCause: row.immediateCause || null,
          rootCause: row.rootCause || null,
          correctiveAction: row.correctiveAction || null,
          futureAction: row.futureAction || null,
          department: row.department || null,
          actionParty: row.actionParty || null,
          wellName: row.wellName || null,
          notificationNumber: row.notificationNumber || null,
          investigationWellName: row.investigationWellName || null,
          status: isSubmittingForReview ? 'Pending' : 'Draft',
        }
      }));

      const response = await apiRequest('POST', '/api/npt-reports/from-billing', { rows: billingRows });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "NPT reports created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      // Navigate to dashboard after successful creation
      setTimeout(() => {
        setLocation('/');
      }, 1500);
    },
    onError: (error) => {
      toast({
        title: "Error Creating Reports",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: FormData, submitForReview: boolean = false) => {
    console.log('handleSubmit called with:', { data, submitForReview });
    setIsSubmittingForReview(submitForReview);
    createReportsMutation.mutate(data);
  };

  const removeRow = (index: number) => {
    setRemovedRows([...removedRows, index]);
  };

  const rows = form.watch("rows");

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-gray-700">
            Review the extracted data below. You can edit any field before creating the NPT reports.
            Click the trash icon to exclude a row from being created.
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => handleSubmit(data, false))} className="space-y-6">
            {/* Excel Format Header - matching single form */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <h3 className="text-sm font-semibold text-green-800 mb-1">Excel Format NPT Data Entry</h3>
              <p className="text-xs text-green-700">19-column format matching Excel structure - enter data cell by cell</p>
            </div>

            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  {/* Column Headers - matching single form style */}
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Rig Number
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Year
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Month
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Date
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Hours
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      NPT Type
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      System
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Equipment
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      The Part
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Contractual
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Department
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Failure Desc.
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Root Cause
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Corrective
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Future Action
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Action Party
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      N2 Number
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Investigation
                    </th>
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700">
                      Well Name
                    </th>
                    <th className="p-2 text-center text-xs font-medium text-gray-700">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    if (removedRows.includes(index)) return null;
                    
                    return (
                      <tr key={index} className="bg-white border-b border-gray-200">
                        {/* Rig Number (A) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.rigNumber`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none text-center" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Year (B) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.year`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none text-center" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Month (C) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.month`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none text-center" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Date (D) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.date`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} type="date" className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Hours (E) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.hours`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none text-center" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* NPT Type (F) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.nptType`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs border-0 rounded-none">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Abraj">Abraj</SelectItem>
                                    <SelectItem value="Contractual">Contractual</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* System (G) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.system`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs border-0 rounded-none">
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {systems.map((sys) => (
                                      <SelectItem key={sys.id} value={sys.name}>
                                        {sys.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Equipment (H) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.equipment`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs border-0 rounded-none">
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {equipment.map((eq) => (
                                      <SelectItem key={eq.id} value={eq.name}>
                                        {eq.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Part (I) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.partEquipment`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Contractual Process (J) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.contractualProcess`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Department (K) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.department`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs border-0 rounded-none">
                                      <SelectValue placeholder="Select..." />
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
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Failure Description (L) - Immediate Cause */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.immediateCause`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Root Cause (M) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.rootCause`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Corrective Action (N) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.correctiveAction`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Future Action (O) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.futureAction`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Action Party (P) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.actionParty`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs border-0 rounded-none">
                                      <SelectValue placeholder="Select..." />
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
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* N2 Number (Q) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.notificationNumber`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Investigation (R) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.investigationWellName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Well Name (S) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.wellName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-0 rounded-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Remove button */}
                        <td className="p-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(index)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <Button 
                type="submit" 
                variant="outline"
                disabled={createReportsMutation.isPending}
                data-testid="button-save-draft"
              >
                Save as Draft
              </Button>
              <Button 
                type="button"
                onClick={() => form.handleSubmit((data) => handleSubmit(data, true))()}
                disabled={createReportsMutation.isPending}
                data-testid="button-submit-review"
              >
                Submit for Review
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}