import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Trash2, Copy, Plus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { enabledFields, cleanupByType } from "@shared/nptRules";
import type { BillingSheetRow } from "@shared/billingTypes";
import { nanoid } from "nanoid";

type NptRow = {
  id: string;
  rigNumber: string;
  date: string;
  year: string;
  month: string;
  hours: string;
  nptType: string;
  system: string;
  equipment: string;
  partEquipment: string;
  contractualProcess: string;
  immediateCause: string;
  rootCause: string;
  correctiveAction: string;
  futureAction: string;
  department: string;
  actionParty: string;
  wellName: string;
  notificationNumber: string;
  investigationWellName: string;
};

const nptRowSchema = z.object({
  id: z.string(),
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

const makeEmptyRow = (): NptRow => {
  const today = new Date();
  const row: NptRow = {
    id: nanoid(),
    rigNumber: "",
    year: today.getFullYear().toString(),
    month: today.toLocaleString("en", { month: "short" }),
    date: "",
    hours: "0",
    nptType: "Contractual",
    system: "",
    equipment: "",
    partEquipment: "",
    contractualProcess: "",
    immediateCause: "",
    rootCause: "",
    correctiveAction: "",
    futureAction: "",
    department: "",
    actionParty: "",
    wellName: "",
    notificationNumber: "",
    investigationWellName: "",
  };
  return cleanupByType(row); // enforce locks on creation
};

interface NptFormMultiProps {
  billingData?: BillingSheetRow[];
}

export default function NptFormMulti({ billingData }: NptFormMultiProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmittingForReview, setIsSubmittingForReview] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  // Initialize rows with billing data or empty row
  const initialRows: NptRow[] = billingData?.map(row => ({
    id: nanoid(),
    rigNumber: row.rigNumber || '',
    date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
    year: row.year || '',
    month: row.month || '',
    hours: row.hours?.toString() || '',
    nptType: row.nbtType || '',
    system: row.extractedSystem || row.system || '',
    equipment: row.extractedEquipment || '',
    partEquipment: row.extractedFailure || '',
    contractualProcess: row.nbtType === 'Contractual' ? row.description || '' : '',
    immediateCause: row.nbtType === 'Abraj' ? row.description || '' : '',
    rootCause: '',
    correctiveAction: '',
    futureAction: '',
    department: '',
    actionParty: '',
    wellName: '',
    notificationNumber: '',
    investigationWellName: '',
  })) || [makeEmptyRow()];

  const [rows, setRows] = useState<NptRow[]>(initialRows);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rows: initialRows,
    },
  });

  // Update form when rows change
  useEffect(() => {
    form.setValue('rows', rows);
  }, [rows, form]);

  // Row management functions
  const toggleRowSelect = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const addRow = (afterIndex?: number) => {
    const newRow = makeEmptyRow();
    setRows(prev => {
      const copy = [...prev];
      if (afterIndex == null) copy.push(newRow);
      else copy.splice(afterIndex + 1, 0, newRow);
      return copy;
    });
  };

  const duplicateRow = (index: number) => {
    setRows(prev => {
      const copy = [...prev];
      const base = copy[index];
      const dupe: NptRow = cleanupByType({ ...base, id: nanoid() });
      copy.splice(index + 1, 0, dupe);
      return copy;
    });
  };

  const duplicateSelected = () => {
    if (!selected.size) return;
    setRows(prev => {
      const copy = [...prev];
      // insert duplicates right after each selected row (keep order stable)
      for (let i = copy.length - 1; i >= 0; i--) {
        if (selected.has(copy[i].id)) {
          const dupe = cleanupByType({ ...copy[i], id: nanoid() });
          copy.splice(i + 1, 0, dupe);
        }
      }
      return copy;
    });
    setSelected(new Set()); // clear selection after duplication
  };

  const removeRow = (index: number) => {
    const rowId = rows[index].id;
    setRows(prev => prev.filter((_, i) => i !== index));
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  };

  // Update row field and apply cleanup when NPT type changes
  const updateRowField = (index: number, field: keyof NptRow, value: any) => {
    setRows(prev => {
      const copy = [...prev];
      const updated = { ...copy[index], [field]: value };
      // Apply cleanup when NPT type changes
      if (field === 'nptType') {
        copy[index] = cleanupByType(updated);
      } else {
        copy[index] = updated;
      }
      return copy;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        // duplicate the last selected row
        const last = [...selected].pop();
        if (!last) return;
        const idx = rows.findIndex(r => r.id === last);
        if (idx >= 0) duplicateRow(idx);
      }
      if (e.altKey && e.key === "Insert") {
        e.preventDefault();
        addRow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selected]);

  const createReportsMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Convert rows to billing sheet row format for API
      const billingRows = data.rows.map(row => ({
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

            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRow()}
                data-testid="button-add-row"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add row
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={duplicateSelected}
                disabled={selected.size === 0}
                data-testid="button-duplicate-selected"
                className="flex items-center gap-2"
                title="Duplicate selected rows"
              >
                <Copy className="h-4 w-4" />
                Duplicate selected ({selected.size})
              </Button>
              {selected.size > 0 && (
                <span className="text-xs text-gray-600">
                  {selected.size} row{selected.size > 1 ? 's' : ''} selected
                </span>
              )}
            </div>

            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  {/* Column Headers - with selection and actions columns */}
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="p-2 border-r border-gray-300 text-center text-xs font-medium text-gray-700 w-8">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every(row => selected.has(row.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelected(new Set(rows.map(row => row.id)));
                          } else {
                            setSelected(new Set());
                          }
                        }}
                        data-testid="checkbox-select-all"
                        title="Select all rows"
                      />
                    </th>
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
                    <th className="p-2 text-center text-xs font-medium text-gray-700 w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    // Calculate enabled fields for this row based on NPT type
                    const enabledFieldsState = enabledFields({ nptType: row.nptType });
                    
                    return (
                      <tr key={row.id} className="bg-white border-b border-gray-200">
                        {/* Selection checkbox */}
                        <td className="p-1 border-r border-gray-200">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={(e) => toggleRowSelect(row.id, e.target.checked)}
                            data-testid={`checkbox-select-row-${index}`}
                            className="rounded border-gray-300"
                          />
                        </td>
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
                          <Select
                            value={row.nptType}
                            onValueChange={(value) => updateRowField(index, 'nptType', value)}
                          >
                            <SelectTrigger className="h-8 text-xs border-0 rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Abraj">Abraj</SelectItem>
                              <SelectItem value="Contractual">Contractual</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* System (G) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.system`}
                            render={({ field }) => (
                              <FormItem>
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || undefined}
                                  disabled={!enabledFieldsState.system}
                                >
                                  <FormControl>
                                    <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.system ? 'bg-gray-100 opacity-50' : ''}`}>
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
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || undefined}
                                  disabled={!enabledFieldsState.equipment}
                                >
                                  <FormControl>
                                    <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.equipment ? 'bg-gray-100 opacity-50' : ''}`}>
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
                                  <Input 
                                    {...field} 
                                    disabled={!enabledFieldsState.thePart}
                                    className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.thePart ? 'bg-gray-100 opacity-50' : ''}`} 
                                  />
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
                                  <Input 
                                    {...field} 
                                    disabled={!enabledFieldsState.contractualProcess}
                                    className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.contractualProcess ? 'bg-gray-100 opacity-50' : ''}`} 
                                  />
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
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || undefined}
                                  disabled={!enabledFieldsState.department}
                                >
                                  <FormControl>
                                    <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.department ? 'bg-gray-100 opacity-50' : ''}`}>
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
                                  <Input 
                                    {...field} 
                                    disabled={!enabledFieldsState.failureDesc}
                                    className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.failureDesc ? 'bg-gray-100 opacity-50' : ''}`} 
                                  />
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
                                  <Input 
                                    {...field} 
                                    disabled={!enabledFieldsState.rootCause}
                                    className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.rootCause ? 'bg-gray-100 opacity-50' : ''}`} 
                                  />
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
                                  <Input 
                                    {...field} 
                                    disabled={!enabledFieldsState.corrective}
                                    className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.corrective ? 'bg-gray-100 opacity-50' : ''}`} 
                                  />
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
                                  <Input 
                                    {...field} 
                                    disabled={!enabledFieldsState.futureAction}
                                    className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.futureAction ? 'bg-gray-100 opacity-50' : ''}`} 
                                  />
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
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || undefined}
                                  disabled={!enabledFieldsState.actionParty}
                                >
                                  <FormControl>
                                    <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.actionParty ? 'bg-gray-100 opacity-50' : ''}`}>
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

                        {/* Actions: Duplicate and Remove */}
                        <td className="p-1">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicateRow(index)}
                              className="h-6 w-6 p-0"
                              title="Duplicate row"
                              data-testid={`button-duplicate-row-${index}`}
                            >
                              <Copy className="h-3 w-3 text-blue-500" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(index)}
                              className="h-6 w-6 p-0"
                              title="Remove row"
                              data-testid={`button-remove-row-${index}`}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
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