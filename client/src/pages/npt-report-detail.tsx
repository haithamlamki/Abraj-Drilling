import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { WorkflowStatus } from "@/components/workflow/workflow-status";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Clock, FileText } from "lucide-react";
import type { NptReport } from "@shared/schema";

export default function NptReportDetail() {
  const params = useParams();
  const reportId = params.id ? parseInt(params.id) : null;
  const { user } = useAuth();

  const { data: report, isLoading, refetch } = useQuery<NptReport>({
    queryKey: [`/api/npt-reports/${reportId}`],
    enabled: !!reportId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading report...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Report not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">NPT Report Details</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Report Information */}
          <Card>
            <CardHeader>
              <CardTitle>Report Information</CardTitle>
              <CardDescription>Detailed NPT report data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Report ID</p>
                  <p className="text-lg font-semibold">#{report.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rig Number</p>
                  <p className="text-lg font-semibold">{report.rigId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-lg font-semibold">
                    <Calendar className="inline mr-2 h-4 w-4" />
                    {format(new Date(report.date), 'PPP')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hours</p>
                  <p className="text-lg font-semibold">
                    <Clock className="inline mr-2 h-4 w-4" />
                    {report.hours} hours
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">NPT Type</p>
                  <Badge variant="outline" className="mt-1">{report.nptType}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge 
                    variant={report.status === 'Approved' ? 'default' : report.status === 'Rejected' ? 'destructive' : 'secondary'}
                    className="mt-1"
                  >
                    {report.status || 'Draft'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
              <CardDescription>Equipment and system information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.system && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">System</p>
                  <p className="mt-1">{report.system}</p>
                </div>
              )}
              {report.equipmentId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Equipment</p>
                  <p className="mt-1">{report.equipmentId}</p>
                </div>
              )}
              {report.thePart && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Part</p>
                  <p className="mt-1">{report.thePart}</p>
                </div>
              )}
              {report.department && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Department</p>
                  <p className="mt-1">{report.department}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Descriptions and Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Descriptions and Actions</CardTitle>
              <CardDescription>Failure analysis and corrective measures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.failureDesc && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failure Description</p>
                  <p className="mt-1 whitespace-pre-wrap">{report.failureDesc}</p>
                </div>
              )}
              {report.rootCause && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Root Causes</p>
                  <p className="mt-1 whitespace-pre-wrap">{report.rootCause}</p>
                </div>
              )}
              {report.corrective && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Corrective Measures</p>
                  <p className="mt-1 whitespace-pre-wrap">{report.corrective}</p>
                </div>
              )}
              {report.futureAction && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Future Action</p>
                  <p className="mt-1 whitespace-pre-wrap">{report.futureAction}</p>
                </div>
              )}
              {report.actionParty && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action Party</p>
                  <p className="mt-1">{report.actionParty}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          {(report.n2N || report.investigationB || report.wellName) && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.n2N && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">N2 Number</p>
                    <p className="mt-1">{report.n2N}</p>
                  </div>
                )}
                {report.investigationB && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Investigation</p>
                    <p className="mt-1">{report.investigationB}</p>
                  </div>
                )}
                {report.wellName && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Well Name</p>
                    <p className="mt-1">{report.wellName}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Workflow Status Sidebar */}
        <div className="lg:col-span-1">
          {user && (
            <WorkflowStatus 
              report={report} 
              currentUser={user}
              onRefresh={refetch}
            />
          )}
        </div>
      </div>
    </div>
  );
}