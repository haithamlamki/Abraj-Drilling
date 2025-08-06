import { db } from "../db";
import { 
  workflowDefinitions, 
  workflowSteps, 
  roleAssignments, 
  delegations, 
  nptReports, 
  nptApprovals,
  users
} from "@shared/schema";
import { ROLE_KEYS, NPT_STATUS, type RoleKey } from "@shared/workflow";
import { eq, and, isNull, gte, lte, desc, asc } from "drizzle-orm";

export interface WorkflowApprovalService {
  pickWorkflow(rigId: number): Promise<any>;
  listSteps(workflowId: number): Promise<any[]>;
  routeFirstApprover(reportId: number): Promise<any>;
  advanceToNextStep(reportId: number): Promise<any>;
}

export class DatabaseWorkflowApprovalService implements WorkflowApprovalService {
  
  async pickWorkflow(rigId: number) {
    // First try to find rig-specific workflow, then fall back to global (rigId = null)
    const workflow = await db.query.workflowDefinitions.findFirst({
      where: and(
        eq(workflowDefinitions.isActive, true),
        eq(workflowDefinitions.rigId, rigId)
      )
    });

    if (workflow) return workflow;

    // Fall back to global workflow
    return db.query.workflowDefinitions.findFirst({
      where: and(
        eq(workflowDefinitions.isActive, true),
        isNull(workflowDefinitions.rigId)
      )
    });
  }

  async listSteps(workflowId: number) {
    return db.query.workflowSteps.findMany({
      where: eq(workflowSteps.workflowId, workflowId),
      orderBy: [asc(workflowSteps.stepOrder)]
    });
  }

  private async resolveNominalUser(rigId: number, step: any): Promise<string | null> {
    if (step.approverType === "user" && step.userId) {
      return step.userId;
    }
    
    if (step.approverType === "role" && step.roleKey) {
      const assignment = await db.query.roleAssignments.findFirst({
        where: and(
          eq(roleAssignments.rigId, rigId),
          eq(roleAssignments.roleKey, step.roleKey),
          eq(roleAssignments.isActive, true)
        )
      });
      return assignment?.userId ?? null;
    }
    
    return null;
  }

  private async applyDelegation(nominalUserId: string | null, rigId: number, roleKey?: string) {
    if (!nominalUserId) {
      return { effectiveUserId: null, delegatedFrom: null };
    }

    const now = new Date();
    
    const delegation = await db.query.delegations.findFirst({
      where: and(
        eq(delegations.delegatorUserId, nominalUserId),
        eq(delegations.isActive, true),
        lte(delegations.startsAt, now),
        gte(delegations.endsAt, now),
        // Check rig scope (null means all rigs)
        delegations.rigId === null ? undefined : eq(delegations.rigId, rigId),
        // Check role scope (null means all roles)
        delegations.roleKey === null ? undefined : eq(delegations.roleKey, roleKey ?? "")
      ),
      orderBy: [desc(delegations.createdAt)]
    });

    if (delegation) {
      return { 
        effectiveUserId: delegation.delegateUserId, 
        delegatedFrom: nominalUserId 
      };
    }

    return { 
      effectiveUserId: nominalUserId, 
      delegatedFrom: null 
    };
  }

  async routeFirstApprover(reportId: number) {
    const report = await db.query.nptReports.findFirst({
      where: eq(nptReports.id, reportId)
    });

    if (!report) return null;

    // Get workflow for this rig
    const workflow = await this.pickWorkflow(report.rigId);
    let steps: any[] = [];

    if (workflow) {
      steps = await this.listSteps(workflow.id);
    }

    // Fallback to default role workflow if no custom workflow
    if (!steps.length) {
      steps = ROLE_KEYS.map((roleKey, index) => ({
        stepOrder: index + 1,
        approverType: "role",
        roleKey,
        userId: null,
        isRequired: true
      }));
    }

    // Find first assignable step
    for (const step of steps) {
      const nominalUserId = await this.resolveNominalUser(report.rigId, step);
      const { effectiveUserId, delegatedFrom } = await this.applyDelegation(
        nominalUserId, 
        report.rigId, 
        step.roleKey
      );

      if (effectiveUserId) {
        // Update report with routing information
        await db.update(nptReports)
          .set({
            currentStepOrder: step.stepOrder,
            currentNominalUserId: nominalUserId,
            currentApproverUserId: effectiveUserId,
            status: NPT_STATUS.PENDING_REVIEW
          })
          .where(eq(nptReports.id, reportId));

        return {
          stepOrder: step.stepOrder,
          nominalUserId,
          effectiveUserId,
          roleKey: step.roleKey || null,
          delegatedFrom
        };
      }
    }

    // No assignable approver found
    await db.update(nptReports)
      .set({
        currentStepOrder: 1,
        currentNominalUserId: null,
        currentApproverUserId: null,
        status: NPT_STATUS.PENDING_REVIEW
      })
      .where(eq(nptReports.id, reportId));

    return null;
  }

  async advanceToNextStep(reportId: number) {
    const report = await db.query.nptReports.findFirst({
      where: eq(nptReports.id, reportId)
    });

    if (!report) return null;

    // Get workflow for this rig
    const workflow = await this.pickWorkflow(report.rigId);
    let steps: any[] = [];

    if (workflow) {
      steps = await this.listSteps(workflow.id);
    } else {
      // Default role workflow
      steps = ROLE_KEYS.map((roleKey, index) => ({
        stepOrder: index + 1,
        approverType: "role",
        roleKey,
        userId: null
      }));
    }

    // Find next step
    const currentStep = report.currentStepOrder || 0;
    const nextStep = steps.find(s => s.stepOrder > currentStep);

    if (!nextStep) {
      // No more steps - mark as approved
      await db.update(nptReports)
        .set({
          status: NPT_STATUS.APPROVED,
          currentStepOrder: null,
          currentNominalUserId: null,
          currentApproverUserId: null
        })
        .where(eq(nptReports.id, reportId));

      return null;
    }

    // Route to next step
    const nominalUserId = await this.resolveNominalUser(report.rigId, nextStep);
    const { effectiveUserId } = await this.applyDelegation(
      nominalUserId,
      report.rigId,
      nextStep.roleKey
    );

    await db.update(nptReports)
      .set({
        currentStepOrder: nextStep.stepOrder,
        currentNominalUserId: nominalUserId,
        currentApproverUserId: effectiveUserId
      })
      .where(eq(nptReports.id, reportId));

    return {
      stepOrder: nextStep.stepOrder,
      userId: effectiveUserId
    };
  }

  async recordApproval(reportId: number, userId: string, action: string, comment?: string, delegatedFrom?: string) {
    const report = await db.query.nptReports.findFirst({
      where: eq(nptReports.id, reportId)
    });

    if (!report) throw new Error("Report not found");

    // Record the approval action
    await db.insert(nptApprovals).values({
      reportId,
      stepOrder: report.currentStepOrder || 1,
      approverUserId: userId,
      delegatedFromUserId: delegatedFrom || null,
      action,
      comment
    });

    if (action === "APPROVE") {
      return this.advanceToNextStep(reportId);
    } else if (action === "REJECT") {
      // Reject - set status and clear routing
      await db.update(nptReports)
        .set({
          status: NPT_STATUS.REJECTED,
          rejectionReason: comment,
          currentStepOrder: null,
          currentNominalUserId: null,
          currentApproverUserId: null
        })
        .where(eq(nptReports.id, reportId));

      return null;
    }

    return null;
  }
}

export const workflowApprovalService = new DatabaseWorkflowApprovalService();