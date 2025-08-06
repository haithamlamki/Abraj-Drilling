import { db } from "./db";
import { users, workflowDefinitions, workflowSteps, nptReports, nptApprovals, delegations, roleAssignments } from "@shared/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import type { WorkflowStep, NptReport, User, Delegation, RoleAssignment } from "@shared/schema";

export interface EffectiveApprover {
  id: string;
  name: string;
  email?: string;
  roleKey?: string;
  isDelegated?: boolean;
  delegatorName?: string;
}

export class ApprovalService {
  /**
   * Resolve effective approvers considering delegations
   */
  async resolveEffectiveApprovers(opts: {
    rigId: number;
    roleKey?: string;
    explicitUserId?: string;
    at?: Date;
  }): Promise<EffectiveApprover[]> {
    const now = opts.at ?? new Date();

    // Base approvers from role or explicit user
    let baseUsers: EffectiveApprover[] = [];
    
    if (opts.explicitUserId) {
      const [user] = await db
        .select({ id: users.id, name: users.firstName, email: users.email })
        .from(users)
        .where(eq(users.id, opts.explicitUserId));
      
      if (user) {
        baseUsers = [{
          id: user.id,
          name: user.name || user.email || 'Unknown User',
          email: user.email || undefined
        }];
      }
    } else if (opts.roleKey) {
      // Get users assigned to this role for this rig
      const assignments = await db
        .select({
          userId: roleAssignments.userId,
          userName: users.firstName,
          userEmail: users.email
        })
        .from(roleAssignments)
        .innerJoin(users, eq(users.id, roleAssignments.userId))
        .where(
          and(
            eq(roleAssignments.rigId, opts.rigId),
            eq(roleAssignments.roleKey, opts.roleKey),
            eq(roleAssignments.isActive, true)
          )
        );

      baseUsers = assignments.map(a => ({
        id: a.userId,
        name: a.userName || a.userEmail || 'Unknown User',
        email: a.userEmail || undefined,
        roleKey: opts.roleKey
      }));
    }

    if (baseUsers.length === 0) return [];

    // Apply delegations
    const userIds = baseUsers.map(u => u.id);
    const activeDelegations = await db
      .select({
        delegatorUserId: delegations.delegatorUserId,
        delegateUserId: delegations.delegateUserId,
        delegateName: users.firstName,
        delegateEmail: users.email
      })
      .from(delegations)
      .innerJoin(users, eq(users.id, delegations.delegateUserId))
      .where(
        and(
          inArray(delegations.delegatorUserId, userIds),
          eq(delegations.isActive, true),
          lte(delegations.startsAt, now),
          gte(delegations.endsAt, now),
          // Delegation applies to this rig (null = all rigs)
          delegations.rigId === null ? undefined : eq(delegations.rigId, opts.rigId)
        )
      );

    const delegatedMap = new Map<string, EffectiveApprover>();
    activeDelegations.forEach(d => {
      const originalUser = baseUsers.find(u => u.id === d.delegatorUserId);
      delegatedMap.set(d.delegatorUserId, {
        id: d.delegateUserId,
        name: d.delegateName || d.delegateEmail || 'Delegate',
        email: d.delegateEmail || undefined,
        roleKey: originalUser?.roleKey,
        isDelegated: true,
        delegatorName: originalUser?.name
      });
    });

    // Return effective approvers (delegated or original)
    const effective = baseUsers.map(user => 
      delegatedMap.get(user.id) || user
    );

    // Remove duplicates by ID
    return Array.from(new Map(effective.map(u => [u.id, u])).values());
  }

