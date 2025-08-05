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
import type { System, Equipment, Department, ActionParty, InsertNptReport } from "@shared/schema";

const formSchema = insertNptReportSchema.extend({
  date: z.string().min(1, "Date is required"),
  hours: z.number().min(0.1, "Hours must be greater than 0").max(24, "Hours cannot exceed 24"),
});

type FormData = z.infer<typeof formSchema>;

export default function NptForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedNptType, setSelectedNptType] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rigId: user?.rigId || 0,
      userId: user?.id || "",
      date: "",
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
    },
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

  const createReportMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await apiRequest('POST', '/api/npt-reports', {
        ...data,
        date: new Date(data.date).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: "NPT report created successfully",
      });
      form.reset();
      setSelectedNptType("");
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
      
      const errorMessage = error.message.includes('validation') 
        ? "Please check the form for errors" 
        : "Failed to create NPT report";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await apiRequest('POST', '/api/npt-reports', {
        ...data,
        date: new Date(data.date).toISOString(),
        status: "Pending Review",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: "NPT report submitted for review",
      });
      form.reset();
      setSelectedNptType("");
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
        description: "Failed to submit NPT report for review",
        variant: "destructive",
      });
    },
  });

  // Watch for NPT type changes
  const watchedNptType = form.watch("nptType");
  useEffect(() => {
    setSelectedNptType(watchedNptType);
  }, [watchedNptType]);

  const onSaveDraft = (data: FormData) => {
    createReportMutation.mutate({ ...data, status: "Draft" });
  };

  const onSubmitForReview = (data: FormData) => {
    submitForReviewMutation.mutate({ ...data, status: "Pending Review" });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Form {...form}>
          <form className="space-y-6">
            {/* Single Row Layout Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Unified Single-Row NPT Form</h3>
              <p className="text-sm text-blue-700">All input fields are displayed in a single row format with complete visibility - no hidden fields</p>
            </div>

            {/* Complete Single Row Form Layout - All Fields Always Visible */}
            <div className="space-y-4">
              {/* Row 1: Basic Information */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2">
                  <Label className="text-xs font-medium">Rig Number</Label>
                  <Input 
                    value={user?.rigId || "Not Assigned"} 
                    disabled 
                    className="bg-gray-50 text-gray-500 h-8 text-xs"
                    data-testid="input-rig-number"
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Date *</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            className="h-8 text-xs"
                            data-testid="input-date"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-1">
                  <FormField
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Hours *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            min="0" 
                            max="24"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs"
                            data-testid="input-hours"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="wellName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Well Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Well name"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-well-name"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="nptType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">NPT Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-npt-type">
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="NPT Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Contractual">Contractual</SelectItem>
                            <SelectItem value="Abraj">Abraj</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name="notificationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Notification (N2)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="N2 Number"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-notification-number"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Row 2: System and Equipment - Always Visible */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="system"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">System</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} data-testid="select-system">
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="System" />
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
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="parentEquipment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Equipment</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} data-testid="select-parent-equipment">
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Equipment" />
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
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="partEquipment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Part</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Part/Component"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-part-equipment"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Department</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} data-testid="select-department">
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Department" />
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
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="actionParty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Action Party</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} data-testid="select-action-party">
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Action Party" />
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
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="investigationReport"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Investigation</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Report details"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-investigation-report"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Row 3: Causes and Actions - Always Visible */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name="immediateCause"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Immediate Cause</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Immediate cause description"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-immediate-cause"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name="rootCause"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Root Cause</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Root cause analysis"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-root-cause"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name="correctiveAction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Corrective Action</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Corrective action taken"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-corrective-action"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name="futureAction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Future Action</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Future prevention actions"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-future-action"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Row 4: Contractual Process - Always Visible */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12">
                  <FormField
                    control={form.control}
                    name="contractualProcess"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Contractual Process / Additional Details</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Contractual process description or additional operational details"
                            {...field}
                            value={field.value || ''}
                            className="h-8 text-xs"
                            data-testid="input-contractual-process"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline"
                onClick={form.handleSubmit(onSaveDraft)}
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
