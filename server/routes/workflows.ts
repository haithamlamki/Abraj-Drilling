import { Router } from "express";
import { db } from "../db";
import { 
  workflowDefinitions, 
  workflowSteps, 
  roleAssignments, 
  delegations,
  users
} from "@shared/schema";
import { ROLE_KEYS, ROLE_LABELS } from "@shared/workflow";
import { eq, and, isNull } from "drizzle-orm";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Workflows CRUD
router.get("/api/workflows", isAuthenticated, async (req, res) => {
  try {
    const rigId = req.query.rigId ? Number(req.query.rigId) : null;
    
    let workflows;
    if (rigId) {
      workflows = await db.query.workflowDefinitions.findMany({
        where: eq(workflowDefinitions.rigId, rigId),
        with: {
          steps: {
            orderBy: (steps, { asc }) => [asc(steps.stepOrder)]
          }
        }
      });
    } else {
      workflows = await db.query.workflowDefinitions.findMany({
        where: isNull(workflowDefinitions.rigId),
        with: {
          steps: {
            orderBy: (steps, { asc }) => [asc(steps.stepOrder)]
          }
        }
      });
    }

    res.json({ items: workflows });
  } catch (error) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

router.post("/api/workflows", isAuthenticated, async (req, res) => {
  try {
    const { name, rigId } = req.body;
    
    const workflow = await db.insert(workflowDefinitions)
      .values({
        name,
        rigId: rigId || null,
        isActive: true
      })
      .returning();

    res.status(201).json(workflow[0]);
  } catch (error) {
    console.error("Error creating workflow:", error);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.post("/api/workflows/:id/steps/bulk", isAuthenticated, async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const { steps } = req.body;

    await db.transaction(async (tx) => {
      // Delete existing steps
      await tx.delete(workflowSteps)
        .where(eq(workflowSteps.workflowId, workflowId));

      // Insert new steps
      if (steps && steps.length > 0) {
        await tx.insert(workflowSteps)
          .values(steps.map((step: any) => ({
            workflowId,
            stepOrder: step.stepOrder,
            approverType: step.approverType,
            roleKey: step.roleKey || null,
            userId: step.userId || null,
            isRequired: step.isRequired ?? true
          })));
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating workflow steps:", error);
    res.status(500).json({ error: "Failed to update workflow steps" });
  }
});

// Role assignments (Role → User per rig)
router.get("/api/role-assignments", isAuthenticated, async (req, res) => {
  try {
    const rigId = Number(req.query.rigId);
    
    const assignments = await db.query.roleAssignments.findMany({
      where: and(
        eq(roleAssignments.rigId, rigId),
        eq(roleAssignments.isActive, true)
      ),
      with: {
        user: true
      }
    });

    res.json({ 
      items: assignments, 
      roleKeys: ROLE_KEYS,
      roleLabels: ROLE_LABELS 
    });
  } catch (error) {
    console.error("Error fetching role assignments:", error);
    res.status(500).json({ error: "Failed to fetch role assignments" });
  }
});

router.post("/api/role-assignments", isAuthenticated, async (req, res) => {
  try {
    const { rigId, roleKey, userId } = req.body;

    // Delete existing assignment for this rig/role combination
    await db.delete(roleAssignments)
      .where(and(
        eq(roleAssignments.rigId, rigId),
        eq(roleAssignments.roleKey, roleKey)
      ));

    // Create new assignment
    const assignment = await db.insert(roleAssignments)
      .values({
        rigId,
        roleKey,
        userId,
        isActive: true
      })
      .returning();

    res.json(assignment[0]);
  } catch (error) {
    console.error("Error updating role assignment:", error);
    res.status(500).json({ error: "Failed to update role assignment" });
  }
});

// Delegations CRUD
router.get("/api/delegations", isAuthenticated, async (req, res) => {
  try {
    const delegationList = await db.query.delegations.findMany({
      with: {
        delegator: true,
        delegate: true,
        rig: true
      },
      orderBy: (delegations, { desc }) => [desc(delegations.createdAt)]
    });

    res.json({ items: delegationList });
  } catch (error) {
    console.error("Error fetching delegations:", error);
    res.status(500).json({ error: "Failed to fetch delegations" });
  }
});

router.post("/api/delegations", isAuthenticated, async (req, res) => {
  try {
    const { 
      delegatorUserId, 
      delegateUserId, 
      startsAt, 
      endsAt, 
      rigId, 
      roleKey, 
      isActive 
    } = req.body;

    const delegation = await db.insert(delegations)
      .values({
        delegatorUserId,
        delegateUserId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        rigId: rigId || null,
        roleKey: roleKey || null,
        isActive: isActive ?? true
      })
      .returning();

    res.status(201).json(delegation[0]);
  } catch (error) {
    console.error("Error creating delegation:", error);
    res.status(500).json({ error: "Failed to create delegation" });
  }
});

router.delete("/api/delegations/:id", isAuthenticated, async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    await db.delete(delegations)
      .where(eq(delegations.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting delegation:", error);
    res.status(500).json({ error: "Failed to delete delegation" });
  }
});

export default router;