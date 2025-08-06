import { storage } from "./storage";
import type { 
  MonthlyReport, 
  InsertMonthlyReport, 
  StageEvent,
  InsertStageEvent,
  DaySlice,
  InsertDaySlice,
  Notification,
  InsertNotification
} from "@shared/schema";

export class LifecycleService {
  // Create or get existing monthly report
  async getOrCreateMonthlyReport(month: string, rigId: number, createdBy: string): Promise<MonthlyReport> {
    const existing = await storage.getMonthlyReportByMonthAndRig(month, rigId);
    
    if (existing) {
      return existing;
    }

    // Create new monthly report
    const newReport: InsertMonthlyReport = {
      month,
      rigId,
      createdBy,
      status: 'Draft',
      slaDays: 7,
      totalHours: '0',
      contractualHours: '0',
      operationalHours: '0',
      abrajHours: '0'
    };

    const report = await storage.createMonthlyReport(newReport);
    
    // Create initial stage event
    await this.createStageEvent(report.id, 'Created', createdBy, `Monthly report created for ${month}`);
    
    return report;
  }

  // Transition report to different stages
  async submitReport(reportId: number, userId: string, comments?: string): Promise<MonthlyReport> {
    const report = await storage.getMonthlyReport(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (report.status !== 'Draft') {
      throw new Error('Only draft reports can be submitted');
    }

    const updatedReport = await storage.updateMonthlyReport(reportId, {
      status: 'Submitted',
      submittedAt: new Date()
    });

    await this.createStageEvent(reportId, 'Submitted', userId, comments || 'Report submitted for review');
    
    // Create notification for approvers
    await this.notifyApprovers(reportId, 'pending_approval', 'New monthly NPT report submitted for approval');

    return updatedReport;
  }

  async approveReport(reportId: number, userId: string, comments?: string): Promise<MonthlyReport> {
    const report = await storage.getMonthlyReport(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (!['Submitted', 'In_Review'].includes(report.status)) {
      throw new Error('Only submitted or in-review reports can be approved');
    }

    const updatedReport = await storage.updateMonthlyReport(reportId, {
      status: 'Approved',
      approvedBy: userId,
      approvedAt: new Date()
    });

    await this.createStageEvent(reportId, 'Approved', userId, comments || 'Report approved');
    
    // Notify report creator
    await this.createNotification({
      reportId,
      rule: 'approval_complete',
      recipient: report.createdBy,
      message: `Your monthly NPT report for ${report.month} has been approved`,
      channel: 'in_app'
    });

    return updatedReport;
  }

  async rejectReport(reportId: number, userId: string, reason: string): Promise<MonthlyReport> {
    const report = await storage.getMonthlyReport(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (!['Submitted', 'In_Review'].includes(report.status)) {
      throw new Error('Only submitted or in-review reports can be rejected');
    }

    const updatedReport = await storage.updateMonthlyReport(reportId, {
      status: 'Rejected',
      rejectionReason: reason
    });

    await this.createStageEvent(reportId, 'Rejected', userId, reason);
    
    // Notify report creator
    await this.createNotification({
      reportId,
      rule: 'report_rejected',
      recipient: report.createdBy,
      message: `Your monthly NPT report for ${report.month} has been rejected: ${reason}`,
      channel: 'in_app'
    });

    return updatedReport;
  }

  async resubmitReport(reportId: number, userId: string, comments?: string): Promise<MonthlyReport> {
    const report = await storage.getMonthlyReport(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (report.status !== 'Rejected') {
      throw new Error('Only rejected reports can be resubmitted');
    }

    const updatedReport = await storage.updateMonthlyReport(reportId, {
      status: 'Submitted',
      submittedAt: new Date(),
      rejectionReason: null
    });

    await this.createStageEvent(reportId, 'Resubmitted', userId, comments || 'Report resubmitted after revision');
    
    // Notify approvers again
    await this.notifyApprovers(reportId, 'pending_approval', 'Monthly NPT report has been resubmitted for approval');

    return updatedReport;
  }

  // Day slice management
  async updateDaySlice(reportId: number, date: Date, data: Partial<DaySlice>, updatedBy: string): Promise<DaySlice> {
    const slice = await storage.upsertDaySlice(reportId, date, {
      ...data,
      updatedBy
    });

    // Update monthly totals if hours changed
    if (data.hours !== undefined) {
      await this.recalculateMonthlyTotals(reportId);
    }

    return slice;
  }

  async linkNptReportToDay(reportId: number, date: Date, nptReportIds: number[], updatedBy: string): Promise<DaySlice> {
    return await storage.upsertDaySlice(reportId, date, {
      nptReportIds: JSON.stringify(nptReportIds),
      dayStatus: 'Draft',
      updatedBy
    });
  }

  // Utility methods
  private async createStageEvent(reportId: number, stage: string, byUser: string, comments?: string): Promise<StageEvent> {
    return await storage.createStageEvent({
      reportId,
      stage,
      byUser,
      comments
    });
  }

  private async createNotification(notification: InsertNotification): Promise<Notification> {
    return await storage.createNotification(notification);
  }

  private async notifyApprovers(reportId: number, rule: string, message: string): Promise<void> {
    // Get all supervisors and admins for notifications
    const users = await storage.getAllUsers();
    const approvers = users.filter(user => ['admin', 'supervisor'].includes(user.role?.toLowerCase() || ''));

    for (const approver of approvers) {
      await this.createNotification({
        reportId,
        rule,
        recipient: approver.id,
        message,
        channel: 'in_app'
      });
    }
  }

  private async recalculateMonthlyTotals(reportId: number): Promise<void> {
    const daySlices = await storage.getDaySlices(reportId);
    
    let totalHours = 0;
    let contractualHours = 0;
    let operationalHours = 0;
    let abrajHours = 0;

    for (const slice of daySlices) {
      const hours = parseFloat(slice.hours || '0');
      totalHours += hours;

      switch (slice.nptType?.toLowerCase()) {
        case 'contractual':
          contractualHours += hours;
          break;
        case 'operational':
          operationalHours += hours;
          break;
        case 'abraj':
          abrajHours += hours;
          break;
      }
    }

    await storage.updateMonthlyReport(reportId, {
      totalHours: totalHours.toString(),
      contractualHours: contractualHours.toString(),
      operationalHours: operationalHours.toString(),
      abrajHours: abrajHours.toString()
    });
  }

  // Analytics and reporting
  async getKPIs(filters?: { rigId?: number; startMonth?: string; endMonth?: string }): Promise<{
    totalReports: number;
    totalNptHours: number;
    approvedOnTime: number;
    averageReviewTime: number;
    overSlaCount: number;
  }> {
    const reports = await storage.getMonthlyReports(filters);
    
    const totalReports = reports.length;
    const totalNptHours = reports.reduce((sum, r) => sum + parseFloat(r.totalHours || '0'), 0);
    
    let approvedOnTime = 0;
    let totalReviewTime = 0;
    let reviewedReports = 0;
    let overSlaCount = 0;

    for (const report of reports) {
      if (report.status === 'Approved' && report.submittedAt && report.approvedAt) {
        const reviewTime = (new Date(report.approvedAt).getTime() - new Date(report.submittedAt).getTime()) / (1000 * 60 * 60 * 24);
        totalReviewTime += reviewTime;
        reviewedReports++;

        if (reviewTime <= (report.slaDays || 7)) {
          approvedOnTime++;
        } else {
          overSlaCount++;
        }
      }
    }

    return {
      totalReports,
      totalNptHours,
      approvedOnTime: totalReports > 0 ? (approvedOnTime / totalReports) * 100 : 0,
      averageReviewTime: reviewedReports > 0 ? totalReviewTime / reviewedReports : 0,
      overSlaCount
    };
  }

  async getTimelineData(reportId: number): Promise<{
    report: MonthlyReport;
    daySlices: DaySlice[];
    stageEvents: StageEvent[];
  }> {
    const [report, daySlices, stageEvents] = await Promise.all([
      storage.getMonthlyReport(reportId),
      storage.getDaySlices(reportId),
      storage.getStageEvents(reportId)
    ]);

    if (!report) {
      throw new Error('Report not found');
    }

    return { report, daySlices, stageEvents };
  }

  // Alert system
  async checkSlaAlerts(): Promise<void> {
    const pendingReports = await storage.getMonthlyReports({ status: 'Submitted' });
    const now = new Date();

    for (const report of pendingReports) {
      if (report.submittedAt) {
        const daysSinceSubmission = (now.getTime() - new Date(report.submittedAt).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceSubmission > (report.slaDays || 7)) {
          // Create over-SLA notification
          await this.createNotification({
            reportId: report.id,
            rule: 'over_sla',
            recipient: report.createdBy,
            message: `Monthly NPT report for ${report.month} is overdue for approval (${Math.floor(daysSinceSubmission)} days)`,
            channel: 'in_app'
          });

          // Notify approvers too
          await this.notifyApprovers(report.id, 'over_sla', `Monthly NPT report for ${report.month} is overdue for approval`);
        }
      }
    }
  }

  async checkStallAlerts(): Promise<void> {
    const activeReports = await storage.getMonthlyReports({ status: 'Submitted' });
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const report of activeReports) {
      const latestEvent = await storage.getLatestStageEvent(report.id);
      
      if (latestEvent && new Date(latestEvent.createdAt) < twentyFourHoursAgo) {
        await this.createNotification({
          reportId: report.id,
          rule: 'stalled',
          recipient: report.createdBy,
          message: `Monthly NPT report for ${report.month} has been stalled for over 24 hours`,
          channel: 'in_app'
        });
      }
    }
  }
}

export const lifecycleService = new LifecycleService();