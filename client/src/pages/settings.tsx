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
import { Settings, Plus, Trash2, Users, Database, Cog, UserPlus, Edit, Shield, Upload } from "lucide-react";
import type { System, Equipment, Department, ActionParty, Rig, User } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [newItemName, setNewItemName] = useState("");
  const [newSystemId, setNewSystemId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "drilling_manager" as "admin" | "supervisor" | "drilling_manager",
    rigId: null as number | null,
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showRigDialog, setShowRigDialog] = useState(false);
  const [editingRig, setEditingRig] = useState<Rig | null>(null);
  const [showRigImportDialog, setShowRigImportDialog] = useState(false);

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
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['/api/users'] });

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

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => 
      apiRequest(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Success", description: "User updated successfully" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => 
      apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      setNewUserData({
        email: "",
        firstName: "",
        lastName: "",
        role: "drilling_manager",
        rigId: null,
      });
      toast({ title: "Success", description: "User created successfully" });
    },
  });

  const createRigMutation = useMutation({
    mutationFn: async (rigData: { rigNumber: string; section: string; client: string; location: string; isActive: boolean }) => 
      apiRequest('/api/rigs', {
        method: 'POST',
        body: JSON.stringify(rigData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
      setShowRigDialog(false);
      setEditingRig(null);
      toast({ title: "Success", description: "Rig created successfully" });
    },
  });

  const updateRigMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => 
      apiRequest(`/api/rigs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
      setShowRigDialog(false);
      setEditingRig(null);
      toast({ title: "Success", description: "Rig updated successfully" });
    },
  });

  const importRigsMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/rigs/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import rigs');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
      setShowRigImportDialog(false);
      toast({ 
        title: "Success", 
        description: `Successfully imported ${data.imported} rigs` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive"
      });
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

            <Tabs defaultValue="users" className="space-y-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
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

              <TabsContent value="users">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>User Management</CardTitle>
                    <Dialog open={isDialogOpen && !editingUserId} onOpenChange={(open) => {
                      if (!open) {
                        setIsDialogOpen(false);
                        setNewUserData({
                          email: "",
                          firstName: "",
                          lastName: "",
                          role: "drilling_manager",
                          rigId: null,
                        });
                      } else {
                        setIsDialogOpen(true);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-user">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Add User
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New User</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              value={newUserData.email}
                              onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                              placeholder="user@example.com"
                              data-testid="input-user-email"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="firstName">First Name</Label>
                              <Input
                                id="firstName"
                                value={newUserData.firstName}
                                onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                                placeholder="John"
                                data-testid="input-user-firstName"
                              />
                            </div>
                            <div>
                              <Label htmlFor="lastName">Last Name</Label>
                              <Input
                                id="lastName"
                                value={newUserData.lastName}
                                onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                                placeholder="Doe"
                                data-testid="input-user-lastName"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="role">Role</Label>
                            <Select
                              value={newUserData.role}
                              onValueChange={(value) => setNewUserData({ ...newUserData, role: value as any })}
                            >
                              <SelectTrigger id="role" data-testid="select-user-role">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="drilling_manager">Drilling Manager</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="rig">Assigned Rig</Label>
                            <Select
                              value={newUserData.rigId?.toString() || ""}
                              onValueChange={(value) => setNewUserData({ ...newUserData, rigId: value ? parseInt(value) : null })}
                            >
                              <SelectTrigger id="rig" data-testid="select-user-rig">
                                <SelectValue placeholder="Select a rig" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">No Rig</SelectItem>
                                {rigs.map((rig) => (
                                  <SelectItem key={rig.id} value={rig.id.toString()}>
                                    Rig {rig.rigNumber} - {rig.location}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={() => createUserMutation.mutate(newUserData)}
                              disabled={createUserMutation.isPending || !newUserData.email || !newUserData.firstName || !newUserData.lastName}
                              data-testid="button-create-user"
                            >
                              {createUserMutation.isPending ? "Creating..." : "Create User"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Assigned Rig</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((currentUserData) => {
                          const assignedRig = currentUserData.rigId ? rigs.find(r => r.id === currentUserData.rigId) : null;
                          return (
                            <TableRow key={currentUserData.id}>
                              <TableCell className="font-medium">
                                {currentUserData.firstName} {currentUserData.lastName}
                              </TableCell>
                              <TableCell>{currentUserData.email}</TableCell>
                              <TableCell>
                                <Badge variant={currentUserData.role === 'admin' ? 'destructive' : 'default'}>
                                  <Shield className="h-3 w-3 mr-1" />
                                  {currentUserData.role}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {assignedRig ? `Rig ${assignedRig.rigNumber}` : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="default">Active</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingUserId(currentUserData.id)}
                                    data-testid={`button-edit-user-${currentUserData.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {currentUserData.id !== user?.id && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => deleteUserMutation.mutate(currentUserData.id)}
                                      disabled={deleteUserMutation.isPending}
                                      data-testid={`button-delete-user-${currentUserData.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rigs">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Rigs Information</CardTitle>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={() => setShowRigImportDialog(true)}
                          data-testid="button-import-rigs"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Import from Excel
                        </Button>
                        <Button 
                          onClick={() => setShowRigDialog(true)}
                          data-testid="button-create-rig"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Rig
                        </Button>
                      </div>
                    </div>
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
                          <TableHead>Actions</TableHead>
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
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingRig(rig);
                                  setShowRigDialog(true);
                                }}
                                data-testid={`button-edit-rig-${rig.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
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
      
      {/* Rig Dialog for Create/Edit */}
      <Dialog open={showRigDialog} onOpenChange={setShowRigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRig ? 'Edit Rig' : 'Create New Rig'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const rigData = {
              rigNumber: formData.get('rigNumber') as string,
              section: formData.get('section') as string,
              client: formData.get('client') as string,
              location: formData.get('location') as string,
              isActive: formData.get('isActive') === 'true',
            };
            
            if (editingRig) {
              updateRigMutation.mutate({ id: editingRig.id, updates: rigData });
            } else {
              createRigMutation.mutate(rigData);
            }
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rigNumber">Rig Number</Label>
                <Input
                  id="rigNumber"
                  name="rigNumber"
                  defaultValue={editingRig?.rigNumber || ''}
                  placeholder="e.g., 203"
                  required
                  data-testid="input-rig-number-dialog"
                />
              </div>
              <div>
                <Label htmlFor="section">Section</Label>
                <Select name="section" defaultValue={editingRig?.section || 'KOC'}>
                  <SelectTrigger data-testid="select-section">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KOC">KOC</SelectItem>
                    <SelectItem value="KJO">KJO</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  name="client"
                  defaultValue={editingRig?.client || ''}
                  placeholder="e.g., Kuwait Oil Company"
                  required
                  data-testid="input-client"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  defaultValue={editingRig?.location || ''}
                  placeholder="e.g., Burgan Field"
                  required
                  data-testid="input-location"
                />
              </div>
              <div>
                <Label htmlFor="isActive">Status</Label>
                <Select name="isActive" defaultValue={editingRig?.isActive?.toString() || 'true'}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button type="button" variant="outline" onClick={() => {
                setShowRigDialog(false);
                setEditingRig(null);
              }}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createRigMutation.isPending || updateRigMutation.isPending}
                data-testid="button-save-rig"
              >
                {editingRig ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rig Import Dialog */}
      <Dialog open={showRigImportDialog} onOpenChange={setShowRigImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Rigs from Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload an Excel file containing rig information. The file should have columns for:
              Rig Number, Section, Client, Location, and Status (Active/Inactive).
            </p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    importRigsMutation.mutate(file);
                  }
                }}
                className="hidden"
                id="rig-file-upload"
              />
              <label
                htmlFor="rig-file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-8 w-8 mb-2 text-gray-400" />
                <span className="text-sm font-medium">Click to upload Excel file</span>
                <span className="text-xs text-gray-500 mt-1">.xlsx or .xls files only</span>
              </label>
            </div>
            {importRigsMutation.isPending && (
              <p className="text-sm text-center text-gray-600">Processing file...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}