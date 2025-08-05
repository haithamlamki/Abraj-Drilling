import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Play, Edit } from "lucide-react";
import type { NptReport, User } from "@shared/schema";

interface WorkflowStatusProps {
  report: NptReport;
  currentUser: User;
  onRefresh?: () => void;
}

export function WorkflowStatus({ report, currentUser, onRefresh }: WorkflowStatusProps) {
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string }>({ open: false, action: '' });
  const [comments, setComments] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: approvalHistory = [] } = useQuery<any[]>({
    queryKey: [`/api/npt-reports/${report.id}/workflow-history`],
    enabled: !!report.workflowStatus && report.workflowStatus !== 'draft',
  });

  const initiateWorkflowMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/npt-reports/${report.id}/initiate-workflow`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Workflow initiated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      onRefresh?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate workflow",
        variant: "destructive",
      });
    },
  });

  const workflowActionMutation = useMutation({
    mutationFn: async ({ action, comments }: { action: string; comments?: string }) => {
      await apiRequest(`/api/npt-reports/${report.id}/workflow-action`, 'POST', { action, comments });
    },
    onSuccess: (_, { action }) => {
      toast({
        title: "Success",
        description: `Report ${action}ed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: [`/api/npt-reports/${report.id}/workflow-history`] });
      setActionDialog({ open: false, action: '' });
      setComments('');
      onRefresh?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process action",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending_approval':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="mr-1 h-3 w-3" />Pending Approval</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-blue-600"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const canInitiateWorkflow = () => {
    return currentUser.role === 'tool_pusher' && (!report.workflowStatus || report.workflowStatus === 'draft');
  };

  const canPerformAction = () => {
    if (!report.currentApprover || !currentUser.role) return false;
    return report.currentApprover === currentUser.role && report.workflowStatus === 'pending_approval';
  };

  const handleAction = (action: string) => {
    if (action === 'reject') {
      setActionDialog({ open: true, action });
    } else {
      workflowActionMutation.mutate({ action, comments: '' });
    }
  };

  const handleConfirmReject = () => {
    if (!comments.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }
    workflowActionMutation.mutate({ action: 'reject', comments });
  };

  return (
    <Card data-testid="card-workflow-status">
      <CardHeader>
        <CardTitle>Workflow Status</CardTitle>
        <CardDescription>Review and approval process</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Current Status</Label>
            <div className="mt-1">{getStatusBadge(report.workflowStatus)}</div>
          </div>
          {report.currentApprover && (
            <div>
              <Label>Awaiting Approval From</Label>
              <div className="mt-1 font-medium">{report.currentApprover.replace('_', ' ').toUpperCase()}</div>
            </div>
          )}
        </div>



        {report.rejectionReason && (
          <div className="p-3 bg-red-50 rounded-md">
            <Label className="text-red-700">Rejection Reason</Label>
            <p className="mt-1 text-sm">{report.rejectionReason}</p>
          </div>
        )}

        <div className="flex gap-2">
          {canInitiateWorkflow() && (
            <Button
              onClick={() => initiateWorkflowMutation.mutate()}
              disabled={initiateWorkflowMutation.isPending}
              data-testid="button-initiate-workflow"
            >
              <Play className="mr-2 h-4 w-4" />
              Initiate Workflow
            </Button>
          )}

          {canPerformAction() && (
            <>
              <Button
                onClick={() => handleAction('approve')}
                disabled={workflowActionMutation.isPending}
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-approve"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                onClick={() => handleAction('reject')}
                disabled={workflowActionMutation.isPending}
                variant="destructive"
                data-testid="button-reject"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={() => handleAction('edit')}
                disabled={workflowActionMutation.isPending}
                variant="outline"
                data-testid="button-edit"
              >
                <Edit className="mr-2 h-4 w-4" />
                Request Edit
              </Button>
            </>
          )}
        </div>

        {approvalHistory && approvalHistory.length > 0 && (
          <div className="mt-6">
            <Label>Approval History</Label>
            <div className="mt-2 space-y-2">
              {approvalHistory.map((approval: any, index: number) => (
                <div key={index} className="p-2 bg-gray-50 rounded-md text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{approval.approverRole?.replace('_', ' ').toUpperCase()}</span>
                    <span className="text-muted-foreground">
                      {new Date(approval.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Badge
                      variant={approval.action === 'approve' ? 'default' : approval.action === 'reject' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {approval.action.toUpperCase()}
                    </Badge>
                    {approval.comments && (
                      <p className="mt-1 text-muted-foreground">{approval.comments}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Report</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Enter the reason for rejection..."
                className="mt-2"
                rows={4}
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ open: false, action: '' })}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={!comments.trim() || workflowActionMutation.isPending}
              data-testid="button-confirm-reject"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}