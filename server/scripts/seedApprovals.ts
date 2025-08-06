import { db } from "../db";
import { nptReports } from "@shared/schema";
import { eq } from "drizzle-orm";
import { routeFirstApprover } from "../lib/approvals";

/**
 * Seed script to create test NPT reports for approval workflow testing
 * Creates reports in PENDING_REVIEW status and routes them to first approvers
 */

export async function seedApprovals() {
  try {
    console.log("🌱 Seeding test NPT reports for approval workflow...");

    // Get Rig 104 (rigId = 2)
    const rigId = 2;

    // Create test NPT reports in DRAFT status first
    const testReports = [
      {
        rigId,
        userId: 'supervisor-001', // Original submitter
        date: new Date('2025-01-06'),
        year: 2025,
        month: 'Jan',
        hours: 2.5,
        nptType: 'Contractual',
        system: 'Mud Pumps',
        parentEquipment: 'Pump 1',
        immediateCause: 'Pump seal failure requiring replacement',
        rootCause: 'Worn seal due to normal operation',
        correctiveAction: 'Replaced pump seal with new one',
        futureAction: 'Monitor seal condition during operations',
        department: 'E-Maintenance',
        actionParty: 'E.Maintenance',
        wellName: 'Well A-101',
        status: 'DRAFT'
      },
      {
        rigId,
        userId: 'supervisor-001',
        date: new Date('2025-01-05'),
        year: 2025,
        month: 'Jan',
        hours: 4.0,
        nptType: 'Contractual',
        system: 'Drawworks',
        parentEquipment: 'Main Brake',
        immediateCause: 'Brake band adjustment required',
        rootCause: 'Regular maintenance due',
        correctiveAction: 'Adjusted brake band tension',
        futureAction: 'Schedule regular brake inspections',
        department: 'Drilling',
        actionParty: 'Tool Pusher',
        wellName: 'Well A-101',
        status: 'DRAFT'
      }
    ];

    // Insert the test reports
    const createdReports = await db.insert(nptReports)
      .values(testReports)
      .returning();

    console.log(`✅ Created ${createdReports.length} test NPT reports`);

    // Submit each report (change status to PENDING_REVIEW and route to first approver)
    let routedCount = 0;
    for (const report of createdReports) {
      try {
        // Update status to PENDING_REVIEW
        await db.update(nptReports)
          .set({ status: 'PENDING_REVIEW' })
          .where(eq(nptReports.id, report.id));

        // Route to first approver
        const success = await routeFirstApprover(report.id);
        if (success) {
          routedCount++;
          console.log(`✅ Routed report ${report.id} to first approver`);
        } else {
          console.log(`❌ Failed to route report ${report.id}`);
        }
      } catch (error) {
        console.error(`❌ Error routing report ${report.id}:`, error);
      }
    }

    console.log(`🎉 Approval seeding completed: ${routedCount}/${createdReports.length} reports routed`);
    
    return {
      reportsCreated: createdReports.length,
      reportsRouted: routedCount
    };

  } catch (error) {
    console.error("❌ Error seeding approval test data:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedApprovals()
    .then((result) => {
      console.log("Approval seed completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Approval seed failed:", error);
      process.exit(1);
    });
}