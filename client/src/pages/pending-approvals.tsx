import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, MessageSquare, Clock, User, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface PendingApproval {
  id: number;
  date: string;
  hours: string;
  nptType: string;
  status: string;
  currentStepOrder: number;
  rigName: string;
  submittedBy: string;
  isDelegated: boolean;
  delegatedFrom: string | null;
  problem: string;
  system: string;
  equipment: string;
}

interface ApprovalAction {
  action: string;
  createdAt: string;
  stepOrder: number;
  comment: string;
  report: {
    id: number;
    date: string;
    hours: string;
    nptType: string;
    status: string;
    rigName: string;
  };
}

type ActionType = 'approve' | 'reject' | 'request-changes';

export default function PendingApprovals() {
  const [selectedReport, setSelectedReport] = useState<PendingApproval | null>(null);
  const [actionType, setActionType] = useState<ActionType>('approve');
  const [comment, setComment] = useState('');
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending approvals
  const { data: pendingData, isLoading: pendingLoading } = useQuery<{ items: PendingApproval[] }>({
    queryKey: ['/api/my-approvals/pending'],
  });

  // Fetch approval history
  const { data: historyData, isLoading: historyLoading } = useQuery<{ actions: ApprovalAction[] }>({
    queryKey: ['/api/my-approvals/history'],
  });

  // Action mutation
  const actionMutation = useMutation({
    mutationFn: async ({ reportId, action, comment }: { reportId: number; action: ActionType; comment: string }) => {
      return apiRequest(`/api/approvals/${reportId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-approvals/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-approvals/history'] });
      setActionModalOpen(false);
      setComment('');
      setSelectedReport(null);
      toast({
        title: "Success",
        description: `Report ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'returned for changes'} successfully`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process approval action",
        variant: "destructive"
      });
    }
  });

  const handleAction = (report: PendingApproval, action: ActionType) => {
    setSelectedReport(report);
    setActionType(action);
    setActionModalOpen(true);
  };

  const submitAction = () => {
    if (!selectedReport) return;
    
    actionMutation.mutate({
      reportId: selectedReport.id,
      action: actionType,
      comment
    });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'APPROVE': return 'text-green-600';
      case 'REJECT': return 'text-red-600';
      case 'REQUEST_CHANGES': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'APPROVE': return <CheckCircle className="h-4 w-4" />;
      case 'REJECT': return <XCircle className="h-4 w-4" />;
      case 'REQUEST_CHANGES': return <MessageSquare className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Pending Approvals</h1>
          <p className="text-muted-foreground">
            NPT reports waiting for your review and approval
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {pendingData?.items?.length || 0} Pending
        </Badge>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingData?.items?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            History ({historyData?.actions?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Reports Waiting for Your Approval</CardTitle>
              <CardDescription>
                These NPT reports require your review and action
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="text-center py-8">Loading pending approvals...</div>
              ) : pendingData?.items?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending approvals</p>
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Rig</TableHead>
                      <TableHead>NPT Type</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Problem</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingData?.items?.map((item: PendingApproval) => (
                      <TableRow key={item.id} data-testid={`row-approval-${item.id}`}>
                        <TableCell className="font-medium">
                          {format(new Date(item.date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>{item.rigName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.nptType}</Badge>
                        </TableCell>
                        <TableCell>{item.hours}h</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.problem || item.system || 'No description'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {item.submittedBy}
                            {item.isDelegated && (
                              <Badge variant="secondary" className="ml-2">
                                Delegated from {item.delegatedFrom}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Step {item.currentStepOrder}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleAction(item, 'approve')}
                              className="bg-green-600 hover:bg-green-700"
                              data-testid={`button-approve-${item.id}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(item, 'request-changes')}
                              data-testid={`button-changes-${item.id}`}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleAction(item, 'reject')}
                              data-testid={`button-reject-${item.id}`}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>My Approval History</CardTitle>
              <CardDescription>
                Your recent approval actions and decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-8">Loading approval history...</div>
              ) : historyData?.actions?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No approval history</p>
                  <p className="text-sm">Your approval actions will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Report</TableHead>
                      <TableHead>Rig</TableHead>
                      <TableHead>NPT Type</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Comment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.actions?.map((action: ApprovalAction, index: number) => (
                      <TableRow key={index} data-testid={`row-history-${index}`}>
                        <TableCell>
                          {format(new Date(action.createdAt), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 ${getActionColor(action.action)}`}>
                            {getActionIcon(action.action)}
                            {action.action.replace('_', ' ')}
                          </div>
                        </TableCell>
                        <TableCell>#{action.report.id}</TableCell>
                        <TableCell>{action.report.rigName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{action.report.nptType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Step {action.stepOrder}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {action.comment || 'No comment'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent data-testid="dialog-approval-action">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Report' : 
               actionType === 'reject' ? 'Reject Report' : 'Request Changes'}
            </DialogTitle>
            <DialogDescription>
              {selectedReport && (
                <>
                  Report #{selectedReport.id} - {selectedReport.rigName} - {selectedReport.nptType}
                  <br />
                  {format(new Date(selectedReport.date), 'MMMM dd, yyyy')} - {selectedReport.hours} hours
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="comment">
                Comment {actionType === 'request-changes' ? '(Required)' : '(Optional)'}
              </Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  actionType === 'approve' ? 'Optional approval comment...' :
                  actionType === 'reject' ? 'Reason for rejection...' :
                  'Describe what changes are needed...'
                }
                data-testid="textarea-comment"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitAction}
              disabled={actionMutation.isPending || (actionType === 'request-changes' && !comment.trim())}
              className={
                actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                'bg-yellow-600 hover:bg-yellow-700'
              }
              data-testid="button-submit-action"
            >
              {actionMutation.isPending ? 'Processing...' : 
               actionType === 'approve' ? 'Approve' :
               actionType === 'reject' ? 'Reject' : 'Request Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}