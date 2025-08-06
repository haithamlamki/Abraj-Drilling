import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, Plus, Eye, FileText, TrendingUp } from "lucide-react";

interface MonthlyReport {
  id: number;
  month: string;
  rigId: number;
  createdBy: string;
  status: 'Draft' | 'Submitted' | 'In_Review' | 'Approved' | 'Rejected';
  slaDays: number;
  totalHours: string;
  contractualHours: string;
  operationalHours: string;
  abrajHours: string;
  notes?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Rig {
  id: number;
  rigNumber: number;
  section: string;
  client?: string;
  location?: string;
  isActive: boolean;
}

interface KPIs {
  totalReports: number;
  totalNptHours: number;
  approvedOnTime: number;
  averageReviewTime: number;
  overSlaCount: number;
}

export default function MonthlyReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedRig, setSelectedRig] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'submit' | 'approve' | 'reject' | 'resubmit'>('submit');
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch monthly reports
  const { data: reports = [] } = useQuery<MonthlyReport[]>({
    queryKey: ['/api/monthly-reports', selectedRig, selectedStatus, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRig && selectedRig !== 'all') params.append('rigId', selectedRig);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedMonth) params.append('month', selectedMonth);
      
      const response = await apiRequest('GET', `/api/monthly-reports?${params.toString()}`);
      return response.json();
    }
  });

  // Fetch rigs for filtering
  const { data: rigs = [] } = useQuery<Rig[]>({
    queryKey: ['/api/rigs']
  });

  // Fetch KPIs
  const { data: kpis } = useQuery<KPIs>({
    queryKey: ['/api/lifecycle/kpis', selectedRig],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRig && selectedRig !== 'all') params.append('rigId', selectedRig);
      const response = await apiRequest('GET', `/api/lifecycle/kpis?${params.toString()}`);
      return response.json();
    }
  });

  // Mutations for report actions
  const submitMutation = useMutation({
    mutationFn: ({ reportId, comments }: { reportId: number; comments?: string }) =>
      apiRequest('POST', `/api/monthly-reports/${reportId}/submit`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monthly-reports'] });
      toast({ title: "Success", description: "Report submitted successfully" });
      setActionDialogOpen(false);
    }
  });

  const approveMutation = useMutation({
    mutationFn: ({ reportId, comments }: { reportId: number; comments?: string }) =>
      apiRequest('POST', `/api/monthly-reports/${reportId}/approve`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monthly-reports'] });
      toast({ title: "Success", description: "Report approved successfully" });
      setActionDialogOpen(false);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ reportId, reason }: { reportId: number; reason: string }) =>
      apiRequest('POST', `/api/monthly-reports/${reportId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monthly-reports'] });
      toast({ title: "Success", description: "Report rejected" });
      setActionDialogOpen(false);
    }
  });

  const resubmitMutation = useMutation({
    mutationFn: ({ reportId, comments }: { reportId: number; comments?: string }) =>
      apiRequest('POST', `/api/monthly-reports/${reportId}/resubmit`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monthly-reports'] });
      toast({ title: "Success", description: "Report resubmitted successfully" });
      setActionDialogOpen(false);
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Draft': return <FileText className="h-4 w-4" />;
      case 'Submitted': return <Clock className="h-4 w-4" />;
      case 'In_Review': return <AlertTriangle className="h-4 w-4" />;
      case 'Approved': return <CheckCircle className="h-4 w-4" />;
      case 'Rejected': return <XCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'secondary';
      case 'Submitted': return 'default';
      case 'In_Review': return 'secondary';
      case 'Approved': return 'default';
      case 'Rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const handleAction = (report: MonthlyReport, action: typeof actionType) => {
    setSelectedReport(report);
    setActionType(action);
    setComments('');
    setRejectionReason('');
    setActionDialogOpen(true);
  };

  const performAction = () => {
    if (!selectedReport) return;

    switch (actionType) {
      case 'submit':
        submitMutation.mutate({ reportId: selectedReport.id, comments });
        break;
      case 'approve':
        approveMutation.mutate({ reportId: selectedReport.id, comments });
        break;
      case 'reject':
        if (!rejectionReason.trim()) {
          toast({ title: "Error", description: "Rejection reason is required", variant: "destructive" });
          return;
        }
        rejectMutation.mutate({ reportId: selectedReport.id, reason: rejectionReason });
        break;
      case 'resubmit':
        resubmitMutation.mutate({ reportId: selectedReport.id, comments });
        break;
    }
  };

  const canPerformAction = (report: MonthlyReport, action: string) => {
    const isOwner = report.createdBy === user?.id;
    const isApprover = ['admin', 'supervisor'].includes(user?.role?.toLowerCase() || '');

    switch (action) {
      case 'submit':
        return isOwner && report.status === 'Draft';
      case 'approve':
        return isApprover && ['Submitted', 'In_Review'].includes(report.status);
      case 'reject':
        return isApprover && ['Submitted', 'In_Review'].includes(report.status);
      case 'resubmit':
        return isOwner && report.status === 'Rejected';
      default:
        return false;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="monthly-reports-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monthly NPT Reports</h1>
          <p className="text-muted-foreground">Track the full lifecycle of monthly NPT reports with daily granularity</p>
        </div>
        <Link href="/monthly-reports/new">
          <Button data-testid="button-create-monthly-report">
            <Plus className="h-4 w-4 mr-2" />
            Create Monthly Report
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-total-reports">{kpis.totalReports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total NPT Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-total-hours">{kpis.totalNptHours.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Approval</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-on-time">{kpis.approvedOnTime.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Review Time</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-review-time">{kpis.averageReviewTime.toFixed(1)} days</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Over SLA</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="kpi-over-sla">{kpis.overSlaCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Rig</label>
              <Select value={selectedRig} onValueChange={setSelectedRig}>
                <SelectTrigger data-testid="select-rig-filter">
                  <SelectValue placeholder="All Rigs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rigs</SelectItem>
                  {rigs.map((rig) => (
                    <SelectItem key={rig.id} value={rig.id.toString()}>
                      Rig {rig.rigNumber} - {rig.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="In_Review">In Review</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Month</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                data-testid="input-month-filter"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRig('all');
                  setSelectedStatus('all');
                  setSelectedMonth('');
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Reports ({reports.length})</CardTitle>
          <CardDescription>Manage and track your monthly NPT reports through their lifecycle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                data-testid={`report-card-${report.id}`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{report.month}</h3>
                      <Badge variant={getStatusColor(report.status)} className="flex items-center gap-1">
                        {getStatusIcon(report.status)}
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Rig {rigs.find(r => r.id === report.rigId)?.rigNumber} • 
                      Total: {report.totalHours}h •
                      Created: {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                    </p>
                    {report.rejectionReason && (
                      <p className="text-sm text-red-600">
                        Rejected: {report.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/monthly-reports/${report.id}/timeline`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-timeline-${report.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Timeline
                      </Button>
                    </Link>
                    
                    {canPerformAction(report, 'submit') && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(report, 'submit')}
                        data-testid={`button-submit-${report.id}`}
                      >
                        Submit
                      </Button>
                    )}
                    
                    {canPerformAction(report, 'approve') && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAction(report, 'approve')}
                        data-testid={`button-approve-${report.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    
                    {canPerformAction(report, 'reject') && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleAction(report, 'reject')}
                        data-testid={`button-reject-${report.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    )}
                    
                    {canPerformAction(report, 'resubmit') && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(report, 'resubmit')}
                        data-testid={`button-resubmit-${report.id}`}
                      >
                        Resubmit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No monthly reports found. Create your first monthly report to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'submit' && 'Submit Report'}
              {actionType === 'approve' && 'Approve Report'}
              {actionType === 'reject' && 'Reject Report'}
              {actionType === 'resubmit' && 'Resubmit Report'}
            </DialogTitle>
            <DialogDescription>
              {selectedReport && `${actionType === 'reject' ? 'Reject' : 'Confirm action for'} monthly report for ${selectedReport.month}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {actionType === 'reject' ? (
              <div>
                <label className="text-sm font-medium">Rejection Reason *</label>
                <Textarea
                  placeholder="Please provide a reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  data-testid="textarea-rejection-reason"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Comments (Optional)</label>
                <Textarea
                  placeholder="Add any comments..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  data-testid="textarea-comments"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={performAction}
              disabled={
                submitMutation.isPending ||
                approveMutation.isPending ||
                rejectMutation.isPending ||
                resubmitMutation.isPending ||
                (actionType === 'reject' && !rejectionReason.trim())
              }
              data-testid="button-confirm-action"
            >
              {actionType === 'submit' && 'Submit'}
              {actionType === 'approve' && 'Approve'}
              {actionType === 'reject' && 'Reject'}
              {actionType === 'resubmit' && 'Resubmit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}