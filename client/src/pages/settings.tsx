import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Plus, Trash2, Users, Database, Cog } from "lucide-react";
import type { System, Equipment, Department, ActionParty, Rig } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [newItemName, setNewItemName] = useState("");
  const [newSystemId, setNewSystemId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  // Fetch reference data
  const { data: systems = [] } = useQuery<System[]>({ queryKey: ['/api/systems'] });
  const { data: equipment = [] } = useQuery<Equipment[]>({ queryKey: ['/api/equipment'] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['/api/departments'] });
  const { data: actionParties = [] } = useQuery<ActionParty[]>({ queryKey: ['/api/action-parties'] });
  const { data: rigs = [] } = useQuery<Rig[]>({ queryKey: ['/api/rigs'] });

  // Create mutations for each reference type
  const createSystemMutation = useMutation({
    mutationFn: async (name: string) => apiRequest('/api/systems', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/systems'] });
      setNewItemName("");
      setIsDialogOpen(false);
      toast({ title: "Success", description: "System created successfully" });
    },
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async ({ name, systemId }: { name: string; systemId: number }) => 
      apiRequest('/api/equipment', {
        method: 'POST',
        body: JSON.stringify({ name, systemId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      setNewItemName("");
      setNewSystemId(null);
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Equipment created successfully" });
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (name: string) => apiRequest('/api/departments', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      setNewItemName("");
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Department created successfully" });
    },
  });

  const createActionPartyMutation = useMutation({
    mutationFn: async (name: string) => apiRequest('/api/action-parties', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-parties'] });
      setNewItemName("");
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Action Party created successfully" });
    },
  });

  const deleteSystemMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/systems/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/systems'] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      toast({ title: "Success", description: "System deleted successfully" });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/equipment/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      toast({ title: "Success", description: "Equipment deleted successfully" });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/departments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({ title: "Success", description: "Department deleted successfully" });
    },
  });

  const deleteActionPartyMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/action-parties/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-parties'] });
      toast({ title: "Success", description: "Action Party deleted successfully" });
    },
  });

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 p-6">
            <Card>
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-gray-600">Only administrators can access system settings.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const CreateItemDialog = ({ type, title, onSubmit, loading }: {
    type: string;
    title: string;
    onSubmit: () => void;
    loading: boolean;
  }) => (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid={`button-add-${type}`}>
          <Plus className="h-4 w-4 mr-1" />
          Add {title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New {title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Enter ${title.toLowerCase()} name`}
              data-testid={`input-${type}-name`}
            />
          </div>
          {type === 'equipment' && (
            <div>
              <Label htmlFor="system">System</Label>
              <select
                id="system"
                value={newSystemId || ''}
                onChange={(e) => setNewSystemId(Number(e.target.value))}
                className="w-full p-2 border rounded"
                data-testid="select-equipment-system"
              >
                <option value="">Select System</option>
                {systems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={onSubmit}
              disabled={loading || !newItemName.trim() || (type === 'equipment' && !newSystemId)}
              data-testid={`button-create-${type}`}
            >
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-6 w-6" />
                <h1 className="text-3xl font-bold">System Settings</h1>
                <Badge variant="secondary">Admin Only</Badge>
              </div>
            </div>

            <Tabs defaultValue="systems" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="systems" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Systems
                </TabsTrigger>
                <TabsTrigger value="equipment" className="flex items-center gap-2">
                  <Cog className="h-4 w-4" />
                  Equipment
                </TabsTrigger>
                <TabsTrigger value="departments" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Departments
                </TabsTrigger>
                <TabsTrigger value="action-parties">Action Parties</TabsTrigger>
                <TabsTrigger value="rigs">Rigs</TabsTrigger>
              </TabsList>

              <TabsContent value="systems">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Systems Management</CardTitle>
                    <CreateItemDialog
                      type="system"
                      title="System"
                      onSubmit={() => createSystemMutation.mutate(newItemName)}
                      loading={createSystemMutation.isPending}
                    />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Equipment Count</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systems.map((system) => (
                          <TableRow key={system.id}>
                            <TableCell className="font-medium">{system.name}</TableCell>
                            <TableCell>
                              <Badge variant={system.isActive ? "default" : "secondary"}>
                                {system.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {equipment.filter(eq => eq.systemId === system.id).length}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteSystemMutation.mutate(system.id)}
                                disabled={deleteSystemMutation.isPending}
                                data-testid={`button-delete-system-${system.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="equipment">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Equipment Management</CardTitle>
                    <CreateItemDialog
                      type="equipment"
                      title="Equipment"
                      onSubmit={() => createEquipmentMutation.mutate({ 
                        name: newItemName, 
                        systemId: newSystemId! 
                      })}
                      loading={createEquipmentMutation.isPending}
                    />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>System</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equipment.map((eq) => {
                          const system = systems.find(s => s.id === eq.systemId);
                          return (
                            <TableRow key={eq.id}>
                              <TableCell className="font-medium">{eq.name}</TableCell>
                              <TableCell>{system?.name || 'Unknown'}</TableCell>
                              <TableCell>
                                <Badge variant={eq.isActive ? "default" : "secondary"}>
                                  {eq.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteEquipmentMutation.mutate(eq.id)}
                                  disabled={deleteEquipmentMutation.isPending}
                                  data-testid={`button-delete-equipment-${eq.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="departments">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Departments Management</CardTitle>
                    <CreateItemDialog
                      type="department"
                      title="Department"
                      onSubmit={() => createDepartmentMutation.mutate(newItemName)}
                      loading={createDepartmentMutation.isPending}
                    />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departments.map((dept) => (
                          <TableRow key={dept.id}>
                            <TableCell className="font-medium">{dept.name}</TableCell>
                            <TableCell>
                              <Badge variant={dept.isActive ? "default" : "secondary"}>
                                {dept.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteDepartmentMutation.mutate(dept.id)}
                                disabled={deleteDepartmentMutation.isPending}
                                data-testid={`button-delete-department-${dept.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="action-parties">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Action Parties Management</CardTitle>
                    <CreateItemDialog
                      type="action-party"
                      title="Action Party"
                      onSubmit={() => createActionPartyMutation.mutate(newItemName)}
                      loading={createActionPartyMutation.isPending}
                    />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {actionParties.map((party) => (
                          <TableRow key={party.id}>
                            <TableCell className="font-medium">{party.name}</TableCell>
                            <TableCell>
                              <Badge variant={party.isActive ? "default" : "secondary"}>
                                {party.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteActionPartyMutation.mutate(party.id)}
                                disabled={deleteActionPartyMutation.isPending}
                                data-testid={`button-delete-action-party-${party.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rigs">
                <Card>
                  <CardHeader>
                    <CardTitle>Rigs Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rig Number</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rigs.map((rig) => (
                          <TableRow key={rig.id}>
                            <TableCell className="font-medium">{rig.rigNumber}</TableCell>
                            <TableCell className="capitalize">{rig.section}</TableCell>
                            <TableCell>{rig.client}</TableCell>
                            <TableCell>{rig.location}</TableCell>
                            <TableCell>
                              <Badge variant={rig.isActive ? "default" : "secondary"}>
                                {rig.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}