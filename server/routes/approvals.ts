import { Router } from 'express';
import { db } from '../db';
import { nptReports, nptApprovals, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
// Use the auth middleware from the main routes file
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.user?.claims?.sub) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
import { recordApproval } from '../lib/approvals';

const router = Router();

// GET: reports the current user must act on
router.get('/api/my-approvals/pending', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const items = await db.query.nptReports.findMany({
      where: and(
        eq(nptReports.status, 'PENDING_REVIEW'),
        eq(nptReports.currentApproverUserId, userId)
      ),
      orderBy: [desc(nptReports.date)],
      with: {
        rig: {
          columns: { rigNumber: true }
        }
      }
    });

    // Add submitter info and delegation context
    const enrichedItems = await Promise.all(items.map(async (item) => {
      const submitter = await db.query.users.findFirst({
        where: eq(users.id, item.userId),
        columns: { firstName: true, lastName: true }
      });

      const nominal = item.currentNominalUserId ? await db.query.users.findFirst({
        where: eq(users.id, item.currentNominalUserId),
        columns: { firstName: true, lastName: true }
      }) : null;

      return {
        id: item.id,
        date: item.date,
        hours: item.hours,
        nptType: item.nptType,
        status: item.status,
        currentStepOrder: item.currentStepOrder,
        rigName: `Rig ${item.rig?.rigNumber}`,
        submittedBy: submitter ? `${submitter.firstName} ${submitter.lastName}` : 'Unknown',
        isDelegated: item.currentNominalUserId !== userId,
        delegatedFrom: nominal ? `${nominal.firstName} ${nominal.lastName}` : null,
        problem: item.immediateCause || item.rootCause,
        system: item.system,
        equipment: item.parentEquipment || item.partEquipment
      };
    }));

    res.json({ items: enrichedItems });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// Optional: my approval history (what I approved/rejected)
router.get('/api/my-approvals/history', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const actions = await db.query.nptApprovals.findMany({
      where: eq(nptApprovals.approverUserId, userId),
      orderBy: [desc(nptApprovals.createdAt)],
      with: {
        report: {
          with: {
            rig: {
              columns: { rigNumber: true }
            }
          }
        }
      }
    });

    const enrichedActions = actions.map(action => ({
      action: action.action,
      createdAt: action.createdAt,
      stepOrder: action.stepOrder,
      comment: action.comment,
      report: {
        id: action.report.id,
        date: action.report.date,
        hours: action.report.hours,
        nptType: action.report.nptType,
        status: action.report.status,
        rigName: `Rig ${action.report.rig?.rigNumber}`
      }
    }));

    res.json({ actions: enrichedActions });
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({ error: 'Failed to fetch approval history' });
  }
});

// POST: approve a report
router.post('/api/approvals/:id/approve', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const reportId = parseInt(req.params.id);
    const { comment } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const success = await recordApproval(reportId, userId, 'APPROVE', comment);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to approve report' });
    }
  } catch (error) {
    console.error('Error approving report:', error);
    res.status(500).json({ error: 'Failed to approve report' });
  }
});

// POST: reject a report
router.post('/api/approvals/:id/reject', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const reportId = parseInt(req.params.id);
    const { comment } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const success = await recordApproval(reportId, userId, 'REJECT', comment);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to reject report' });
    }
  } catch (error) {
    console.error('Error rejecting report:', error);
    res.status(500).json({ error: 'Failed to reject report' });
  }
});

// POST: request changes for a report
router.post('/api/approvals/:id/request-changes', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const reportId = parseInt(req.params.id);
    const { comment } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const success = await recordApproval(reportId, userId, 'REQUEST_CHANGES', comment);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to request changes' });
    }
  } catch (error) {
    console.error('Error requesting changes:', error);
    res.status(500).json({ error: 'Failed to request changes' });
  }
});

export default router;