  /**
   * Compute the next approver for a report based on workflow definition
   */
  async computeNextApprover(reportId: number): Promise<{
    stepOrder: number;
    userId: string;
    approver: EffectiveApprover;
  } | null> {
    const [report] = await db
      .select()
      .from(nptReports)
      .where(eq(nptReports.id, reportId));

    if (!report) return null;

    // Get workflow definition (rig-specific first, then global)
    const workflow = await db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.isActive, true),
          report.rigId ? eq(workflowDefinitions.rigId, report.rigId) : undefined
        )
      )
      .orderBy(workflowDefinitions.rigId) // Prefer rig-specific over null (global)
      .limit(1);

    if (workflow.length === 0) return null;

    // Get workflow steps
    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, workflow[0].id))
      .orderBy(workflowSteps.stepOrder);

    // Get completed approval steps
    const completedApprovals = await db
      .select({ stepOrder: nptApprovals.stepOrder })
      .from(nptApprovals)
      .where(eq(nptApprovals.reportId, reportId));

    const completedOrders = new Set(completedApprovals.map(a => a.stepOrder));

    // Find next required step
    const nextStep = steps.find(s => 
      s.isRequired && !completedOrders.has(s.stepOrder)
    );

    if (!nextStep) return null;

    // Resolve effective approvers for this step
    const effective = await this.resolveEffectiveApprovers({
      rigId: report.rigId,
      roleKey: nextStep.approverType === "role" ? nextStep.roleKey || undefined : undefined,
      explicitUserId: nextStep.approverType === "user" ? nextStep.userId || undefined : undefined
    });

    // Choose first available user (could be extended with load balancing)
    const approver = effective[0];
    if (!approver) return null;

    // Update report with current approver
    await db
      .update(nptReports)
      .set({
        currentStepOrder: nextStep.stepOrder,
        currentApproverUserId: approver.id
      })
      .where(eq(nptReports.id, reportId));

    return {
      stepOrder: nextStep.stepOrder,
      userId: approver.id,
      approver
    };
  }

  /**
   * Process approval action and route to next step if needed
   */
  async processApproval(opts: {
    reportId: number;
    userId: string;
    action: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
    comment?: string;
  }): Promise<{ success: boolean; finalStatus?: string; nextApprover?: EffectiveApprover }> {
    const { reportId, userId, action, comment } = opts;

    // Verify current approver
    const [report] = await db
      .select()
      .from(nptReports)
      .where(eq(nptReports.id, reportId));

    if (!report || report.currentApproverUserId !== userId) {
      return { success: false };
    }

    // Record the approval
    await db.insert(nptApprovals).values({
      reportId,
      stepOrder: report.currentStepOrder!,
      approverUserId: userId,
      action,
      comment: comment || null
    });

    if (action === "REJECT") {
      // Reject the report - stop workflow
      await db
        .update(nptReports)
        .set({
          status: "REJECTED",
          currentStepOrder: null,
          currentApproverUserId: null
        })
        .where(eq(nptReports.id, reportId));

      return { success: true, finalStatus: "REJECTED" };
    }

    if (action === "APPROVE") {
      // Try to route to next step
      const nextRouting = await this.computeNextApprover(reportId);
      
      if (!nextRouting) {
        // No more steps - mark as approved
        await db
          .update(nptReports)
          .set({
            status: "APPROVED",
            currentStepOrder: null,
            currentApproverUserId: null
          })
          .where(eq(nptReports.id, reportId));

        return { success: true, finalStatus: "APPROVED" };
      } else {
        return { success: true, nextApprover: nextRouting.approver };
      }
    }

    return { success: true };
  }

  /**
   * Get approval history for a report
   */
  async getApprovalHistory(reportId: number) {
    return await db
      .select({
        id: nptApprovals.id,
        stepOrder: nptApprovals.stepOrder,
        action: nptApprovals.action,
        comment: nptApprovals.comment,
        createdAt: nptApprovals.createdAt,
        approverName: users.firstName,
        approverEmail: users.email
      })
      .from(nptApprovals)
      .innerJoin(users, eq(users.id, nptApprovals.approverUserId))
      .where(eq(nptApprovals.reportId, reportId))
      .orderBy(nptApprovals.createdAt);
  }
}

export const approvalService = new ApprovalService();