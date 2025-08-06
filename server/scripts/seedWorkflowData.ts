import { db } from "../db";
import { workflowDefinitions, workflowSteps, roleAssignments, delegations, users } from "@shared/schema";
import { ROLE_KEYS } from "@shared/workflow";

/**
 * Seed script for quick start workflow configuration
 * Creates global workflow and role assignments for Rig 104
 */

export async function seedWorkflowData() {
  try {
    console.log("🌱 Seeding workflow data...");

    // 1. Create Global workflow with 4 steps: toolpusher → e_maintenance → ds → osc
    const [globalWorkflow] = await db.insert(workflowDefinitions)
      .values({
        name: "Global NPT Approval Workflow",
        rigId: null, // Global workflow
        isActive: true
      })
      .returning()
      .onConflictDoNothing();

    if (globalWorkflow) {
      console.log("✅ Created global workflow:", globalWorkflow.name);

      // Create workflow steps
      const steps = [
        { stepOrder: 1, approverType: 'role', roleKey: 'toolpusher', isRequired: true },
        { stepOrder: 2, approverType: 'role', roleKey: 'e_maintenance', isRequired: true },
        { stepOrder: 3, approverType: 'role', roleKey: 'ds', isRequired: true },
        { stepOrder: 4, approverType: 'role', roleKey: 'osc', isRequired: true },
      ] as const;

      await db.insert(workflowSteps)
        .values(steps.map(step => ({
          workflowId: globalWorkflow.id,
          ...step
        })))
        .onConflictDoNothing();

      console.log("✅ Created 4 workflow steps");
    }

    // 2. Get or create demo users for Rig 104
    const demoUsers = [
      { id: 'john-toolpusher', email: 'john@drilling.com', firstName: 'John', lastName: 'Tool Pusher', role: 'supervisor' },
      { id: 'sarah-emaintenance', email: 'sarah@drilling.com', firstName: 'Sarah', lastName: 'E-Maintenance', role: 'supervisor' },
      { id: 'haitham-supervisor', email: 'haitham@drilling.com', firstName: 'Haitham', lastName: 'Supervisor', role: 'supervisor' },
      { id: 'pme-103', email: 'pme@drilling.com', firstName: 'PME', lastName: '103', role: 'supervisor' }
    ];

    for (const userData of demoUsers) {
      await db.insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email
          }
        });
    }

    console.log("✅ Created/updated demo users");

    // 3. Set role assignments for Rig 104 (assuming rigId = 2 from existing data)
    const rigId = 2; // Rig 104
    const roleAssignmentData = [
      { rigId, roleKey: 'toolpusher', userId: 'john-toolpusher' },
      { rigId, roleKey: 'e_maintenance', userId: 'sarah-emaintenance' },
      { rigId, roleKey: 'ds', userId: 'haitham-supervisor' },
      { rigId, roleKey: 'osc', userId: 'pme-103' }
    ];

    for (const assignment of roleAssignmentData) {
      await db.insert(roleAssignments)
        .values({
          ...assignment,
          isActive: true
        })
        .onConflictDoNothing();
    }

    console.log("✅ Created role assignments for Rig 104");

    // 4. Optional: Create delegation (John → Sarah for 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    await db.insert(delegations)
      .values({
        delegatorUserId: 'john-toolpusher',
        delegateUserId: 'sarah-emaintenance',
        startsAt: new Date(),
        endsAt: sevenDaysFromNow,
        rigId: rigId,
        roleKey: 'toolpusher',
        isActive: true
      })
      .onConflictDoNothing();

    console.log("✅ Created delegation: John → Sarah for 7 days");

    console.log("🎉 Workflow seeding completed!");
    
    return {
      globalWorkflowCreated: !!globalWorkflow,
      usersCreated: demoUsers.length,
      roleAssignmentsCreated: roleAssignmentData.length,
      delegationCreated: 1
    };

  } catch (error) {
    console.error("❌ Error seeding workflow data:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedWorkflowData()
    .then(() => {
      console.log("Seed completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}