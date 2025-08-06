import { db } from "../db";
import { workflowDefinitions, workflowSteps, nptReports, nptApprovals, roleAssignments, delegations, users } from "@shared/schema";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";
import { ROLE_KEYS } from "@shared/workflow";

interface WorkflowStep {
  id: number;
  stepOrder: number;
  approverType: 'role' | 'user';
  roleKey?: string;
  userId?: string;
  isRequired: boolean;
}

interface ActiveDelegation {
  delegateUserId: string;
  delegatedFromUserId: string;
}

/**
 * Pick the appropriate workflow for a given rig
 * First looks for rig-specific workflow, falls back to global default
 */
export async function pickWorkflow(rigId: number): Promise<{ id: number; steps: WorkflowStep[] } | null> {
  try {
    // First try rig-specific workflow
    let workflow = await db.query.workflowDefinitions.findFirst({
      where: and(
        eq(workflowDefinitions.rigId, rigId),
        eq(workflowDefinitions.isActive, true)
      ),
      with: {
        steps: {
          orderBy: [workflowSteps.stepOrder]
        }
      }
    });

    // Fallback to global workflow
    if (!workflow) {
      workflow = await db.query.workflowDefinitions.findFirst({
        where: and(
          isNull(workflowDefinitions.rigId),
          eq(workflowDefinitions.isActive, true)
        ),
        with: {
          steps: {
            orderBy: [workflowSteps.stepOrder]
          }
        }
      });
    }

    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      return null;
    }

    return {
      id: workflow.id,
      steps: workflow.steps as WorkflowStep[]
    };
  } catch (error) {
    console.error("Error picking workflow:", error);
    return null;
  }
}

/**
 * List steps for a given workflow ID
 */
export async function listSteps(workflowId: number): Promise<WorkflowStep[]> {
  try {
    const steps = await db.query.workflowSteps.findMany({
      where: eq(workflowSteps.workflowId, workflowId),
      orderBy: [workflowSteps.stepOrder]
    });

    return steps as WorkflowStep[];
  } catch (error) {
    console.error("Error listing workflow steps:", error);
    return [];
  }
}

/**
 * Apply delegation rules to find the effective approver
 */
async function applyDelegation(rigId: number, nominalUserId: string, roleKey?: string): Promise<ActiveDelegation | null> {
  try {
    const now = new Date();
    
    const delegation = await db.query.delegations.findFirst({
      where: and(
        eq(delegations.delegatorUserId, nominalUserId),
        eq(delegations.isActive, true),
        lte(delegations.startsAt, now),
        gte(delegations.endsAt, now),
        // Rig constraint: delegation.rigId must be null (all rigs) or match the report's rig
        delegations.rigId ? eq(delegations.rigId, rigId) : isNull(delegations.rigId),
        // Role constraint: delegation.roleKey must be null (all roles) or match the step's role
        roleKey && delegations.roleKey ? eq(delegations.roleKey, roleKey) : undefined
      )
    });

    if (delegation) {
      return {
        delegateUserId: delegation.delegateUserId,
        delegatedFromUserId: delegation.delegatorUserId
      };
    }

    return null;
  } catch (error) {
    console.error("Error applying delegation:", error);
    return null;
  }
}

/**
 * Resolve a step to find the nominal and effective approver
 */
async function resolveApprover(step: WorkflowStep, rigId: number): Promise<{
  nominalUserId: string | null;
  effectiveUserId: string | null;
  delegatedFrom: string | null;
}> {
  let nominalUserId: string | null = null;

  if (step.approverType === 'user' && step.userId) {
    nominalUserId = step.userId;
  } else if (step.approverType === 'role' && step.roleKey) {
    // Find user assigned to this role for this rig
    const roleAssignment = await db.query.roleAssignments.findFirst({
      where: and(
        eq(roleAssignments.rigId, rigId),
        eq(roleAssignments.roleKey, step.roleKey),
        eq(roleAssignments.isActive, true)
      )
    });

    if (roleAssignment) {
      nominalUserId = roleAssignment.userId;
    }
  }

  if (!nominalUserId) {
    return {
      nominalUserId: null,
      effectiveUserId: null,
      delegatedFrom: null
    };
  }

  // Apply delegation
  const delegation = await applyDelegation(rigId, nominalUserId, step.roleKey);
  
  return {
    nominalUserId,
    effectiveUserId: delegation?.delegateUserId || nominalUserId,
    delegatedFrom: delegation?.delegatedFromUserId || null
  };
}

/**
 * Route report to first approver in workflow
 * Sets current_step_order, current_nominal_user_id, current_approver_user_id
 */
