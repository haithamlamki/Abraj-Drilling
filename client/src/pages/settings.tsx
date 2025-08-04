import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { System, Equipment, Department, ActionParty } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [newSystem, setNewSystem] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newActionParty, setNewActionParty] = useState("");

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

  const { data: systems = [] } = useQuery<System[]>({
    queryKey: ['/api/systems'],
    enabled: isAuthenticated,
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated,
  });

  const { data: actionParties = [] } = useQuery<ActionParty[]>({
    queryKey: ['/api/action-parties'],
    enabled: isAuthenticated,
  });

  const createSystemMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest('POST', '/api/systems', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/systems'] });
      setNewSystem("");
      toast({
        title: "Success",
        description: "System created successfully",
      });
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
        description: "Failed to create system",
        variant: "destructive",
      });
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest('POST', '/api/departments', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      setNewDepartment("");
      toast({
        title: "Success",
        description: "Department created successfully",
      });
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
        description: "Failed to create department",
        variant: "destructive",
      });
    },
  });

  const createActionPartyMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest('POST', '/api/action-parties', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-parties'] });
      setNewActionParty("");
      toast({
        title: "Success",
        description: "Action Party created successfully",
      });
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
        description: "Failed to create action party",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900" data-testid="text-settings-title">System Settings</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Reference Data Management */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reference Data Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Systems */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">Systems</Label>
                      {isAdmin && (
                        <div className="flex space-x-2 mb-3">
                          <Input
                            placeholder="Add new system"
                            value={newSystem}
                            onChange={(e) => setNewSystem(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && newSystem.trim() && createSystemMutation.mutate(newSystem.trim())}
                            data-testid="input-new-system"
                          />
                          <Button
                            onClick={() => newSystem.trim() && createSystemMutation.mutate(newSystem.trim())}
                            disabled={!newSystem.trim() || createSystemMutation.isPending}
                            data-testid="button-add-system"
                          >
                            Add
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {systems.map((system) => (
                          <Badge key={system.id} variant="secondary" data-testid={`badge-system-${system.id}`}>
                            {system.name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Departments */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">Departments</Label>
                      {isAdmin && (
                        <div className="flex space-x-2 mb-3">
                          <Input
                            placeholder="Add new department"
                            value={newDepartment}
                            onChange={(e) => setNewDepartment(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && newDepartment.trim() && createDepartmentMutation.mutate(newDepartment.trim())}
                            data-testid="input-new-department"
                          />
                          <Button
                            onClick={() => newDepartment.trim() && createDepartmentMutation.mutate(newDepartment.trim())}
                            disabled={!newDepartment.trim() || createDepartmentMutation.isPending}
                            data-testid="button-add-department"
                          >
                            Add
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {departments.map((department) => (
                          <Badge key={department.id} variant="secondary" data-testid={`badge-department-${department.id}`}>
                            {department.name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Action Parties */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">Action Parties</Label>
                      {isAdmin && (
                        <div className="flex space-x-2 mb-3">
                          <Input
                            placeholder="Add new action party"
                            value={newActionParty}
                            onChange={(e) => setNewActionParty(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && newActionParty.trim() && createActionPartyMutation.mutate(newActionParty.trim())}
                            data-testid="input-new-action-party"
                          />
                          <Button
                            onClick={() => newActionParty.trim() && createActionPartyMutation.mutate(newActionParty.trim())}
                            disabled={!newActionParty.trim() || createActionPartyMutation.isPending}
                            data-testid="button-add-action-party"
                          >
                            Add
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {actionParties.map((actionParty) => (
                          <Badge key={actionParty.id} variant="secondary" data-testid={`badge-action-party-${actionParty.id}`}>
                            {actionParty.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* System Status */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>System Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Database</span>
                      <span className="flex items-center text-green-600">
                        <i className="fas fa-check-circle mr-1"></i>
                        Online
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Authentication</span>
                      <span className="flex items-center text-green-600">
                        <i className="fas fa-check-circle mr-1"></i>
                        Active
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">User Role</span>
                      <Badge variant={isAdmin ? "default" : "secondary"}>
                        {user?.role || 'Unknown'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {!isAdmin && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <i className="fas fa-info-circle text-blue-500 text-2xl mb-2"></i>
                        <p className="text-sm text-gray-600">Admin access required to modify system settings.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
