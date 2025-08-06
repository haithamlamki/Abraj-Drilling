import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, UserCog, ArrowRight, Settings } from "lucide-react";

interface WorkflowDefinition {
  id: number;
  name: string;
  rigId?: number;
  isActive: boolean;
  createdAt: string;
  steps?: WorkflowStep[];
}

interface WorkflowStep {
  id?: number;
  stepOrder: number;
  approverType: "role" | "user";
  roleKey?: string;
  userId?: string;
  isRequired: boolean;
}

interface RoleAssignment {
  id: number;
  rigId: number;
  roleKey: string;
  userId: string;
  isActive: boolean;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

interface Delegation {
  id: number;
  delegatorUserId: string;
  delegateUserId: string;
  startsAt: string;
  endsAt: string;
  rigId?: number;
  roleKey?: string;
  isActive: boolean;
  delegator?: { firstName?: string; lastName?: string; email?: string };
  delegate?: { firstName?: string; lastName?: string; email?: string };
  rig?: { rigNumber: number };
}

export default function WorkflowsAdmin() {
  const [selectedRig, setSelectedRig] = useState<number | null>(null);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [delegationDialogOpen, setDelegationDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rigs
  const { data: rigsData } = useQuery({
    queryKey: ["/api/rigs"],
  });

  // Fetch users
  const { data: usersData } = useQuery({
    queryKey: ["/api/users"],
  });

  // Fetch workflows
  const { data: workflowsData, isLoading: workflowsLoading } = useQuery({
    queryKey: ["/api/workflows", selectedRig],
    enabled: selectedRig !== null,
  });

  // Fetch role assignments
  const { data: roleAssignmentsData } = useQuery({
    queryKey: ["/api/role-assignments", selectedRig],
    enabled: selectedRig !== null,
  });

  // Fetch delegations
  const { data: delegationsData } = useQuery({
    queryKey: ["/api/delegations"],
  });

  const rigs = rigsData?.items || [];
  const users = usersData?.items || [];
  const workflows = workflowsData?.items || [];
  const roleAssignments = roleAssignmentsData?.items || [];
  const delegations = delegationsData?.items || [];
  const roleKeys = roleAssignmentsData?.roleKeys || [];
  const roleLabels = roleAssignmentsData?.roleLabels || {};

  // Mutations
  const createWorkflowMutation = useMutation({
    mutationFn: async (data: { name: string; rigId?: number }) => 
      apiRequest("/api/workflows", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setWorkflowDialogOpen(false);
      toast({ title: "Success", description: "Workflow created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to create workflow", variant: "destructive" });
    }
  });

  const updateWorkflowStepsMutation = useMutation({
    mutationFn: async ({ workflowId, steps }: { workflowId: number; steps: WorkflowStep[] }) =>
      apiRequest(`/api/workflows/${workflowId}/steps/bulk`, { method: "POST", body: { steps } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setEditingWorkflow(null);
      setWorkflowSteps([]);
      toast({ title: "Success", description: "Workflow steps updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update workflow steps", variant: "destructive" });
    }
  });

  const updateRoleAssignmentMutation = useMutation({
    mutationFn: async (data: { rigId: number; roleKey: string; userId: string }) =>
      apiRequest("/api/role-assignments", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-assignments"] });
      setRoleDialogOpen(false);
      toast({ title: "Success", description: "Role assignment updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update role assignment", variant: "destructive" });
    }
  });

  const createDelegationMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest("/api/delegations", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delegations"] });
      setDelegationDialogOpen(false);
      toast({ title: "Success", description: "Delegation created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to create delegation", variant: "destructive" });
    }
  });

  const deleteDelegationMutation = useMutation({
    mutationFn: async (delegationId: number) =>
      apiRequest(`/api/delegations/${delegationId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delegations"] });
      toast({ title: "Success", description: "Delegation deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete delegation", variant: "destructive" });
    }
  });

  const addWorkflowStep = () => {
    setWorkflowSteps(prev => [...prev, {
      stepOrder: prev.length + 1,
      approverType: "role",
      isRequired: true
    }]);
  };

  const removeWorkflowStep = (index: number) => {
    setWorkflowSteps(prev => prev.filter((_, i) => i !== index));
  };

  const updateWorkflowStep = (index: number, updates: Partial<WorkflowStep>) => {
    setWorkflowSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, ...updates } : step
    ));
  };

  const saveWorkflowSteps = () => {
    if (!editingWorkflow) return;
    
    const validatedSteps = workflowSteps.map((step, index) => ({
      ...step,
      stepOrder: index + 1
    }));

    updateWorkflowStepsMutation.mutate({
      workflowId: editingWorkflow.id,
      steps: validatedSteps
    });
  };

  useEffect(() => {
    if (editingWorkflow && editingWorkflow.steps) {
      setWorkflowSteps(editingWorkflow.steps);
    }
  }, [editingWorkflow]);

  return (
    <div className="space-y-6" data-testid="workflows-admin">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workflow Management</h1>
        <div className="flex gap-2">
          <Select value={selectedRig?.toString() || ""} onValueChange={(value) => setSelectedRig(Number(value))}>
            <SelectTrigger className="w-48" data-testid="select-rig">
              <SelectValue placeholder="Select a rig" />
            </SelectTrigger>
            <SelectContent>
              {rigs.map((rig: any) => (
                <SelectItem key={rig.id} value={rig.id.toString()}>
                  Rig {rig.rigNumber} - {rig.section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedRig && (
        <Tabs defaultValue="workflows" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="roles">Role Assignments</TabsTrigger>
            <TabsTrigger value="delegations">Delegations</TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Approval Workflows</h2>
              <Dialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-workflow">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Workflow</DialogTitle>
                    <DialogDescription>
                      Create a new approval workflow for this rig
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    createWorkflowMutation.mutate({
                      name: formData.get("name") as string,
                      rigId: selectedRig || undefined
                    });
                  }}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Workflow Name</Label>
                        <Input id="name" name="name" placeholder="e.g., Standard NPT Approval" required />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setWorkflowDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createWorkflowMutation.isPending}>
                          Create Workflow
                        </Button>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {workflows.map((workflow: WorkflowDefinition) => (
                <Card key={workflow.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">{workflow.name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge variant={workflow.isActive ? "default" : "secondary"}>
                        {workflow.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setEditingWorkflow(workflow);
                          setWorkflowSteps(workflow.steps || []);
                        }}
                        data-testid={`button-edit-workflow-${workflow.id}`}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Configure Steps
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      {(workflow.steps || []).map((step, index) => (
                        <div key={index} className="flex items-center">
                          <Badge variant="outline">
                            Step {step.stepOrder}: {step.approverType === "role" ? roleLabels[step.roleKey || ""] || step.roleKey : "User"}
                          </Badge>
                          {index < (workflow.steps || []).length - 1 && (
                            <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Workflow Steps Editor Dialog */}
            <Dialog open={!!editingWorkflow} onOpenChange={() => setEditingWorkflow(null)}>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Configure Workflow Steps</DialogTitle>
                  <DialogDescription>
                    Define the approval steps for "{editingWorkflow?.name}"
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Approval Steps</h3>
                    <Button onClick={addWorkflowStep} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Step
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {workflowSteps.map((step, index) => (
                      <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0 w-16">
                          <Label>Step {index + 1}</Label>
                        </div>
                        <div className="flex-1">
                          <Select 
                            value={step.approverType} 
                            onValueChange={(value: "role" | "user") => 
                              updateWorkflowStep(index, { approverType: value, roleKey: undefined, userId: undefined })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="role">Role-based</SelectItem>
                              <SelectItem value="user">Specific User</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          {step.approverType === "role" ? (
                            <Select 
                              value={step.roleKey || ""} 
                              onValueChange={(value) => updateWorkflowStep(index, { roleKey: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {roleKeys.map((roleKey: string) => (
                                  <SelectItem key={roleKey} value={roleKey}>
                                    {roleLabels[roleKey] || roleKey}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Select 
                              value={step.userId || ""} 
                              onValueChange={(value) => updateWorkflowStep(index, { userId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select user" />
                              </SelectTrigger>
                              <SelectContent>
                                {users.map((user: any) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.firstName} {user.lastName} ({user.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch 
                            checked={step.isRequired}
                            onCheckedChange={(checked) => updateWorkflowStep(index, { isRequired: checked })}
                          />
                          <Label>Required</Label>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeWorkflowStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setEditingWorkflow(null)}>
                      Cancel
                    </Button>
                    <Button onClick={saveWorkflowSteps} disabled={updateWorkflowStepsMutation.isPending}>
                      Save Steps
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Role Assignments</h2>
              <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-role-assignment">
                    <UserCog className="h-4 w-4 mr-2" />
                    Assign Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Role</DialogTitle>
                    <DialogDescription>
                      Assign a user to a role for this rig
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    updateRoleAssignmentMutation.mutate({
                      rigId: selectedRig!,
                      roleKey: formData.get("roleKey") as string,
                      userId: formData.get("userId") as string
                    });
                  }}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="roleKey">Role</Label>
                        <Select name="roleKey" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleKeys.map((roleKey: string) => (
                              <SelectItem key={roleKey} value={roleKey}>
                                {roleLabels[roleKey] || roleKey}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="userId">User</Label>
                        <Select name="userId" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user: any) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setRoleDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={updateRoleAssignmentMutation.isPending}>
                          Assign Role
                        </Button>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned User</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleKeys.map((roleKey: string) => {
                  const assignment = roleAssignments.find((ra: RoleAssignment) => ra.roleKey === roleKey);
                  return (
                    <TableRow key={roleKey}>
                      <TableCell className="font-medium">
                        {roleLabels[roleKey] || roleKey}
                      </TableCell>
                      <TableCell>
                        {assignment ? (
                          <div>
                            {assignment.user?.firstName} {assignment.user?.lastName}
                            <div className="text-sm text-muted-foreground">
                              {assignment.user?.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assignment?.isActive ? "default" : "secondary"}>
                          {assignment?.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="delegations" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Delegations</h2>
              <Dialog open={delegationDialogOpen} onOpenChange={setDelegationDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-delegation">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Delegation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Delegation</DialogTitle>
                    <DialogDescription>
                      Create a temporary delegation of authority
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    createDelegationMutation.mutate({
                      delegatorUserId: formData.get("delegatorUserId") as string,
                      delegateUserId: formData.get("delegateUserId") as string,
                      startsAt: new Date(formData.get("startsAt") as string).toISOString(),
                      endsAt: new Date(formData.get("endsAt") as string).toISOString(),
                      rigId: selectedRig,
                      roleKey: formData.get("roleKey") as string || null,
                      isActive: true
                    });
                  }}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="delegatorUserId">Delegator (From)</Label>
                        <Select name="delegatorUserId" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select delegator" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user: any) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="delegateUserId">Delegate (To)</Label>
                        <Select name="delegateUserId" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select delegate" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user: any) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="roleKey">Role (optional - leave blank for all roles)</Label>
                        <Select name="roleKey">
                          <SelectTrigger>
                            <SelectValue placeholder="All roles" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleKeys.map((roleKey: string) => (
                              <SelectItem key={roleKey} value={roleKey}>
                                {roleLabels[roleKey] || roleKey}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="startsAt">Start Date/Time</Label>
                          <Input 
                            id="startsAt" 
                            name="startsAt" 
                            type="datetime-local" 
                            required 
                            defaultValue={new Date().toISOString().slice(0, 16)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="endsAt">End Date/Time</Label>
                          <Input 
                            id="endsAt" 
                            name="endsAt" 
                            type="datetime-local" 
                            required 
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setDelegationDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createDelegationMutation.isPending}>
                          Create Delegation
                        </Button>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Rig</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegations.map((delegation: Delegation) => (
                  <TableRow key={delegation.id}>
                    <TableCell>
                      <div>
                        {delegation.delegator?.firstName} {delegation.delegator?.lastName}
                        <div className="text-sm text-muted-foreground">
                          {delegation.delegator?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {delegation.delegate?.firstName} {delegation.delegate?.lastName}
                        <div className="text-sm text-muted-foreground">
                          {delegation.delegate?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {delegation.roleKey ? (roleLabels[delegation.roleKey] || delegation.roleKey) : "All Roles"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {delegation.rig ? `Rig ${delegation.rig.rigNumber}` : "All Rigs"}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{new Date(delegation.startsAt).toLocaleString()}</div>
                        <div className="text-muted-foreground">to</div>
                        <div>{new Date(delegation.endsAt).toLocaleString()}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={delegation.isActive ? "default" : "secondary"}>
                        {delegation.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteDelegationMutation.mutate(delegation.id)}
                        data-testid={`button-delete-delegation-${delegation.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      )}

      {!selectedRig && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Please select a rig to configure workflows, role assignments, and delegations.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}