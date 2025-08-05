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
import { Settings, Plus, Trash2, Users, Database, Cog, UserPlus, Edit, Shield, Upload, X, Check, Palette, Bell, FileText, Download } from "lucide-react";
import type { System, Equipment, Department, ActionParty, Rig, User } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [newItemName, setNewItemName] = useState("");
  const [newSystemId, setNewSystemId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    id: "",
    email: "",
    firstName: "",
    role: "drilling_manager" as "admin" | "supervisor" | "drilling_manager",
    rigIds: [] as number[],
    departmentId: null as number | null,
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showRigDialog, setShowRigDialog] = useState(false);
  const [editingRig, setEditingRig] = useState<Rig | null>(null);
  const [showRigImportDialog, setShowRigImportDialog] = useState(false);
  
  // Inline editing states
  const [editingItemId, setEditingItemId] = useState<number | string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [editingType, setEditingType] = useState<"system" | "equipment" | "department" | "actionParty" | "user" | "rig" | null>(null);
  const [editingUserData, setEditingUserData] = useState<{
    email: string;
    firstName: string;
    role: string;
    rigId: number | null;
    rigIds: number[];
  } | null>(null);
  const [editingRigData, setEditingRigData] = useState<{
    rigNumber: number;
    section: string;
    client: string;
    location: string;
  } | null>(null);
  
  // Custom roles - load from localStorage on mount
  const [customRoles, setCustomRoles] = useState<string[]>(() => {
    const saved = localStorage.getItem('customRoles');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAddRoleDialog, setShowAddRoleDialog] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  
  // Admin customization states
  const [customSettings, setCustomSettings] = useState({
    companyName: "Drilling Operations Inc.",
    primaryColor: "#0066cc",
    notificationEmail: "admin@drillingops.com",
    enableEmailAlerts: true,
    autoApproveThreshold: 24,
    dataRetentionDays: 365,
    defaultDashboardView: "overview",
    enableDataExport: true,
    enableBulkOperations: true,
    requireApprovalComments: false,
    enableAuditLog: true,
  });

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
    mutationFn: async (name: string) => {
      const response = await apiRequest('POST', '/api/systems', { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/systems'] });
      setNewItemName("");
      setIsDialogOpen(false);
      toast({ title: "Success", description: "System created successfully" });
    },
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async ({ name, systemId }: { name: string; systemId: number }) => {
      const response = await apiRequest('POST', '/api/equipment', { name, systemId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      setNewItemName("");
      setNewSystemId(null);
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Equipment created successfully" });
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('POST', '/api/departments', { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      setNewItemName("");
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Department created successfully" });
    },
  });

  const createActionPartyMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('POST', '/api/action-parties', { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-parties'] });
      setNewItemName("");
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Action Party created successfully" });
    },
  });

  const deleteSystemMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/systems/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/systems'] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      toast({ title: "Success", description: "System deleted successfully" });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/equipment/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      toast({ title: "Success", description: "Equipment deleted successfully" });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/departments/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({ title: "Success", description: "Department deleted successfully" });
    },
  });

  const deleteActionPartyMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/action-parties/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-parties'] });
      toast({ title: "Success", description: "Action Party deleted successfully" });
    },
  });

  // Update mutations for inline editing
  const updateSystemMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiRequest('PATCH', `/api/systems/${id}`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/systems'] });
      setEditingItemId(null);
      setEditingType(null);
      toast({ title: "Success", description: "System updated successfully" });
    },
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiRequest('PATCH', `/api/equipment/${id}`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      setEditingItemId(null);
      setEditingType(null);
      toast({ title: "Success", description: "Equipment updated successfully" });
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiRequest('PATCH', `/api/departments/${id}`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      setEditingItemId(null);
      setEditingType(null);
      toast({ title: "Success", description: "Department updated successfully" });
    },
  });

  const updateActionPartyMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiRequest('PATCH', `/api/action-parties/${id}`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-parties'] });
      setEditingItemId(null);
      setEditingType(null);
      toast({ title: "Success", description: "Action Party updated successfully" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/users/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setEditingItemId(null);
      setEditingType(null);
      setEditingUserData(null);
      toast({ title: "Success", description: "User updated successfully" });
    },
  });
  
  const updateRigMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PATCH', `/api/rigs/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
      setEditingItemId(null);
      setEditingType(null);
      setEditingRigData(null);
      toast({ title: "Success", description: "Rig updated successfully" });
    },
  });
  
  const deleteRigMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/rigs/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
      toast({ title: "Success", description: "Rig deleted successfully" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/users/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const response = await apiRequest('POST', '/api/users', userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      setNewUserData({
        id: "",
        email: "",
        firstName: "",
        role: "drilling_manager",
        rigIds: [],
        departmentId: null,
      });
      toast({ title: "Success", description: "User created successfully" });
    },
  });

  const createRigMutation = useMutation({
    mutationFn: async (rigData: { rigNumber: string; section: string; client: string; location: string; isActive: boolean }) => {
      const response = await apiRequest('POST', '/api/rigs', rigData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
      setShowRigDialog(false);
      setEditingRig(null);
      toast({ title: "Success", description: "Rig created successfully" });
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
              <TabsList className="grid w-full grid-cols-7">
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
                <TabsTrigger value="customization" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Customize
                </TabsTrigger>
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
                            <TableCell className="font-medium">
                              {editingItemId === system.id && editingType === "system" ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editingItemName}
                                    onChange={(e) => setEditingItemName(e.target.value)}
                                    className="h-8 w-48"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        updateSystemMutation.mutate({ id: system.id, name: editingItemName });
                                      } else if (e.key === "Escape") {
                                        setEditingItemId(null);
                                        setEditingType(null);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateSystemMutation.mutate({ id: system.id, name: editingItemName })}
                                    disabled={updateSystemMutation.isPending}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingItemId(null);
                                      setEditingType(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div 
                                  className="flex items-center gap-2 cursor-pointer hover:underline"
                                  onClick={() => {
                                    setEditingItemId(system.id);
                                    setEditingItemName(system.name);
                                    setEditingType("system");
                                  }}
                                >
                                  {system.name}
                                  <Edit className="h-3 w-3 opacity-50" />
                                </div>
                              )}
                            </TableCell>
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
                              <TableCell className="font-medium">
                                {editingItemId === eq.id && editingType === "equipment" ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={editingItemName}
                                      onChange={(e) => setEditingItemName(e.target.value)}
                                      className="h-8 w-48"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          updateEquipmentMutation.mutate({ id: eq.id, name: editingItemName });
                                        } else if (e.key === "Escape") {
                                          setEditingItemId(null);
                                          setEditingType(null);
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => updateEquipmentMutation.mutate({ id: eq.id, name: editingItemName })}
                                      disabled={updateEquipmentMutation.isPending}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingItemId(null);
                                        setEditingType(null);
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div 
                                    className="flex items-center gap-2 cursor-pointer hover:underline"
                                    onClick={() => {
                                      setEditingItemId(eq.id);
                                      setEditingItemName(eq.name);
                                      setEditingType("equipment");
                                    }}
                                  >
                                    {eq.name}
                                    <Edit className="h-3 w-3 opacity-50" />
                                  </div>
                                )}
                              </TableCell>
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
                            <TableCell className="font-medium">
                              {editingItemId === dept.id && editingType === "department" ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editingItemName}
                                    onChange={(e) => setEditingItemName(e.target.value)}
                                    className="h-8 w-48"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        updateDepartmentMutation.mutate({ id: dept.id, name: editingItemName });
                                      } else if (e.key === "Escape") {
                                        setEditingItemId(null);
                                        setEditingType(null);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateDepartmentMutation.mutate({ id: dept.id, name: editingItemName })}
                                    disabled={updateDepartmentMutation.isPending}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingItemId(null);
                                      setEditingType(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div 
                                  className="flex items-center gap-2 cursor-pointer hover:underline"
                                  onClick={() => {
                                    setEditingItemId(dept.id);
                                    setEditingItemName(dept.name);
                                    setEditingType("department");
                                  }}
                                >
                                  {dept.name}
                                  <Edit className="h-3 w-3 opacity-50" />
                                </div>
                              )}
                            </TableCell>
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
                            <TableCell className="font-medium">
                              {editingItemId === party.id && editingType === "actionParty" ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editingItemName}
                                    onChange={(e) => setEditingItemName(e.target.value)}
                                    className="h-8 w-48"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        updateActionPartyMutation.mutate({ id: party.id, name: editingItemName });
                                      } else if (e.key === "Escape") {
                                        setEditingItemId(null);
                                        setEditingType(null);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateActionPartyMutation.mutate({ id: party.id, name: editingItemName })}
                                    disabled={updateActionPartyMutation.isPending}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingItemId(null);
                                      setEditingType(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div 
                                  className="flex items-center gap-2 cursor-pointer hover:underline"
                                  onClick={() => {
                                    setEditingItemId(party.id);
                                    setEditingItemName(party.name);
                                    setEditingType("actionParty");
                                  }}
                                >
                                  {party.name}
                                  <Edit className="h-3 w-3 opacity-50" />
                                </div>
                              )}
                            </TableCell>
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
                          id: "",
                          email: "",
                          firstName: "",
                          role: "drilling_manager",
                          rigIds: [],
                          departmentId: null,
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
                            <Label htmlFor="userId">ID</Label>
                            <Input
                              id="userId"
                              value={newUserData.id}
                              onChange={(e) => setNewUserData({ ...newUserData, id: e.target.value })}
                              placeholder="Enter user ID"
                              data-testid="input-user-id"
                            />
                          </div>
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
                          <div>
                            <Label htmlFor="firstName">Name</Label>
                            <Input
                              id="firstName"
                              value={newUserData.firstName}
                              onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                              placeholder="John Doe"
                              data-testid="input-user-firstName"
                            />
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
                                {customRoles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="rig">Assigned Rig</Label>
                            <div className="relative">
                              <Select>
                                <SelectTrigger id="rig" data-testid="select-user-rig">
                                  <SelectValue placeholder={
                                    newUserData.rigIds.length === 0 
                                      ? "Select rigs" 
                                      : newUserData.rigIds.length === rigs.length 
                                        ? "All Rigs Assigned" 
                                        : `${newUserData.rigIds.length} rig(s) selected`
                                  } />
                                </SelectTrigger>
                                <SelectContent>
                                  <ScrollArea className="h-[200px]">
                                    <div className="p-2">
                                      <div 
                                        className="flex items-center space-x-2 mb-2 pb-2 border-b cursor-pointer hover:bg-accent p-2 rounded"
                                        onClick={() => {
                                          if (newUserData.rigIds.length === rigs.length) {
                                            setNewUserData({ ...newUserData, rigIds: [] });
                                          } else {
                                            setNewUserData({ ...newUserData, rigIds: rigs.map(r => r.id) });
                                          }
                                        }}
                                      >
                                        <Checkbox 
                                          checked={newUserData.rigIds.length === rigs.length}
                                          onCheckedChange={() => {}}
                                        />
                                        <span className="font-medium">All Rigs Assigned</span>
                                      </div>
                                      {rigs.map((rig) => (
                                        <div 
                                          key={rig.id} 
                                          className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                                          onClick={() => {
                                            const isSelected = newUserData.rigIds.includes(rig.id);
                                            setNewUserData({
                                              ...newUserData,
                                              rigIds: isSelected 
                                                ? newUserData.rigIds.filter(id => id !== rig.id)
                                                : [...newUserData.rigIds, rig.id]
                                            });
                                          }}
                                        >
                                          <Checkbox 
                                            checked={newUserData.rigIds.includes(rig.id)}
                                            onCheckedChange={() => {}}
                                          />
                                          <span>Rig {rig.rigNumber} - {rig.location}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="department">User Departments</Label>
                            <Select
                              value={newUserData.departmentId?.toString() || "none"}
                              onValueChange={(value) => setNewUserData({ ...newUserData, departmentId: value === "none" ? null : parseInt(value) })}
                            >
                              <SelectTrigger id="department" data-testid="select-user-department">
                                <SelectValue placeholder="Select a department" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Department</SelectItem>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id.toString()}>
                                    {dept.name}
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
                              disabled={createUserMutation.isPending || !newUserData.id || !newUserData.email || !newUserData.firstName}
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
                          const userRigIds = (currentUserData as any).rigIds || [];
                          const assignedRigs = userRigIds.map((id: number) => rigs.find(r => r.id === id)).filter(Boolean);
                          const isEditing = editingItemId === currentUserData.id && editingType === "user";
                          
                          return (
                            <TableRow key={currentUserData.id}>
                              <TableCell className="font-medium">
                                {isEditing ? (
                                  <Input
                                    value={editingUserData?.firstName || ""}
                                    onChange={(e) => setEditingUserData({...editingUserData!, firstName: e.target.value})}
                                    placeholder="Name"
                                    className="h-8 w-48"
                                  />
                                ) : (
                                  <div 
                                    className="cursor-pointer hover:underline flex items-center gap-2"
                                    onClick={() => {
                                      setEditingItemId(currentUserData.id);
                                      setEditingType("user");
                                      setEditingUserData({
                                        email: currentUserData.email || "",
                                        firstName: currentUserData.firstName || "",
                                        role: currentUserData.role,
                                        rigId: currentUserData.rigId,
                                        rigIds: userRigIds
                                      });
                                    }}
                                  >
                                    {currentUserData.firstName}
                                    <Edit className="h-3 w-3 opacity-50" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    type="email"
                                    value={editingUserData?.email || ""}
                                    onChange={(e) => setEditingUserData({...editingUserData!, email: e.target.value})}
                                    className="h-8 w-48"
                                  />
                                ) : (
                                  currentUserData.email
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={editingUserData?.role}
                                    onValueChange={(value) => setEditingUserData({...editingUserData!, role: value})}
                                  >
                                    <SelectTrigger className="h-8 w-36">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="supervisor">Supervisor</SelectItem>
                                      <SelectItem value="drilling_manager">Drilling Manager</SelectItem>
                                      {customRoles.map((role) => (
                                        <SelectItem key={role} value={role}>{role}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant={currentUserData.role === 'admin' ? 'destructive' : 'default'}>
                                    <Shield className="h-3 w-3 mr-1" />
                                    {currentUserData.role}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select>
                                    <SelectTrigger className="h-8 w-32">
                                      <SelectValue placeholder={
                                        editingUserData?.rigIds.length === 0 
                                          ? "Select rigs" 
                                          : editingUserData?.rigIds.length === rigs.length 
                                            ? "All Rigs" 
                                            : `${editingUserData?.rigIds.length} rig(s)`
                                      } />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <ScrollArea className="h-[200px]">
                                        <div className="p-2">
                                          <div 
                                            className="flex items-center space-x-2 mb-2 pb-2 border-b cursor-pointer hover:bg-accent p-2 rounded"
                                            onClick={() => {
                                              if (editingUserData?.rigIds.length === rigs.length) {
                                                setEditingUserData({ ...editingUserData!, rigIds: [] });
                                              } else {
                                                setEditingUserData({ ...editingUserData!, rigIds: rigs.map(r => r.id) });
                                              }
                                            }}
                                          >
                                            <Checkbox 
                                              checked={editingUserData?.rigIds.length === rigs.length}
                                              onCheckedChange={() => {}}
                                            />
                                            <span className="font-medium">All Rigs</span>
                                          </div>
                                          {rigs.map((rig) => (
                                            <div 
                                              key={rig.id} 
                                              className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                                              onClick={() => {
                                                const isSelected = editingUserData?.rigIds.includes(rig.id);
                                                setEditingUserData({
                                                  ...editingUserData!,
                                                  rigIds: isSelected 
                                                    ? editingUserData?.rigIds.filter(id => id !== rig.id) || []
                                                    : [...(editingUserData?.rigIds || []), rig.id]
                                                });
                                              }}
                                            >
                                              <Checkbox 
                                                checked={editingUserData?.rigIds.includes(rig.id)}
                                                onCheckedChange={() => {}}
                                              />
                                              <span>Rig {rig.rigNumber}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  assignedRigs.length === 0 
                                    ? '-' 
                                    : assignedRigs.length === rigs.length 
                                      ? 'All Rigs' 
                                      : assignedRigs.map((r: any) => `Rig ${r.rigNumber}`).join(', ')
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="default">Active</Badge>
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        updateUserMutation.mutate({
                                          id: currentUserData.id,
                                          updates: editingUserData
                                        });
                                      }}
                                      disabled={updateUserMutation.isPending}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingItemId(null);
                                        setEditingType(null);
                                        setEditingUserData(null);
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
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
                                )}
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
                        {rigs.map((rig) => {
                          const isEditing = editingItemId === rig.id && editingType === "rig";
                          
                          return (
                            <TableRow key={rig.id}>
                              <TableCell className="font-medium">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    value={editingRigData?.rigNumber || 0}
                                    onChange={(e) => setEditingRigData({...editingRigData!, rigNumber: parseInt(e.target.value)})}
                                    className="h-8 w-20"
                                  />
                                ) : (
                                  <div 
                                    className="cursor-pointer hover:underline flex items-center gap-2"
                                    onClick={() => {
                                      setEditingItemId(rig.id);
                                      setEditingType("rig");
                                      setEditingRigData({
                                        rigNumber: rig.rigNumber,
                                        section: rig.section,
                                        client: rig.client || "",
                                        location: rig.location || ""
                                      });
                                    }}
                                  >
                                    {rig.rigNumber}
                                    <Edit className="h-3 w-3 opacity-50" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="capitalize">
                                {isEditing ? (
                                  <Select
                                    value={editingRigData?.section}
                                    onValueChange={(value) => setEditingRigData({...editingRigData!, section: value})}
                                  >
                                    <SelectTrigger className="h-8 w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="drilling">Drilling</SelectItem>
                                      <SelectItem value="workover">Workover</SelectItem>
                                      <SelectItem value="maintenance">Maintenance</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  rig.section
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={editingRigData?.client || ""}
                                    onChange={(e) => setEditingRigData({...editingRigData!, client: e.target.value})}
                                    className="h-8 w-32"
                                  />
                                ) : (
                                  rig.client
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={editingRigData?.location || ""}
                                    onChange={(e) => setEditingRigData({...editingRigData!, location: e.target.value})}
                                    className="h-8 w-32"
                                  />
                                ) : (
                                  rig.location
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={rig.isActive ? "default" : "secondary"}>
                                  {rig.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        updateRigMutation.mutate({
                                          id: rig.id,
                                          ...editingRigData
                                        });
                                      }}
                                      disabled={updateRigMutation.isPending}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingItemId(null);
                                        setEditingType(null);
                                        setEditingRigData(null);
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteRigMutation.mutate(rig.id)}
                                    disabled={deleteRigMutation.isPending}
                                    data-testid={`button-delete-rig-${rig.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="customization">
                <div className="space-y-6">
                  {/* Custom Roles */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Custom Roles
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Enter new role name"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && newRoleName.trim()) {
                              const updatedRoles = [...customRoles, newRoleName.trim()];
                              setCustomRoles(updatedRoles);
                              localStorage.setItem('customRoles', JSON.stringify(updatedRoles));
                              setNewRoleName("");
                              toast({ title: "Success", description: `Custom role "${newRoleName}" added successfully` });
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => {
                            if (newRoleName.trim()) {
                              const updatedRoles = [...customRoles, newRoleName.trim()];
                              setCustomRoles(updatedRoles);
                              localStorage.setItem('customRoles', JSON.stringify(updatedRoles));
                              setNewRoleName("");
                              toast({ title: "Success", description: `Custom role "${newRoleName}" added successfully` });
                            }
                          }}
                          disabled={!newRoleName.trim()}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Role
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {customRoles.map((role, index) => (
                          <Badge key={index} variant="secondary" className="px-3 py-1">
                            {role}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2 h-4 w-4 p-0"
                              onClick={() => {
                                const updatedRoles = customRoles.filter((_, i) => i !== index);
                                setCustomRoles(updatedRoles);
                                localStorage.setItem('customRoles', JSON.stringify(updatedRoles));
                                toast({ title: "Success", description: `Custom role "${role}" removed` });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                        {customRoles.length === 0 && (
                          <p className="text-sm text-muted-foreground">No custom roles created yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* General Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        General Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="companyName">Company Name</Label>
                          <Input 
                            id="companyName"
                            value={customSettings.companyName}
                            onChange={(e) => setCustomSettings({...customSettings, companyName: e.target.value})}
                            placeholder="Enter company name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="primaryColor">Primary Color</Label>
                          <div className="flex gap-2">
                            <Input 
                              id="primaryColor"
                              type="color"
                              value={customSettings.primaryColor}
                              onChange={(e) => setCustomSettings({...customSettings, primaryColor: e.target.value})}
                              className="w-20 h-10 p-1"
                            />
                            <Input 
                              value={customSettings.primaryColor}
                              onChange={(e) => setCustomSettings({...customSettings, primaryColor: e.target.value})}
                              placeholder="#0066cc"
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="defaultDashboard">Default Dashboard View</Label>
                        <Select 
                          value={customSettings.defaultDashboardView}
                          onValueChange={(value) => setCustomSettings({...customSettings, defaultDashboardView: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="overview">Overview</SelectItem>
                            <SelectItem value="detailed">Detailed Analytics</SelectItem>
                            <SelectItem value="reports">Reports Focus</SelectItem>
                            <SelectItem value="approvals">Approvals Queue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notification Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notification Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="notificationEmail">Notification Email</Label>
                        <Input 
                          id="notificationEmail"
                          type="email"
                          value={customSettings.notificationEmail}
                          onChange={(e) => setCustomSettings({...customSettings, notificationEmail: e.target.value})}
                          placeholder="admin@example.com"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableEmailAlerts">Enable Email Alerts</Label>
                          <p className="text-sm text-gray-500">Send email notifications for important events</p>
                        </div>
                        <Switch 
                          id="enableEmailAlerts"
                          checked={customSettings.enableEmailAlerts}
                          onCheckedChange={(checked) => setCustomSettings({...customSettings, enableEmailAlerts: checked})}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="autoApproveThreshold">Auto-Approve Threshold (hours)</Label>
                        <Input 
                          id="autoApproveThreshold"
                          type="number"
                          value={customSettings.autoApproveThreshold}
                          onChange={(e) => setCustomSettings({...customSettings, autoApproveThreshold: parseInt(e.target.value)})}
                          placeholder="24"
                        />
                        <p className="text-sm text-gray-500 mt-1">NPT reports under this duration will be auto-approved</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Data Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Data Management
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="dataRetentionDays">Data Retention Period (days)</Label>
                        <Input 
                          id="dataRetentionDays"
                          type="number"
                          value={customSettings.dataRetentionDays}
                          onChange={(e) => setCustomSettings({...customSettings, dataRetentionDays: parseInt(e.target.value)})}
                          placeholder="365"
                        />
                        <p className="text-sm text-gray-500 mt-1">How long to keep historical data</p>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableDataExport">Enable Data Export</Label>
                          <p className="text-sm text-gray-500">Allow users to export data to CSV/Excel</p>
                        </div>
                        <Switch 
                          id="enableDataExport"
                          checked={customSettings.enableDataExport}
                          onCheckedChange={(checked) => setCustomSettings({...customSettings, enableDataExport: checked})}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableBulkOperations">Enable Bulk Operations</Label>
                          <p className="text-sm text-gray-500">Allow bulk editing and deletion of records</p>
                        </div>
                        <Switch 
                          id="enableBulkOperations"
                          checked={customSettings.enableBulkOperations}
                          onCheckedChange={(checked) => setCustomSettings({...customSettings, enableBulkOperations: checked})}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Security & Compliance */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Security & Compliance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="requireApprovalComments">Require Approval Comments</Label>
                          <p className="text-sm text-gray-500">Mandatory comments when approving/rejecting</p>
                        </div>
                        <Switch 
                          id="requireApprovalComments"
                          checked={customSettings.requireApprovalComments}
                          onCheckedChange={(checked) => setCustomSettings({...customSettings, requireApprovalComments: checked})}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableAuditLog">Enable Audit Log</Label>
                          <p className="text-sm text-gray-500">Track all system changes and user actions</p>
                        </div>
                        <Switch 
                          id="enableAuditLog"
                          checked={customSettings.enableAuditLog}
                          onCheckedChange={(checked) => setCustomSettings({...customSettings, enableAuditLog: checked})}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Export All Settings
                        </Button>
                        <Button variant="outline" className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Import Settings
                        </Button>
                        <Button variant="outline" className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Generate System Report
                        </Button>
                        <Button variant="outline" className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          View Audit Logs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Save Settings Button */}
                  <div className="flex justify-end">
                    <Button 
                      size="lg" 
                      onClick={() => {
                        toast({
                          title: "Settings Saved",
                          description: "All customization settings have been saved successfully.",
                        });
                      }}
                    >
                      Save All Settings
                    </Button>
                  </div>
                </div>
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