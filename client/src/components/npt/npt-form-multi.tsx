import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
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
        ...row,
        nbtType: row.nptType,
        date: new Date(row.date),
        description: row.contractualProcess || row.immediateCause || '',
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

  const handleSubmit = (data: FormData) => {
    createReportsMutation.mutate(data);
  };

  const removeRow = (index: number) => {
    setRemovedRows([...removedRows, index]);
  };

  const rows = form.watch("rows");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review and Edit NPT Reports from Billing Data</CardTitle>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Review the extracted data below. You can edit any field before creating the NPT reports.
            Click the trash icon to exclude a row from being created.
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">A<br/>Rig</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">B<br/>Year</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">C<br/>Month</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">D<br/>Date</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">E<br/>Hours</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">F<br/>NPT Type</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">G<br/>System</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">H<br/>Equipment</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">I<br/>Part</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">J<br/>Contractual</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">K<br/>Department</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">L<br/>Failure Desc.</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">M<br/>Root Cause</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">N<br/>Corrective</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">O<br/>Future Action</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">P<br/>Action Party</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">Q<br/>N2 Number</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">R<br/>Investigation</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500">S<br/>Well Name</th>
                    <th className="px-2 py-2 text-xs font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row, index) => {
                    if (removedRows.includes(index)) return null;
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        {/* Rig Number (A) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.rigNumber`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-16 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Year (B) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.year`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-16 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Month (C) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.month`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-16 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Date (D) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.date`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} type="date" className="w-28 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Hours (E) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.hours`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-16 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* NPT Type (F) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.nptType`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="w-24 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Abroad">Abroad</SelectItem>
                                    <SelectItem value="Contractual">Contractual</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* System (G) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.system`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger className="w-28 h-8 text-xs">
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
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.equipment`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger className="w-28 h-8 text-xs">
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
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.partEquipment`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-20 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Contractual Process (J) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.contractualProcess`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-32 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Department (K) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.department`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger className="w-24 h-8 text-xs">
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
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.immediateCause`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-32 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Root Cause (M) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.rootCause`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-24 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Corrective Action (N) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.correctiveAction`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-24 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Future Action (O) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.futureAction`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-24 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Action Party (P) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.actionParty`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger className="w-28 h-8 text-xs">
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
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.notificationNumber`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-20 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Investigation (R) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.investigationWellName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-20 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Well Name (S) */}
                        <td className="px-1 py-1">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.wellName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="w-20 h-8 text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Remove button */}
                        <td className="px-1 py-1">
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
              <Button type="button" variant="outline" onClick={() => setLocation('/file-upload')}>
                Cancel
              </Button>
              <Button type="submit" disabled={createReportsMutation.isPending}>
                {createReportsMutation.isPending ? "Creating..." : `Create ${rows.length - removedRows.length} NPT Reports`}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}