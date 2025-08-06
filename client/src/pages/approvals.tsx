import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Eye, MessageSquare, Filter } from "lucide-react";
import type { NptReport, Rig, System } from "@shared/schema";
import { NPT_STATUS } from "@shared/status";

export default function ApprovalsPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<NptReport | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

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

  // Enhanced query with "Waiting On" information
  const { data: reports = [] } = useQuery({ 
    queryKey: ['/api/approvals/list', activeTab],
    queryFn: async () => {
      const status = activeTab === "pending" 
        ? NPT_STATUS.PENDING_REVIEW 
        : activeTab === "approved" 
          ? NPT_STATUS.APPROVED 
          : activeTab === "rejected"
            ? NPT_STATUS.REJECTED
            : NPT_STATUS.DRAFT;
      
      const response = await apiRequest(`/api/approvals/list?status=${status}`);
      return response.items || [];
    },
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

  // Reports are already filtered by status from the API
  const displayReports = reports;

  // Enhanced approval mutations using new workflow service
  const approveReportMutation = useMutation({
    mutationFn: async (reportId: number) => 
      apiRequest(`/api/approvals/${reportId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: "APPROVE" }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/approvals/list'] });
      setIsReviewDialogOpen(false);
      setSelectedReport(null);
      toast({
        title: "Success",
        description: data.message || "Report approved successfully"
      });
    },
  });

  const rejectReportMutation = useMutation({
    mutationFn: async ({ reportId, reason }: { reportId: number; reason: string }) => 
      apiRequest(`/api/approvals/${reportId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: "REJECT", comment: reason }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/approvals/list'] });
      setIsReviewDialogOpen(false);
      setSelectedReport(null);
      setRejectionReason("");
      toast({
        title: "Success",
        description: data.message || "Report rejected"
      });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async (reportId: number) => 
      apiRequest(`/api/npt-reports/${reportId}/submit`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      toast({
        title: "Success",
        description: "Report submitted for approval"
      });
    },
  });

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (user?.role !== 'admin' && user?.role !== 'supervisor') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 p-6">
            <Card>
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-gray-600">Only administrators and supervisors can access the approvals page.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const ReportsTable = ({ reports, showActions = true }: { reports: any[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Rig</TableHead>
          <TableHead>NPT Type</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>System</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Waiting On</TableHead>
          <TableHead>Submitted By</TableHead>
          {showActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => {
          const rig = rigs.find(r => r.id === report.rigId);
          const system = systems.find(s => s.name === report.system);
          return (
            <TableRow key={report.id}>
              <TableCell>{new Date(report.date).toLocaleDateString()}</TableCell>
              <TableCell>Rig {rig?.rigNumber}</TableCell>
              <TableCell>{report.nptType}</TableCell>
              <TableCell>{report.hours}</TableCell>
              <TableCell>{system?.name || report.system || '-'}</TableCell>
              <TableCell>{getStatusBadge(report.status || 'draft')}</TableCell>
              <TableCell>
                {report.waitingOn && report.status === NPT_STATUS.PENDING_REVIEW ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
                        {report.waitingOn.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{report.waitingOn}</span>
                      {report.waitingOnRole && (
                        <span className="text-xs text-gray-500 capitalize">{report.waitingOnRole}</span>
                      )}
                    </div>
                  </div>
                ) : "—"}
              </TableCell>
              <TableCell>{report.userId}</TableCell>
              {showActions && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedReport(report);
                        setIsReviewDialogOpen(true);
                      }}
                      data-testid={`button-review-${report.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                    {report.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => submitForApprovalMutation.mutate(report.id)}
                        disabled={submitForApprovalMutation.isPending}
                        data-testid={`button-submit-${report.id}`}
                      >
                        Submit
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
        {reports.length === 0 && (
          <TableRow>
            <TableCell colSpan={showActions ? 9 : 8} className="text-center py-8 text-gray-500">
              No reports found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  const ReviewDialog = () => (
    <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review NPT Report</DialogTitle>
        </DialogHeader>
        {selectedReport && (
          <div className="space-y-6">
            {/* Report Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Date</label>
                <p className="mt-1">{new Date(selectedReport.date).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Rig</label>
                <p className="mt-1">Rig {rigs.find(r => r.id === selectedReport.rigId)?.rigNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">NPT Type</label>
                <p className="mt-1">{selectedReport.nptType}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Hours</label>
                <p className="mt-1">{selectedReport.hours}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">System</label>
                <p className="mt-1">{selectedReport.system || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1">{getStatusBadge(selectedReport.status || 'draft')}</p>
              </div>
            </div>

            {/* Additional Details */}
            {selectedReport.nptType === 'Abraj' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Technical Details</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Part Equipment</label>
                    <p className="mt-1">{selectedReport.partEquipment || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Immediate Cause</label>
                    <p className="mt-1">{selectedReport.immediateCause || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Root Cause</label>
                    <p className="mt-1">{selectedReport.rootCause || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Corrective Action</label>
                    <p className="mt-1">{selectedReport.correctiveAction || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Future Action</label>
                    <p className="mt-1">{selectedReport.futureAction || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {selectedReport.nptType === 'Contractual' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Contractual Process</label>
                <p className="mt-1">{selectedReport.contractualProcess || '-'}</p>
              </div>
            )}

            {selectedReport.rejectionReason && (
              <div>
                <label className="text-sm font-medium text-gray-700">Rejection Reason</label>
                <p className="mt-1 text-red-600">{selectedReport.rejectionReason}</p>
              </div>
            )}

            {/* Actions */}
            {selectedReport.status === 'pending' && (
              <div className="flex gap-4 pt-4 border-t">
                <Button
                  onClick={() => approveReportMutation.mutate(selectedReport.id)}
                  disabled={approveReportMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                
                <div className="flex-1">
                  <Textarea
                    placeholder="Enter rejection reason..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="mb-2"
                    data-testid="textarea-rejection-reason"
                  />
                  <Button
                    variant="destructive"
                    onClick={() => rejectReportMutation.mutate({ 
                      reportId: selectedReport.id, 
                      reason: rejectionReason 
                    })}
                    disabled={rejectReportMutation.isPending || !rejectionReason.trim()}
                    data-testid="button-reject"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
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
                <CheckCircle className="h-6 w-6" />
                <h1 className="text-3xl font-bold">Approvals Management</h1>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending Review</p>
                      <p className="text-2xl font-bold">{displayReports.filter(r => r.status === NPT_STATUS.PENDING_REVIEW).length}</p>
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
                      <p className="text-2xl font-bold">—</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Rejected</p>
                      <p className="text-2xl font-bold">—</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <MessageSquare className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Drafts</p>
                      <p className="text-2xl font-bold">—</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reports Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending Review
                </TabsTrigger>
                <TabsTrigger value="approved" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Approved
                </TabsTrigger>
                <TabsTrigger value="rejected" className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Rejected
                </TabsTrigger>
                <TabsTrigger value="draft" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Draft
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <Card>
                  <CardHeader>
                    <CardTitle>Reports Pending Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReportsTable reports={displayReports} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="approved">
                <Card>
                  <CardHeader>
                    <CardTitle>Approved Reports</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReportsTable reports={displayReports} showActions={false} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rejected">
                <Card>
                  <CardHeader>
                    <CardTitle>Rejected Reports</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReportsTable reports={displayReports} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="draft">
                <Card>
                  <CardHeader>
                    <CardTitle>Draft Reports</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReportsTable reports={displayReports} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
      <ReviewDialog />
    </div>
  );
}