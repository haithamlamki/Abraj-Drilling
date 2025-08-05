import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, Download, Filter, TrendingUp, Clock, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { NptReport, Rig, System } from "@shared/schema";

interface DashboardStats {
  totalReports: number;
  pendingReports: number;
  approvedReports: number;
  totalHours: number;
  avgHoursPerReport: number;
  topRigs: Array<{ rigNumber: number; totalHours: number; reportCount: number }>;
  nptTypeDistribution: Array<{ type: string; hours: number; count: number }>;
  monthlyTrends: Array<{ month: string; hours: number; count: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ReportsPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRig, setSelectedRig] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [deleteReportId, setDeleteReportId] = useState<number | null>(null);

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

  // Fetch data
  const { data: reports = [] } = useQuery<NptReport[]>({ 
    queryKey: ['/api/npt-reports'],
    enabled: isAuthenticated 
  });
  
  const { data: rigs = [] } = useQuery<Rig[]>({ 
    queryKey: ['/api/rigs'],
    enabled: isAuthenticated 
  });

  const { data: systems = [] } = useQuery<System[]>({ 
    queryKey: ['/api/systems'],
    enabled: isAuthenticated 
  });

  const { data: dashboardStats } = useQuery<DashboardStats>({ 
    queryKey: ['/api/dashboard/reports-stats'],
    enabled: isAuthenticated 
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => 
      apiRequest('DELETE', `/api/npt-reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/reports-stats'] });
      toast({ title: "Success", description: "Report deleted successfully" });
      setDeleteReportId(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete report",
        variant: "destructive"
      });
    },
  });

  // Filter reports based on selected criteria
  const filteredReports = reports.filter(report => {
    if (selectedRig !== "all" && report.rigId !== parseInt(selectedRig)) return false;
    if (selectedMonth !== "all" && report.month !== selectedMonth) return false;
    if (selectedYear !== "all" && report.year !== parseInt(selectedYear)) return false;
    if (selectedStatus !== "all" && report.status !== selectedStatus) return false;
    return true;
  });

  // Calculate filtered stats
  const filteredStats = {
    totalReports: filteredReports.length,
    totalHours: filteredReports.reduce((sum, report) => sum + parseFloat(report.hours), 0),
    byNptType: filteredReports.reduce((acc, report) => {
      const hours = parseFloat(report.hours);
      acc[report.nptType] = (acc[report.nptType] || 0) + hours;
      return acc;
    }, {} as Record<string, number>),
    byStatus: filteredReports.reduce((acc, report) => {
      const status = report.status || 'draft';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const pieChartData = Object.entries(filteredStats.byNptType).map(([type, hours]) => ({
    name: type,
    value: hours,
    percentage: ((hours / filteredStats.totalHours) * 100).toFixed(1)
  }));

  const barChartData = Object.entries(filteredStats.byStatus).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count
  }));

  const handleExportReports = async () => {
    try {
      const queryParams = new URLSearchParams({
        rig: selectedRig,
        month: selectedMonth,
        year: selectedYear,
        status: selectedStatus
      });
      
      const response = await fetch(`/api/reports/export?${queryParams}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `npt-reports-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Reports exported successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export reports",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  const years = Array.from(new Set(reports.map(r => r.year))).sort((a, b) => b - a);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                <h1 className="text-3xl font-bold">Reports Dashboard</h1>
              </div>
              <Button onClick={handleExportReports} data-testid="button-export-reports">
                <Download className="h-4 w-4 mr-2" />
                Export Reports
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium">Rig</label>
                    <Select value={selectedRig} onValueChange={setSelectedRig}>
                      <SelectTrigger data-testid="select-rig-filter">
                        <SelectValue placeholder="Select Rig" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Rigs</SelectItem>
                        {rigs.map((rig) => (
                          <SelectItem key={rig.id} value={rig.id.toString()}>
                            Rig {rig.rigNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Year</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger data-testid="select-year-filter">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Month</label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger data-testid="select-month-filter">
                        <SelectValue placeholder="Select Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {months.map((month) => (
                          <SelectItem key={month} value={month}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Reports</p>
                      <p className="text-2xl font-bold">{filteredStats.totalReports}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Hours</p>
                      <p className="text-2xl font-bold">{filteredStats.totalHours.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-bold">{filteredStats.byStatus.pending || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Approved</p>
                      <p className="text-2xl font-bold">{filteredStats.byStatus.approved || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>NPT Hours by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`${value} hours`, 'Hours']} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reports by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Reports Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Rig</TableHead>
                      <TableHead>NPT Type</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>System</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.slice(0, 10).map((report) => {
                      const rig = rigs.find(r => r.id === report.rigId);
                      const system = systems.find(s => s.name === report.system);
                      return (
                        <TableRow key={report.id}>
                          <TableCell>{new Date(report.date).toLocaleDateString()}</TableCell>
                          <TableCell>Rig {rig?.rigNumber}</TableCell>
                          <TableCell>{report.nptType}</TableCell>
                          <TableCell>{report.hours}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                report.status === 'approved' ? 'default' :
                                report.status === 'pending' ? 'secondary' :
                                report.status === 'rejected' ? 'destructive' : 'outline'
                              }
                            >
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{system?.name || report.system || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.location.href = `/npt-reports?edit=${report.id}`}
                                data-testid={`button-view-report-${report.id}`}
                              >
                                View
                              </Button>
                              {user?.role?.toLowerCase() === 'admin' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteReportId(report.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`button-delete-report-${report.id}`}
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
                {filteredReports.length > 10 && (
                  <div className="mt-4 text-center">
                    <Button 
                      variant="outline"
                      onClick={() => window.location.href = '/npt-reports'}
                      data-testid="button-view-all-reports"
                    >
                      View All Reports ({filteredReports.length})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    
    <AlertDialog open={!!deleteReportId} onOpenChange={(open) => !open && setDeleteReportId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete NPT Report</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this report? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteReportId && deleteReportMutation.mutate(deleteReportId)}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}