import type { NptReport, User, WorkflowApproval } from "@shared/schema";
import { storage } from "./storage";

export interface WorkflowState {
  canApprove: boolean;
  canEdit: boolean;
  canReject: boolean;
  nextApprover?: string;
  currentStage: string;
}

export class WorkflowService {
  // Define workflow paths
  private readonly drillingPath = ['tool_pusher', 'ds', 'ose'];
  private readonly maintenancePath = ['tool_pusher', 'pme', 'ds', 'ose'];

  // Get the workflow path based on department
  private getWorkflowPath(department: string): string[] {
    if (department === 'E.Maintenance' || department === 'E-Maintenance') {
      return this.maintenancePath;
    }
    return this.drillingPath;
  }

  // Get the next approver role in the workflow
  private getNextApprover(currentRole: string, path: string[]): string | null {
    const currentIndex = path.indexOf(currentRole);
    if (currentIndex === -1 || currentIndex === path.length - 1) {
      return null;
    }
    return path[currentIndex + 1];
  }

  // Map user roles to workflow roles
  private mapUserRoleToWorkflowRole(userRole: string): string {
    const roleMapping: Record<string, string> = {
      'Tool Pusher': 'tool_pusher',
      'tool_pusher': 'tool_pusher',
      'Drilling Supervisor': 'ds',
      'DS': 'ds',
      'ds': 'ds',
      'PME': 'pme',
      'pme': 'pme',
      'E-Maintenance Engineer': 'pme',
      'OSE': 'ose',
      'ose': 'ose',
      'Operation Support Engineer': 'ose',
    };
    return roleMapping[userRole] || userRole.toLowerCase();
  }

  // Initialize workflow for a new report
  async initializeWorkflow(report: NptReport, initiatorId: string): Promise<void> {
    const path = this.getWorkflowPath(report.department || 'Drilling');
    const nextApprover = path[1]; // Skip tool_pusher, go to next

    await storage.updateNptReport(report.id, {
      workflowStatus: 'pending_' + nextApprover,
      currentApprover: nextApprover,
      workflowPath: report.department === 'E.Maintenance' ? 'e-maintenance' : 'drilling',
      initiatedBy: initiatorId,
      initiatedAt: new Date(),
    });

    // Log the initiation
    await storage.createWorkflowApproval({
      reportId: report.id,
      approverId: initiatorId,
      approverRole: 'tool_pusher',
      action: 'initiate',
      comments: 'Report initiated for approval workflow',
    });
  }

  // Process approval action
  async processApproval(
    reportId: number,
    approverId: string,
    userRole: string,
    action: 'approve' | 'reject' | 'edit',
    comments?: string,
    editedData?: Partial<NptReport>
  ): Promise<void> {
    const report = await storage.getNptReport(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    const workflowRole = this.mapUserRoleToWorkflowRole(userRole);
    const path = this.getWorkflowPath(report.department || 'Drilling');

    // Verify user can perform this action
    if (report.currentApprover !== workflowRole) {
      throw new Error('You are not authorized to approve this report at this stage');
    }

    // Create approval record
    await storage.createWorkflowApproval({
      reportId,
      approverId,
      approverRole: workflowRole,
      action,
      comments,
      editedFields: editedData ? Object.keys(editedData) : null,
      previousValues: editedData ? await this.getPreviousValues(report, editedData) : null,
    });

    // Update report based on action
    if (action === 'approve') {
      const nextApprover = this.getNextApprover(workflowRole, path);
      
      if (nextApprover) {
        // Move to next approver
        await storage.updateNptReport(reportId, {
          workflowStatus: 'pending_' + nextApprover,
          currentApprover: nextApprover,
          ...editedData,
        });
      } else {
        // Final approval
        await storage.updateNptReport(reportId, {
          workflowStatus: 'approved',
          currentApprover: null,
          status: 'Approved',
          ...editedData,
        });
      }
    } else if (action === 'reject') {
      await storage.updateNptReport(reportId, {
        workflowStatus: 'rejected',
        status: 'Rejected',
        rejectionReason: comments || '',
      });
    } else if (action === 'edit' && editedData) {
      // Edit without changing workflow status
      await storage.updateNptReport(reportId, editedData);
    }
  }

  // Get previous values for audit trail
  private async getPreviousValues(
    report: NptReport,
    editedData: Partial<NptReport>
  ): Promise<any> {
    const previousValues: any = {};
    for (const key of Object.keys(editedData)) {
      previousValues[key] = (report as any)[key];
    }
    return previousValues;
  }

  // Check if user can perform actions on report
  async getUserWorkflowState(
    reportId: number,
    userRole: string
  ): Promise<WorkflowState> {
    const report = await storage.getNptReport(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    const workflowRole = this.mapUserRoleToWorkflowRole(userRole);
    const isCurrentApprover = report.currentApprover === workflowRole;
    
    // Check if user can edit based on department
    const canEditDepartment = this.canEditDepartment(workflowRole, report.department || '');

    return {
      canApprove: isCurrentApprover && report.workflowStatus !== 'approved',
      canReject: isCurrentApprover && report.workflowStatus !== 'rejected',
      canEdit: isCurrentApprover && canEditDepartment,
      nextApprover: report.currentApprover,
      currentStage: report.workflowStatus || 'draft',
    };
  }

  // Check if role can edit specific department data
  private canEditDepartment(role: string, department: string): boolean {
    const editPermissions: Record<string, string[]> = {
      'tool_pusher': ['Drilling', 'E.Maintenance', 'E-Maintenance'], // Can initiate all
      'ds': ['Drilling'], // DS can only edit Drilling department
      'pme': ['E.Maintenance', 'E-Maintenance'], // PME can only edit E-Maintenance
      'ose': ['Drilling', 'E.Maintenance', 'E-Maintenance'], // OSE can edit all for final processing
    };

    const allowedDepartments = editPermissions[role] || [];
    return allowedDepartments.includes(department);
  }

  // Get workflow history for a report
  async getWorkflowHistory(reportId: number): Promise<WorkflowApproval[]> {
    return storage.getWorkflowApprovals(reportId);
  }

  // Get reports pending approval for a user
  async getPendingReports(userRole: string): Promise<NptReport[]> {
    const workflowRole = this.mapUserRoleToWorkflowRole(userRole);
    return storage.getReportsByApprover(workflowRole);
  }
}

export const workflowService = new WorkflowService();