export async function routeFirstApprover(reportId: number): Promise<boolean> {
  try {
    // Get report details
    const report = await db.query.nptReports.findFirst({
      where: eq(nptReports.id, reportId)
    });

    if (!report) {
      console.error("Report not found:", reportId);
      return false;
    }

    // Get workflow
    const workflow = await pickWorkflow(report.rigId);
    if (!workflow || !workflow.steps.length) {
      console.error("No workflow found for rig:", report.rigId);
      return false;
    }

    // Get first step
    const firstStep = workflow.steps[0];
    const { nominalUserId, effectiveUserId, delegatedFrom } = await resolveApprover(firstStep, report.rigId);

    if (!effectiveUserId) {
      console.error("Cannot resolve approver for first step");
      return false;
    }

    // Update report with routing pointers
    await db.update(nptReports)
      .set({
        currentStepOrder: firstStep.stepOrder,
        currentNominalUserId: nominalUserId,
        currentApproverUserId: effectiveUserId,
        status: 'PENDING_REVIEW'
      })
      .where(eq(nptReports.id, reportId));

    return true;
  } catch (error) {
    console.error("Error routing first approver:", error);
    return false;
  }
}

/**
 * Advance to next step in workflow
 * If no more steps, marks report as APPROVED
 */
export async function advanceToNextStep(reportId: number): Promise<boolean> {
  try {
    // Get current report state
    const report = await db.query.nptReports.findFirst({
      where: eq(nptReports.id, reportId)
    });

    if (!report || !report.currentStepOrder) {
      console.error("Report or current step not found");
      return false;
    }

    // Get workflow
    const workflow = await pickWorkflow(report.rigId);
    if (!workflow || !workflow.steps.length) {
      console.error("No workflow found for rig:", report.rigId);
      return false;
    }

    // Find next step
    const currentStep = workflow.steps.find(s => s.stepOrder === report.currentStepOrder);
    const nextStep = workflow.steps.find(s => s.stepOrder === report.currentStepOrder! + 1);

    if (!nextStep) {
      // No more steps - approve the report
      await db.update(nptReports)
        .set({
          status: 'APPROVED',
          currentStepOrder: null,
          currentNominalUserId: null,
          currentApproverUserId: null
        })
        .where(eq(nptReports.id, reportId));
      
      return true;
    }

    // Route to next step
    const { nominalUserId, effectiveUserId, delegatedFrom } = await resolveApprover(nextStep, report.rigId);

    if (!effectiveUserId) {
      console.error("Cannot resolve approver for next step");
      return false;
    }

    await db.update(nptReports)
      .set({
        currentStepOrder: nextStep.stepOrder,
        currentNominalUserId: nominalUserId,
        currentApproverUserId: effectiveUserId
      })
      .where(eq(nptReports.id, reportId));

    return true;
  } catch (error) {
    console.error("Error advancing to next step:", error);
    return false;
  }
}

/**
 * Record an approval action and advance workflow
 */
export async function recordApproval(
  reportId: number, 
  approverUserId: string, 
  action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
  comment?: string
): Promise<boolean> {
  try {
    // Get current report state
    const report = await db.query.nptReports.findFirst({
      where: eq(nptReports.id, reportId)
    });

    if (!report) {
      console.error("Report not found");
      return false;
    }

    // Determine delegation context
    const delegatedFrom = report.currentNominalUserId !== approverUserId ? report.currentNominalUserId : null;

    // Record the approval
    await db.insert(nptApprovals).values({
      reportId,
      stepOrder: report.currentStepOrder || 1,
      approverUserId,
      delegatedFromUserId: delegatedFrom,
      action,
      comment
    });

    if (action === 'APPROVE') {
      // Advance to next step
      await advanceToNextStep(reportId);
    } else if (action === 'REJECT') {
      // Mark as rejected
      await db.update(nptReports)
        .set({
          status: 'REJECTED',
          currentStepOrder: null,
          currentNominalUserId: null,
          currentApproverUserId: null
        })
        .where(eq(nptReports.id, reportId));
    }
    // For REQUEST_CHANGES, leave routing pointers as-is

    return true;
  } catch (error) {
    console.error("Error recording approval:", error);
    return false;
  }
}

/**
 * Get reports pending approval for a specific user
 */
export async function getPendingApprovalsForUser(userId: string): Promise<any[]> {
  try {
    const reports = await db.query.nptReports.findMany({
      where: and(
        eq(nptReports.status, 'PENDING_REVIEW'),
        eq(nptReports.currentApproverUserId, userId)
      ),
      with: {
        rig: true
      }
    });

    return reports;
  } catch (error) {
    console.error("Error getting pending approvals:", error);
    return [];
  }
}