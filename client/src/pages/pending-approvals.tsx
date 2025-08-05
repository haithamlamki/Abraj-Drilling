import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Clock, FileText, CheckCircle, XCircle } from "lucide-react";
import type { NptReport } from "@shared/schema";
import { format } from "date-fns";

export default function PendingApprovals() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");

  const { data: pendingReports, isLoading: pendingLoading } = useQuery<NptReport[]>({
    queryKey: ['/api/npt-reports/pending-approval'],
  });

  const { data: allReports } = useQuery<NptReport[]>({
    queryKey: ['/api/npt-reports'],
  });

  const approvedReports = allReports?.filter(r => r.workflowStatus === 'approved') || [];
  const rejectedReports = allReports?.filter(r => r.workflowStatus === 'rejected') || [];

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending_approval':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const ReportCard = ({ report }: { report: NptReport }) => (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => setLocation(`/npt-reports/${report.id}`)}
      data-testid={`card-report-${report.id}`}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              Rig {report.rigId} - {report.nptType}
            </CardTitle>
            <CardDescription>
              {format(new Date(report.date), 'PPP')} • {report.hours} hours
            </CardDescription>
          </div>
          {getStatusBadge(report.workflowStatus)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">System:</span> {report.system}
          </div>
          <div>
            <span className="font-medium">Equipment:</span> {report.equipment}
          </div>
          {report.causes && (
            <div>
              <span className="font-medium">Causes:</span> {report.causes.substring(0, 100)}
              {report.causes.length > 100 && '...'}
            </div>
          )}
          {report.currentApprover && (
            <div className="mt-3 pt-3 border-t">
              <span className="font-medium">Awaiting:</span>{' '}
              <Badge variant="outline">
                {report.currentApprover.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          )}
        </div>
        <div className="mt-4">
          <Button 
            className="w-full" 
            variant="outline"
            data-testid={`button-review-${report.id}`}
          >
            <FileText className="mr-2 h-4 w-4" />
            Review Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Please log in to view pending approvals.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canViewApprovals = ['tool_pusher', 'ds', 'ose', 'pme', 'admin', 'supervisor'].includes(user.role || '');

  if (!canViewApprovals) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to view approval workflows.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approval Workflows</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve NPT reports in the workflow pipeline
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending Approval ({pendingReports?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved ({approvedReports.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            Rejected ({rejectedReports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pendingLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading pending reports...</p>
            </div>
          ) : pendingReports && pendingReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  No reports pending your approval.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          {approvedReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  No approved reports found.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          {rejectedReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rejectedReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  No rejected reports found.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}