import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Trash2, Copy, Plus, Undo, Redo, HelpCircle, ChevronDown } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { enabledFields, cleanupByType, needsN2, needsInvestigationReport, isContractual, isAbraj } from "@shared/nptRules";
import type { BillingSheetRow } from "@shared/billingTypes";
import { nanoid } from "nanoid";
import DateCellInput from "@/components/npt/DateCellInput";
import QuarterHoursInput from "@/components/npt/QuarterHoursInput";

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
  rigNumber: z.string().min(1, "Rig Number is required"),
  date: z.string().min(1, "Date is required"),
  year: z.string().min(1, "Year is required"),
  month: z.string().min(1, "Month is required"),
  hours: z.string().min(1, "Hours is required"),
  nptType: z.string().min(1, "NPT Type is required"),
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
}).superRefine((data, ctx) => {
  const hours = parseFloat(data.hours);
  const nptType = data.nptType;
  
  // NPT Type specific validations
  if (isContractual(nptType)) {
    if (!data.contractualProcess?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contractualProcess"],
        message: "Contractual Process is required for Contractual NPT type"
      });
    }
  }
  
  if (isAbraj(nptType)) {
    const requiredFields = [
      { field: "equipment", label: "Equipment" },
      { field: "partEquipment", label: "The Part" },
      { field: "immediateCause", label: "Failure Description" },
      { field: "rootCause", label: "Root Cause" },
      { field: "correctiveAction", label: "Corrective Action" },
      { field: "futureAction", label: "Future Action" },
      { field: "actionParty", label: "Action Party" },
      { field: "department", label: "Department" }
    ] as const;
    
    for (const { field, label } of requiredFields) {
      if (!data[field]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${label} is required for Abraj NPT type`
        });
      }
    }
  }
  
  // N2 Number validation
  if (needsN2(data.department, hours) && !data.notificationNumber?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["notificationNumber"],
      message: "N2 Number is required for this hours range and department"
    });
  }
  
  // Investigation Report validation
  if (needsInvestigationReport(hours) && !data.investigationWellName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["investigationWellName"],
      message: "Investigation report is required for ≥ 6.0 hours"
    });
  }
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

// Undo/Redo history management
interface HistoryState {
  rows: NptRow[];
  selected: Set<string>;
}

const MAX_HISTORY = 20;

export default function NptFormMulti({ billingData }: NptFormMultiProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmittingForReview, setIsSubmittingForReview] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // Undo/Redo state
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);

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
    saveToHistory();
    setRows(prev => {
      const copy = [...prev];
      if (afterIndex == null) copy.push(newRow);
      else copy.splice(afterIndex + 1, 0, newRow);
      return copy;
    });
  };

  const duplicateRow = (index: number) => {
    saveToHistory();
    setRows(prev => {
      const copy = [...prev];
      const base = copy[index];
      const dupe: NptRow = cleanupByType({ ...base, id: nanoid() });
      copy.splice(index + 1, 0, dupe);
      return copy;
    });
  };

  // Undo/Redo helpers
  const saveToHistory = () => {
    const newState: HistoryState = {
      rows: [...rows],
      selected: new Set(selected)
    };
    
    // Remove any states after current index
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    
    // Keep only last MAX_HISTORY states
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  const undo = () => {
    if (historyIndex < 0 || history.length === 0) return;
    
    // Save current state if we're at the end
    if (historyIndex === history.length - 1) {
      saveToHistory();
    }
    
    const prevIndex = Math.max(0, historyIndex - 1);
    const prevState = history[prevIndex];
    setRows(prevState.rows);
    setSelected(prevState.selected);
    setHistoryIndex(prevIndex);
  };
  
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    
    const nextIndex = historyIndex + 1;
    const nextState = history[nextIndex];
    setRows(nextState.rows);
    setSelected(nextState.selected);
    setHistoryIndex(nextIndex);
  };

  const duplicateSelected = () => {
    if (!selected.size) return;
    saveToHistory();
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

  const deleteSelected = () => {
    if (!selected.size) return;
    saveToHistory();
    setRows(prev => prev.filter(row => !selected.has(row.id)));
    setSelected(new Set()); // clear selection after deletion
  };
  
  // Fill-down functionality
  const fillDown = () => {
    if (selected.size < 2) return;
    
    saveToHistory();
    const selectedIds = Array.from(selected);
    const selectedIndices = selectedIds.map(id => rows.findIndex(r => r.id === id)).sort((a, b) => a - b);
    
    if (selectedIndices.length < 2) return;
    
    const sourceIndex = selectedIndices[0];
    const sourceRow = rows[sourceIndex];
    const enabled = enabledFields(sourceRow.nptType);
    
    setRows(prev => {
      const copy = [...prev];
      for (let i = 1; i < selectedIndices.length; i++) {
        const targetIndex = selectedIndices[i];
        const targetRow = copy[targetIndex];
        
        // Copy only enabled fields with non-empty values
        const updated = { ...targetRow };
        if (enabled.system && sourceRow.system) updated.system = sourceRow.system;
        if (enabled.equipment && sourceRow.equipment) updated.equipment = sourceRow.equipment;
        if (enabled.partEquipment && sourceRow.partEquipment) updated.partEquipment = sourceRow.partEquipment;
        if (enabled.contractualProcess && sourceRow.contractualProcess) updated.contractualProcess = sourceRow.contractualProcess;
        if (enabled.immediateCause && sourceRow.immediateCause) updated.immediateCause = sourceRow.immediateCause;
        if (enabled.rootCause && sourceRow.rootCause) updated.rootCause = sourceRow.rootCause;
        if (enabled.correctiveAction && sourceRow.correctiveAction) updated.correctiveAction = sourceRow.correctiveAction;
        if (enabled.futureAction && sourceRow.futureAction) updated.futureAction = sourceRow.futureAction;
        if (enabled.department && sourceRow.department) updated.department = sourceRow.department;
        if (enabled.actionParty && sourceRow.actionParty) updated.actionParty = sourceRow.actionParty;
        if (sourceRow.wellName) updated.wellName = sourceRow.wellName;
        if (sourceRow.notificationNumber) updated.notificationNumber = sourceRow.notificationNumber;
        if (sourceRow.investigationWellName) updated.investigationWellName = sourceRow.investigationWellName;
        
        copy[targetIndex] = updated;
      }
      return copy;
    });
    
    toast({
      title: "Fill Down Complete",
      description: `Filled ${selectedIndices.length - 1} rows from row ${sourceIndex + 1}`,
    });
  };

  const removeRow = (index: number) => {
    const rowId = rows[index].id;
    saveToHistory();
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
      // Ctrl/Cmd+D: Duplicate selected
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selected.size > 0) {
          duplicateSelected();
        } else {
          // If no selection, duplicate the last row
          if (rows.length > 0) duplicateRow(rows.length - 1);
        }
      }
      
      // Alt+Insert: Add row
      if (e.altKey && e.key === "Insert") {
        e.preventDefault();
        addRow();
      }
      
      // Ctrl/Cmd+Shift+F: Fill down
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        fillDown();
      }
      
      // Ctrl/Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y: Redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selected, history, historyIndex]);

  const createReportsMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Convert rows to billing sheet row format for API
      const billingRows = data.rows.map(row => ({
        rigNumber: row.rigNumber,
        date: row.date,
        year: row.year,
        month: row.month,
        hours: row.hours ? parseFloat(row.hours.toString()) : 0,
        nbtType: row.nptType,
        description: row.contractualProcess || row.immediateCause || '',
        nptReportData: {
          rigId: row.rigNumber,
          date: row.date,
          year: row.year,
          month: row.month,
          hours: row.hours ? parseFloat(row.hours.toString()) : 0,
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

      const mode = isSubmittingForReview ? 'review' : 'draft';
      const response = await apiRequest(`/api/npt-reports/from-billing?mode=${mode}`, {
        method: 'POST',
        body: JSON.stringify({ rows: billingRows }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response;
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
    
    // If submitting for review, validate all fields thoroughly
    if (submitForReview) {
      const validationResult = formSchema.safeParse(data);
      if (!validationResult.success) {
        // Show validation errors
        const errors = validationResult.error.flatten();
        const errorMessages = [];
        
        // Collect all field errors
        Object.entries(errors.fieldErrors).forEach(([field, messages]) => {
          if (messages && messages.length > 0) {
            errorMessages.push(`${field}: ${messages.join(', ')}`);
          }
        });
        
        // Collect form errors
        if (errors.formErrors.length > 0) {
          errorMessages.push(...errors.formErrors);
        }
        
        toast({
          title: "Validation Errors",
          description: `Please fix the following errors before submitting for review:\n${errorMessages.slice(0, 5).join('\n')}${errorMessages.length > 5 ? '\n...and more' : ''}`,
          variant: "destructive",
        });
        
        // Force form validation to show errors
        form.trigger();
        return;
      }
    } else {
      // Draft mode: no validation, just save as-is
      console.log('Saving as draft without validation');
    }
    
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
            <div className="flex items-center justify-between gap-3 mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRow()}
                  data-testid="button-add-row"
                  className="flex items-center gap-2"
                  title="Add row (Alt+Insert)"
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
                  title="Duplicate selected rows (Ctrl+D)"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate ({selected.size})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillDown}
                  disabled={selected.size < 2}
                  data-testid="button-fill-down"
                  className="flex items-center gap-2"
                  title="Fill down from first selected row (Ctrl+Shift+F)"
                >
                  <ChevronDown className="h-4 w-4" />
                  Fill Down
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={deleteSelected}
                  disabled={selected.size === 0}
                  data-testid="button-delete-selected"
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Delete selected rows"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selected.size})
                </Button>
                
                <div className="w-px h-6 bg-gray-300 mx-2" />
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  data-testid="button-undo"
                  className="flex items-center gap-1"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo className="h-4 w-4" />
                  Undo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  data-testid="button-redo"
                  className="flex items-center gap-1"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo className="h-4 w-4" />
                  Redo
                </Button>
              </div>
              
              <div className="flex items-center gap-3">
                {selected.size > 0 && (
                  <span className="text-xs text-gray-600">
                    {selected.size} row{selected.size > 1 ? 's' : ''} selected
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShortcuts(!showShortcuts)}
                  className="text-gray-600"
                  title="Show keyboard shortcuts"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Keyboard shortcuts help */}
            {showShortcuts && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div className="font-semibold mb-2">Keyboard Shortcuts:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="font-mono bg-white px-1 rounded">Alt+Insert</span> - Add new row</div>
                  <div><span className="font-mono bg-white px-1 rounded">Ctrl+D</span> - Duplicate selected</div>
                  <div><span className="font-mono bg-white px-1 rounded">Ctrl+Shift+F</span> - Fill down</div>
                  <div><span className="font-mono bg-white px-1 rounded">Delete</span> - Delete selected</div>
                  <div><span className="font-mono bg-white px-1 rounded">Ctrl+Z</span> - Undo</div>
                  <div><span className="font-mono bg-white px-1 rounded">Ctrl+Y</span> - Redo</div>
                </div>
              </div>
            )}

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
                    const enabledFieldsState = enabledFields(row.nptType);
                    
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
                          <DateCellInput
                            value={row.date}
                            onCommit={(iso) => {
                              saveToHistory();
                              const updated = [...rows];
                              updated[index] = { ...row, date: iso };
                              setRows(updated);
                            }}
                            className="h-8 text-xs border-0 rounded-none"
                          />
                        </td>

                        {/* Hours (E) */}
                        <td className="p-1 border-r border-gray-200">
                          <QuarterHoursInput
                            value={parseFloat(row.hours) || 0}
                            onCommit={(value) => {
                              saveToHistory();
                              const updated = [...rows];
                              updated[index] = { ...row, hours: value.toString() };
                              setRows(updated);
                            }}
                            className="h-8 text-xs border-0 rounded-none text-center"
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
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || undefined}
                                  disabled={!enabledFieldsState.equipment}
                                >
                                  <FormControl>
                                    <SelectTrigger className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.equipment ? 'bg-gray-100 opacity-50' : ''} ${fieldState.error ? 'border-red-500 bg-red-50' : ''}`}>
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
                                {fieldState.error && (
                                  <FormMessage className="text-xs text-red-600 mt-1" />
                                )}
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
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    disabled={!enabledFieldsState.contractualProcess}
                                    className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.contractualProcess ? 'bg-gray-100 opacity-50' : ''} ${fieldState.error ? 'border-red-500 bg-red-50' : ''}`} 
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <FormMessage className="text-xs text-red-600 mt-1" />
                                )}
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
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    disabled={!enabledFieldsState.failureDesc}
                                    className={`h-8 text-xs border-0 rounded-none ${!enabledFieldsState.failureDesc ? 'bg-gray-100 opacity-50' : ''} ${fieldState.error ? 'border-red-500 bg-red-50' : ''}`} 
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <FormMessage className="text-xs text-red-600 mt-1" />
                                )}
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
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    className={`h-8 text-xs border-0 rounded-none ${fieldState.error ? 'border-red-500 bg-red-50' : ''}`} 
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <FormMessage className="text-xs text-red-600 mt-1" />
                                )}
                              </FormItem>
                            )}
                          />
                        </td>

                        {/* Investigation (R) */}
                        <td className="p-1 border-r border-gray-200">
                          <FormField
                            control={form.control}
                            name={`rows.${index}.investigationWellName`}
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    className={`h-8 text-xs border-0 rounded-none ${fieldState.error ? 'border-red-500 bg-red-50' : ''}`} 
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <FormMessage className="text-xs text-red-600 mt-1" />
                                )}
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
                type="button"
                variant="outline"
                onClick={() => form.handleSubmit((data) => handleSubmit(data, false))()}
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