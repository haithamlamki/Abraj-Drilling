import { db } from "../db";
import { nptReports } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { routeFirstApprover } from "../lib/approvals";

/**
 * Backfill script to set routing pointers for existing PENDING_REVIEW reports
 * Run once after deploying the workflow system
 */

export async function backfillRouting() {
  try {
    console.log("🔄 Starting backfill routing for existing reports...");

    // Find all PENDING_REVIEW reports without routing pointers
    const pendingReports = await db.query.nptReports.findMany({
      where: and(
        eq(nptReports.status, 'PENDING_REVIEW'),
        isNull(nptReports.currentApproverUserId)
      )
    });

    console.log(`📋 Found ${pendingReports.length} reports to backfill`);

    let successCount = 0;
    let failureCount = 0;

    for (const report of pendingReports) {
      try {
        const success = await routeFirstApprover(report.id);
        if (success) {
          successCount++;
          console.log(`✅ Routed report ${report.id}`);
        } else {
          failureCount++;
          console.log(`❌ Failed to route report ${report.id}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`❌ Error routing report ${report.id}:`, error);
      }
    }

    console.log(`🎉 Backfill completed: ${successCount} success, ${failureCount} failures`);
    
    return {
      totalReports: pendingReports.length,
      successCount,
      failureCount
    };

  } catch (error) {
    console.error("❌ Error during backfill routing:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillRouting()
    .then((result) => {
      console.log("Backfill completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Backfill failed:", error);
      process.exit(1);
    });
}