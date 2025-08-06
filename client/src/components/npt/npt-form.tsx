import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { System, Equipment, Department, ActionParty, InsertNptReport, Rig } from "@shared/schema";
import type { BillingSheetRow } from "@shared/billingTypes";
import QuarterHourField from "@/components/QuarterHourField";
import { isQuarter } from "@/lib/time";
import { NPT_STATUS } from "@shared/status";

// Schema for drafts - minimal validation with quarter-hour validation
const draftFormSchema = insertNptReportSchema.extend({
  date: z.string().min(1, "Date is required"),
  hours: z.number().refine(isQuarter, "Hours must be a multiple of 0.25 between 0 and 24"),
});

// Schema for submission - full validation with quarter-hour validation
const formSchema = insertNptReportSchema.extend({
  date: z.string().min(1, "Date is required"),
  hours: z.number().refine(isQuarter, "Hours must be a multiple of 0.25 between 0 and 24"),
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

type FormData = z.infer<typeof formSchema>;

export default function NptForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedNptType, setSelectedNptType] = useState<string>("");
  const [billingData, setBillingData] = useState<BillingSheetRow | null>(null);
  
  // Get edit parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  
  // Fetch existing report data if editing
  const { data: existingReport } = useQuery({
    queryKey: ['/api/npt-reports', editId],
    enabled: !!editId,
  });

  // Check for billing data in sessionStorage
  useEffect(() => {
    const storedBillingData = sessionStorage.getItem('billingData');
    if (storedBillingData) {
      try {
        const data = JSON.parse(storedBillingData) as BillingSheetRow;
        setBillingData(data);
        sessionStorage.removeItem('billingData'); // Clear after reading
        sessionStorage.removeItem('allBillingData'); // Also clear the all data
      } catch (error) {
        console.error('Error parsing billing data:', error);
      }
    }
  }, []);

  // Get default form values based on context
  const getDefaultValues = (): FormData => {
    // If editing an existing report, use its data
    if (existingReport) {
      return {
        rigId: existingReport.rigId,
        userId: existingReport.userId,
        date: existingReport.date ? new Date(existingReport.date).toISOString().split('T')[0] : "",
        hours: existingReport.hours || 0,
        nptType: existingReport.nptType || "",
        system: existingReport.system || "",
        parentEquipment: existingReport.parentEquipment || "",
        partEquipment: existingReport.partEquipment || "",
        contractualProcess: existingReport.contractualProcess || "",
        department: existingReport.department || "",
        immediateCause: existingReport.immediateCause || "",
        rootCause: existingReport.rootCause || "",
        correctiveAction: existingReport.correctiveAction || "",
        futureAction: existingReport.futureAction || "",
        actionParty: existingReport.actionParty || "",
        notificationNumber: existingReport.notificationNumber || "",
        investigationReport: existingReport.investigationReport || "",
        wellName: existingReport.wellName || "",
        status: existingReport.status || "Draft",
      };
    }
    
    // Otherwise, use default values with billing data if available
    const baseValues = {
      rigId: user?.rigId || (billingData?.rigNumber ? parseInt(billingData.rigNumber) : null),
      userId: user?.id || "",
      date: billingData?.date ? new Date(billingData.date).toISOString().split('T')[0] : "",
      hours: billingData?.hours || 0,
      nptType: billingData?.nbtType || "",
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

    // Pre-populate fields based on NPT type and billing data
    if (billingData) {
      if (billingData.nbtType === 'Contractual') {
        baseValues.contractualProcess = billingData.description || "";
        // If system is extracted (for contractual categories)
        if (billingData.extractedSystem) {
          baseValues.system = billingData.extractedSystem;
        }
      } else if (billingData.nbtType === 'Abraj') {
        // For Abraj, populate fields from extracted data
        if (billingData.extractedSystem) {
          baseValues.system = billingData.extractedSystem;
        }
        if (billingData.extractedEquipment) {
          baseValues.parentEquipment = billingData.extractedEquipment;
        }
        // The form will need manual input for other fields
      }
    }

    return baseValues;
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
  });

  // Update form when billing data is loaded
  useEffect(() => {
    if (billingData) {
      const values = getDefaultValues();
      Object.keys(values).forEach((key) => {
        form.setValue(key as any, values[key as keyof typeof values]);
      });
      setSelectedNptType(billingData.nbtType || "");
    }
  }, [billingData]);
  
  // Update form when existing report data is loaded
  useEffect(() => {
    if (existingReport) {
      const values = getDefaultValues();
      Object.keys(values).forEach((key) => {
        form.setValue(key as any, values[key as keyof typeof values]);
      });
      setSelectedNptType(existingReport.nptType || "");
    }
  }, [existingReport]);

  // Fetch reference data
  const { data: rigs = [] } = useQuery<Rig[]>({
    queryKey: ['/api/rigs'],
  });
  
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

  const createReportMutation = useMutation({
    mutationFn: async (data: FormData & { status?: string }) => {
      if (editId) {
        // Update existing report
        await apiRequest('PUT', `/api/npt-reports/${editId}`, {
          ...data,
          date: new Date(data.date).toISOString(),
          status: data.status || "Draft",
        });
      } else {
        // Create new report
        await apiRequest('POST', '/api/npt-reports', {
          ...data,
          date: new Date(data.date).toISOString(),
          status: data.status || "Draft",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: editId ? "NPT report updated successfully" : "NPT report created successfully",
      });
      if (!editId) {
        form.reset();
        setSelectedNptType("");
      }
    },
    onError: (error: any) => {
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
      
      console.error("NPT Report creation error:", error);
      console.log("Full error object:", JSON.stringify(error, null, 2));
      
      let errorMessage = "Failed to create NPT report";
      
      // Try to parse detailed error information
      if (error.message) {
        try {
          // Check if error message contains JSON
          if (error.message.includes('{')) {
            const jsonStart = error.message.indexOf('{');
            const jsonStr = error.message.substring(jsonStart);
            const errorData = JSON.parse(jsonStr);
            
            if (errorData.errors && Array.isArray(errorData.errors)) {
              // Format validation errors
              const errorList = errorData.errors.map((err: any) => {
                if (err.path && err.message) {
                  return `${err.path.join('.')}: ${err.message}`;
                }
                return err.message || err;
              });
              errorMessage = `Validation errors:\n${errorList.join('\n')}`;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } else {
            errorMessage = error.message;
          }
        } catch (parseError) {
          // If parsing fails, use the original error message
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (editId) {
        // Update existing report
        await apiRequest('PUT', `/api/npt-reports/${editId}`, {
          ...data,
          date: new Date(data.date).toISOString(),
          status: NPT_STATUS.PENDING_REVIEW,
        });
      } else {
        // Create new report
        await apiRequest('POST', '/api/npt-reports', {
          ...data,
          date: new Date(data.date).toISOString(),
          status: NPT_STATUS.PENDING_REVIEW,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: editId ? "NPT report updated and submitted for review" : "NPT report submitted for review",
      });
      if (!editId) {
        form.reset();
        setSelectedNptType("");
      }
    },
    onError: (error: any) => {
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
      
      console.error("NPT Report submission error:", error);
      
      let errorMessage = "Failed to submit NPT report for review";
      
      if (error.message) {
        try {
          if (error.message.includes('{')) {
            const jsonStart = error.message.indexOf('{');
            const jsonStr = error.message.substring(jsonStart);
            const errorData = JSON.parse(jsonStr);
            
            if (errorData.errors && Array.isArray(errorData.errors)) {
              const errorList = errorData.errors.map((err: any) => {
                if (err.path && err.message) {
                  return `${err.path.join('.')}: ${err.message}`;
                }
                return err.message || err;
              });
              errorMessage = `Validation errors:\n${errorList.join('\n')}`;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } else {
            errorMessage = error.message;
          }
        } catch (parseError) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Watch for NPT type changes
  const watchedNptType = form.watch("nptType");
  useEffect(() => {
    setSelectedNptType(watchedNptType);
  }, [watchedNptType]);

  const onSaveDraft = () => {
    // Get current form values without any validation
    const formValues = form.getValues();
    
    // Save as draft with whatever values are present (can be empty)
    createReportMutation.mutate({ ...formValues, status: "Draft" });
  };

  const onSubmitForReview = (data: FormData) => {
    submitForReviewMutation.mutate({ ...data, status: "Pending Review" });
  };

  // Calculate auto-filled fields
  const selectedDate = form.watch("date");
  const year = selectedDate ? new Date(selectedDate).getFullYear() : "";
  const month = selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { month: 'short' }) : "";

  return (
    <Card>
      <CardContent className="p-2">
        <Form {...form}>
          <form className="space-y-4">
            {/* Excel Format Header */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <h3 className="text-sm font-semibold text-green-800 mb-1">Excel Format NPT Data Entry</h3>
              <p className="text-xs text-green-700">19-column format matching Excel structure - enter data cell by cell</p>
            </div>

            {/* Billing Data Alert */}
            {billingData && (
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This form has been pre-populated with data extracted from the billing sheet. 
                  Please review and complete any missing fields before saving.
                </AlertDescription>
              </Alert>
            )}

            {/* Excel-style Table Headers */}
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              {/* Column Headers - Exactly 19 columns */}
              <div className="bg-gray-100 border-b border-gray-300">
                <div className="grid grid-cols-19 gap-0 text-xs font-medium text-gray-700">
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

              {/* Data Row - Excel-style input cells */}
              <div className="bg-white">
                <div className="grid grid-cols-19 gap-0 text-xs">
                  {/* A - Rig Number */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="rigId"
                      render={({ field }) => (
                        <FormControl>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            value={field.value?.toString() || ""}
                          >
                            <SelectTrigger className="h-8 text-xs border-0 rounded-none">
                              <SelectValue placeholder="Select Rig" />
                            </SelectTrigger>
                            <SelectContent>
                              {rigs.map((rig) => (
                                <SelectItem key={rig.id} value={rig.id.toString()}>
                                  Rig {rig.rigNumber}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* B - Year (Auto-calculated) */}
                  <div className="p-1 border-r border-gray-200">
                    <Input 
                      value={year}
                      disabled 
                      className="bg-gray-50 text-gray-600 h-8 text-xs border-0 rounded-none text-center"
                      data-testid="input-year"
                    />
                  </div>

                  {/* C - Month (Auto-calculated) */}
                  <div className="p-1 border-r border-gray-200">
                    <Input 
                      value={month}
                      disabled 
                      className="bg-gray-50 text-gray-600 h-8 text-xs border-0 rounded-none text-center"
                      data-testid="input-month"
                    />
                  </div>

                  {/* D - Date */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            className="h-8 text-xs border-0 rounded-none"
                            data-testid="input-date"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* E - Hours */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="hours"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.25" 
                            min="0" 
                            max="24"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? 0 : value);
                            }}
                            onBlur={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              // Snap to quarter hour
                              const snapped = Math.round(value * 4) / 4;
                              const clamped = Math.max(0, Math.min(24, snapped));
                              field.onChange(clamped);
                            }}
                            className="h-8 text-xs border-0 rounded-none text-center"
                            placeholder="0.25"
                            data-testid="input-hours-quarter"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* F - NPT Type */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="nptType"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-npt-type">
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
                      name="system"
                      render={({ field }) => (
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''} 
                          disabled={selectedNptType !== 'Abraj'}
                          data-testid="select-system"
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
                      name="parentEquipment"
                      render={({ field }) => (
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''} 
                          disabled={selectedNptType !== 'Abraj'}
                          data-testid="select-parent-equipment"
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
                      name="partEquipment"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="Part"
                            {...field}
                            value={field.value || ''}
                            disabled={selectedNptType !== 'Abraj'}
                            className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                            data-testid="input-part-equipment"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* J - Contractual */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="contractualProcess"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="Process"
                            {...field}
                            value={field.value || ''}
                            disabled={selectedNptType !== 'Contractual'}
                            className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Contractual' ? 'bg-gray-100 opacity-50' : ''}`}
                            data-testid="input-contractual-process"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* K - Department */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''} 
                          disabled={selectedNptType !== 'Abraj'}
                          data-testid="select-department"
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
                      name="immediateCause"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="Description"
                            {...field}
                            value={field.value || ''}
                            disabled={selectedNptType !== 'Abraj'}
                            className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                            data-testid="input-immediate-cause"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* M - Root Cause */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="rootCause"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="Root Cause"
                            {...field}
                            value={field.value || ''}
                            disabled={selectedNptType !== 'Abraj'}
                            className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                            data-testid="input-root-cause"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* N - Corrective Action */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="correctiveAction"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="Corrective"
                            {...field}
                            value={field.value || ''}
                            disabled={selectedNptType !== 'Abraj'}
                            className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                            data-testid="input-corrective-action"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* O - Future Action */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="futureAction"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="Future Action"
                            {...field}
                            value={field.value || ''}
                            disabled={selectedNptType !== 'Abraj'}
                            className={`h-8 text-xs border-0 rounded-none ${selectedNptType !== 'Abraj' ? 'bg-gray-100 opacity-50' : ''}`}
                            data-testid="input-future-action"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* P - Action Party */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="actionParty"
                      render={({ field }) => (
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''} 
                          disabled={selectedNptType !== 'Abraj'}
                          data-testid="select-action-party"
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
                      name="notificationNumber"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="N2"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs border-0 rounded-none text-center"
                            data-testid="input-notification-number"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* R - Investigation Report */}
                  <div className="p-1 border-r border-gray-200">
                    <FormField
                      control={form.control}
                      name="investigationReport"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="Report"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs border-0 rounded-none"
                            data-testid="input-investigation-report"
                          />
                        </FormControl>
                      )}
                    />
                  </div>

                  {/* S - Well Name */}
                  <div className="p-1">
                    <FormField
                      control={form.control}
                      name="wellName"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            placeholder="Well"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs border-0 rounded-none"
                            data-testid="input-well-name"
                          />
                        </FormControl>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline"
                onClick={onSaveDraft}
                disabled={createReportMutation.isPending}
                data-testid="button-save-draft"
              >
                {createReportMutation.isPending ? "Saving..." : "Save as Draft"}
              </Button>
              <Button 
                type="button"
                onClick={form.handleSubmit(onSubmitForReview)}
                disabled={submitForReviewMutation.isPending}
                data-testid="button-submit-review"
              >
                {submitForReviewMutation.isPending ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
