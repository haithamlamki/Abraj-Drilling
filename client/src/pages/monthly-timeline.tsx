import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Calendar, Clock, User, FileText, Edit, Save, X } from "lucide-react";

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
  createdAt: string;
  updatedAt: string;
}

interface DaySlice {
  id: number;
  reportId: number;
  date: string;
  dayStatus: 'No-Entry' | 'Draft' | 'Submitted' | 'In_Review' | 'Approved';
  hours: string;
  nptType?: string;
  notes?: string;
  nptReportIds?: string;
  lastUpdated: string;
  updatedBy?: string;
}

interface StageEvent {
  id: number;
  reportId: number;
  stage: string;
  byUser: string;
  comments?: string;
  createdAt: string;
}

interface TimelineData {
  report: MonthlyReport;
  daySlices: DaySlice[];
  stageEvents: StageEvent[];
}

export default function MonthlyTimeline() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingDay, setEditingDay] = useState<Date | null>(null);
  const [dayData, setDayData] = useState({
    hours: '',
    nptType: '',
    notes: '',
    dayStatus: 'Draft' as const
  });

  // Fetch timeline data
  const { data: timelineData, isLoading } = useQuery<TimelineData>({
    queryKey: [`/api/monthly-reports/${id}/timeline`],
    enabled: !!id
  });

  // Update day slice mutation
  const updateDayMutation = useMutation({
    mutationFn: ({ reportId, date, data }: { reportId: number; date: string; data: any }) =>
      apiRequest(`/api/monthly-reports/${reportId}/days/${date}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/monthly-reports/${id}/timeline`] });
      toast({ title: "Success", description: "Day updated successfully" });
      setEditingDay(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update day", 
        variant: "destructive" 
      });
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!timelineData) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Monthly report not found</p>
            <Link href="/monthly-reports">
              <Button className="mt-4">Back to Reports</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { report, daySlices, stageEvents } = timelineData;
  
  // Generate all days of the month
  const monthDate = new Date(report.month + '-01');
  const monthDays = eachDayOfInterval({
    start: startOfMonth(monthDate),
    end: endOfMonth(monthDate)
  });

  // Create a map of day slices by date
  const daySliceMap = new Map(
    daySlices.map(slice => [format(new Date(slice.date), 'yyyy-MM-dd'), slice])
  );

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const slice = daySliceMap.get(dateStr);
    return slice?.dayStatus || 'No-Entry';
  };

  const getDayHours = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const slice = daySliceMap.get(dateStr);
    return slice?.hours || '0';
  };

  const getDaySlice = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return daySliceMap.get(dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'No-Entry': return 'bg-gray-100 border-gray-200';
      case 'Draft': return 'bg-yellow-100 border-yellow-300';
      case 'Submitted': return 'bg-blue-100 border-blue-300';
      case 'In_Review': return 'bg-orange-100 border-orange-300';
      case 'Approved': return 'bg-green-100 border-green-300';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const handleEditDay = (date: Date) => {
    const slice = getDaySlice(date);
    setDayData({
      hours: slice?.hours || '',
      nptType: slice?.nptType || '',
      notes: slice?.notes || '',
      dayStatus: slice?.dayStatus || 'Draft'
    });
    setEditingDay(date);
  };

  const handleSaveDay = () => {
    if (!editingDay) return;
    
    updateDayMutation.mutate({
      reportId: report.id,
      date: format(editingDay, 'yyyy-MM-dd'),
      data: dayData
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="monthly-timeline-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/monthly-reports">
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Timeline - {report.month}</h1>
            <p className="text-muted-foreground">Daily granularity view with progress tracking</p>
          </div>
        </div>
        <Badge variant={report.status === 'Approved' ? 'default' : 'secondary'} className="text-sm">
          {report.status}
        </Badge>
      </div>

      {/* Report Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Report Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-2xl font-bold" data-testid="summary-total-hours">{report.totalHours}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contractual</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="summary-contractual-hours">{report.contractualHours}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Operational</p>
              <p className="text-2xl font-bold text-orange-600" data-testid="summary-operational-hours">{report.operationalHours}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Abraj</p>
              <p className="text-2xl font-bold text-purple-600" data-testid="summary-abraj-hours">{report.abrajHours}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Timeline - {format(monthDate, 'MMMM yyyy')}
          </CardTitle>
          <CardDescription>
            Click on any day to edit details. Colors represent status: Gray (No Entry), Yellow (Draft), Blue (Submitted), Green (Approved)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-medium text-sm text-muted-foreground p-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map(date => {
              const status = getDayStatus(date);
              const hours = getDayHours(date);
              const slice = getDaySlice(date);
              
              return (
                <div
                  key={format(date, 'yyyy-MM-dd')}
                  className={`
                    border-2 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all
                    ${getStatusColor(status)}
                  `}
                  onClick={() => handleEditDay(date)}
                  data-testid={`day-${format(date, 'yyyy-MM-dd')}`}
                >
                  <div className="text-center space-y-1">
                    <div className="font-medium">{format(date, 'd')}</div>
                    <div className="text-xs">
                      <div className={`
                        px-1 py-0.5 rounded text-xs font-medium
                        ${status === 'No-Entry' ? 'bg-gray-200 text-gray-600' : ''}
                        ${status === 'Draft' ? 'bg-yellow-200 text-yellow-700' : ''}
                        ${status === 'Submitted' ? 'bg-blue-200 text-blue-700' : ''}
                        ${status === 'Approved' ? 'bg-green-200 text-green-700' : ''}
                      `}>
                        {status}
                      </div>
                    </div>
                    {parseFloat(hours) > 0 && (
                      <div className="text-xs font-medium">{hours}h</div>
                    )}
                    {slice?.nptType && (
                      <div className="text-xs text-muted-foreground">
                        {slice.nptType}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stage Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Stage Events
          </CardTitle>
          <CardDescription>Audit trail of all report lifecycle events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stageEvents.map(event => (
              <div
                key={event.id}
                className="flex items-start gap-4 p-4 border rounded-lg"
                data-testid={`stage-event-${event.id}`}
              >
                <div className="flex-shrink-0">
                  <div className={`
                    w-3 h-3 rounded-full
                    ${event.stage === 'Created' ? 'bg-gray-400' : ''}
                    ${event.stage === 'Submitted' ? 'bg-blue-400' : ''}
                    ${event.stage === 'Approved' ? 'bg-green-400' : ''}
                    ${event.stage === 'Rejected' ? 'bg-red-400' : ''}
                    ${event.stage === 'Resubmitted' ? 'bg-orange-400' : ''}
                  `}></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{event.stage}</span>
                    <span className="text-sm text-muted-foreground">
                      by {event.byUser}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(event.createdAt), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  {event.comments && (
                    <p className="text-sm text-muted-foreground">{event.comments}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Day Dialog */}
      <Dialog open={!!editingDay} onOpenChange={() => setEditingDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Day - {editingDay && format(editingDay, 'MMM dd, yyyy')}
            </DialogTitle>
            <DialogDescription>
              Update the details for this specific day
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Hours</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="24"
                placeholder="0"
                value={dayData.hours}
                onChange={(e) => setDayData({ ...dayData, hours: e.target.value })}
                data-testid="input-day-hours"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">NPT Type</label>
              <Select value={dayData.nptType} onValueChange={(value) => setDayData({ ...dayData, nptType: value })}>
                <SelectTrigger data-testid="select-npt-type">
                  <SelectValue placeholder="Select NPT Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="Contractual">Contractual</SelectItem>
                  <SelectItem value="Operational">Operational</SelectItem>
                  <SelectItem value="Abraj">Abraj</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={dayData.dayStatus} onValueChange={(value: any) => setDayData({ ...dayData, dayStatus: value })}>
                <SelectTrigger data-testid="select-day-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No-Entry">No Entry</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="In_Review">In Review</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Add any notes for this day..."
                value={dayData.notes}
                onChange={(e) => setDayData({ ...dayData, notes: e.target.value })}
                data-testid="textarea-day-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDay(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveDay}
              disabled={updateDayMutation.isPending}
              data-testid="button-save-day"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}