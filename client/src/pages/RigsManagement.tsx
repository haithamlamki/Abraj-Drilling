import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Upload, Plus, Edit2, Trash2, Check, X, FileSpreadsheet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Rig {
  id: number;
  rigNumber: number;
  section: string;
  client: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function RigsManagement() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedRig, setEditedRig] = useState<Partial<Rig>>({});
  const [newRig, setNewRig] = useState<Partial<Rig>>({
    rigNumber: 0,
    section: "Drilling",
    client: "KOC",
    location: "",
    isActive: true
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch rigs
  const { data: rigs = [], isLoading } = useQuery<Rig[]>({
    queryKey: ['/api/rigs'],
  });

  // Create/Update rig mutation
  const upsertMutation = useMutation({
    mutationFn: async (rigData: Partial<Rig> | Partial<Rig>[]) => {
      return apiRequest('/api/rigs', {
        method: 'POST',
        body: JSON.stringify(rigData),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Rig(s) ${Array.isArray(data.rigs) ? 'saved' : 'saved'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
      setEditingId(null);
      setIsAddDialogOpen(false);
      setNewRig({
        rigNumber: 0,
        section: "Drilling",
        client: "KOC",
        location: "",
        isActive: true
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save rig",
        variant: "destructive",
      });
    }
  });

  // Delete rig mutation
  const deleteMutation = useMutation({
    mutationFn: async (rigId: number) => {
      return apiRequest(`/api/rigs/${rigId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Rig deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete rig",
        variant: "destructive",
      });
    }
  });

  // Import rigs mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/rigs/import', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import Successful",
        description: data.message || `Imported ${data.imported} rigs successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rigs'] });
      setSelectedFile(null);
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import rigs",
        variant: "destructive",
      });
    }
  });

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (!['xlsx', 'xls'].includes(ext || '')) {
        toast({
          title: "Invalid File",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Handle import
  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  // Start editing
  const startEdit = (rig: Rig) => {
    setEditingId(rig.id);
    setEditedRig({ ...rig });
  };

  // Save edit
  const saveEdit = () => {
    if (editedRig) {
      upsertMutation.mutate(editedRig);
    }
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditedRig({});
  };

  // Add new rig
  const handleAddRig = () => {
    if (newRig.rigNumber && newRig.rigNumber > 0) {
      upsertMutation.mutate(newRig);
    } else {
      toast({
        title: "Validation Error",
        description: "Please enter a valid rig number",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Rig Registry Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            {/* Add Rig Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Rig
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Rig</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="rigNumber">Rig Number *</Label>
                    <Input
                      id="rigNumber"
                      type="number"
                      value={newRig.rigNumber || ''}
                      onChange={(e) => setNewRig({ ...newRig, rigNumber: parseInt(e.target.value) || 0 })}
                      placeholder="Enter rig number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="section">Section</Label>
                    <Input
                      id="section"
                      value={newRig.section || ''}
                      onChange={(e) => setNewRig({ ...newRig, section: e.target.value })}
                      placeholder="e.g., Drilling, Workover"
                    />
                  </div>
                  <div>
                    <Label htmlFor="client">Client</Label>
                    <Input
                      id="client"
                      value={newRig.client || ''}
                      onChange={(e) => setNewRig({ ...newRig, client: e.target.value })}
                      placeholder="e.g., KOC, PDO"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={newRig.location || ''}
                      onChange={(e) => setNewRig({ ...newRig, location: e.target.value })}
                      placeholder="e.g., Field name or area"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isActive">Active Status</Label>
                    <Switch
                      id="isActive"
                      checked={newRig.isActive}
                      onCheckedChange={(checked) => setNewRig({ ...newRig, isActive: checked })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddRig} disabled={upsertMutation.isPending}>
                      {upsertMutation.isPending ? "Adding..." : "Add Rig"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Import Excel */}
            <div className="flex items-center gap-2">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">
                  <FileSpreadsheet className="h-4 w-4" />
                  Import Excel
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
              {selectedFile && (
                <>
                  <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? "Importing..." : "Upload"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Excel Template Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Excel Import Format:</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Your Excel file should have the following columns:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>• Rig Number</div>
              <div>• Section</div>
              <div>• Client</div>
              <div>• Location</div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Status column is optional (Active/Inactive). Defaults to Active if not specified.
            </p>
          </div>

          {/* Rigs Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Rig Number</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading rigs...
                    </TableCell>
                  </TableRow>
                ) : rigs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No rigs found. Add a rig or import from Excel to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  rigs.map((rig) => (
                    <TableRow key={rig.id}>
                      <TableCell className="font-medium">
                        {editingId === rig.id ? (
                          <Input
                            type="number"
                            value={editedRig.rigNumber || ''}
                            onChange={(e) => setEditedRig({ ...editedRig, rigNumber: parseInt(e.target.value) || 0 })}
                            className="w-24"
                          />
                        ) : (
                          rig.rigNumber
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === rig.id ? (
                          <Input
                            value={editedRig.section || ''}
                            onChange={(e) => setEditedRig({ ...editedRig, section: e.target.value })}
                            className="w-32"
                          />
                        ) : (
                          rig.section
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === rig.id ? (
                          <Input
                            value={editedRig.client || ''}
                            onChange={(e) => setEditedRig({ ...editedRig, client: e.target.value })}
                            className="w-32"
                          />
                        ) : (
                          rig.client || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === rig.id ? (
                          <Input
                            value={editedRig.location || ''}
                            onChange={(e) => setEditedRig({ ...editedRig, location: e.target.value })}
                            className="w-40"
                          />
                        ) : (
                          rig.location || '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {editingId === rig.id ? (
                          <Switch
                            checked={editedRig.isActive}
                            onCheckedChange={(checked) => setEditedRig({ ...editedRig, isActive: checked })}
                          />
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            rig.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {rig.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {editingId === rig.id ? (
                          <div className="flex justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={saveEdit}
                              disabled={upsertMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(rig)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete Rig ${rig.rigNumber}?`)) {
                                  deleteMutation.mutate(rig.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}