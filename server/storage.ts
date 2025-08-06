import {
  users,
  rigs,
  userRigs,
  nptReports,
  systems,
  equipment,
  departments,
  actionParties,
  workflowApprovals,
  monthlyReports,
  stageEvents,
  daySlices,
  notifications,
  slaRules,
  reportDeliveries,
  alertRules,
  type User,
  type UpsertUser,
  type Rig,
  type InsertRig,
  type NptReport,
  type InsertNptReport,
  type System,
  type InsertSystem,
  type Equipment,
  type InsertEquipment,
  type Department,
  type InsertDepartment,
  type ActionParty,
  type InsertActionParty,
  type WorkflowApproval,
  type InsertWorkflowApproval,
  type MonthlyReport,
  type InsertMonthlyReport,
  type StageEvent,
  type InsertStageEvent,
  type DaySlice,
  type InsertDaySlice,
  type Notification,
  type InsertNotification,
  type SlaRule,
  type InsertSlaRule,
  type ReportDelivery,
  type InsertReportDelivery,
  type AlertRule,
  type InsertAlertRule,
} from "@shared/schema";
import type { BillingSheetUpload, BillingUploadResult } from "@shared/billingTypes";
import { db } from "./db";
import { eq, desc, and, or, count } from "drizzle-orm";

export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  assignUserToRigs(userId: string, rigIds: number[]): Promise<void>;
  getUserRigs(userId: string): Promise<number[]>;
  
  // Rig operations
  getRigs(): Promise<Rig[]>;
  getRig(id: number): Promise<Rig | undefined>;
  createRig(rig: InsertRig): Promise<Rig>;
  updateRig(id: number, rig: Partial<InsertRig>): Promise<Rig>;
  deleteRig(id: number): Promise<void>;
  
  // NPT Report operations
  getNptReports(filters?: { rigId?: number; userId?: string; status?: string }): Promise<NptReport[]>;
  getNptReport(id: number): Promise<NptReport | undefined>;
  createNptReport(report: InsertNptReport): Promise<NptReport>;
  updateNptReport(id: number, report: Partial<NptReport>): Promise<NptReport>;
  deleteNptReport(id: number): Promise<void>;
  
  // Dashboard stats
  getDashboardStats(rigId?: number): Promise<{
    totalReports: number;
    pendingReports: number;
    approvedReports: number;
    qualityIssues: number;
  }>;
  
  // Reference data operations
  getSystems(): Promise<System[]>;
  createSystem(system: InsertSystem): Promise<System>;
  deleteSystem(id: number): Promise<void>;
  
  getEquipment(systemId?: number): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;
  
  getDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  deleteDepartment(id: number): Promise<void>;
  
  getActionParties(): Promise<ActionParty[]>;
  createActionParty(actionParty: InsertActionParty): Promise<ActionParty>;
  deleteActionParty(id: number): Promise<void>;
  
  // Workflow operations
  createWorkflowApproval(approval: Partial<InsertWorkflowApproval>): Promise<WorkflowApproval>;
  getWorkflowApprovals(reportId: number): Promise<WorkflowApproval[]>;
  getReportsByApprover(approverRole: string): Promise<NptReport[]>;
  
  // Billing upload operations
  saveBillingUpload(upload: { fileName: string; uploadedBy: string; status: string; result: BillingUploadResult }): Promise<void>;
  getBillingUploads(): Promise<any[]>;
  getRigByNumber(rigNumber: number): Promise<Rig | undefined>;
  getSystemByName(name: string): Promise<System | undefined>;
  
  // Smart NPT Tracking - Report Deliveries
  createReportDelivery(delivery: InsertReportDelivery): Promise<ReportDelivery>;
  getReportDeliveries(reportId?: number): Promise<ReportDelivery[]>;
  updateReportDelivery(id: number, updates: Partial<ReportDelivery>): Promise<ReportDelivery>;
  
  // Smart NPT Tracking - Alert Rules
  getAlertRules(): Promise<AlertRule[]>;
  createAlertRule(rule: InsertAlertRule): Promise<AlertRule>;
  updateAlertRule(id: number, updates: Partial<AlertRule>): Promise<AlertRule>;
  deleteAlertRule(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    // Delete user-rig associations first
    await db.delete(userRigs).where(eq(userRigs.userId, id));
    // Then delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async assignUserToRigs(userId: string, rigIds: number[]): Promise<void> {
    // Delete existing assignments
    await db.delete(userRigs).where(eq(userRigs.userId, userId));
    
    // Add new assignments
    if (rigIds.length > 0) {
      const assignments = rigIds.map(rigId => ({
        userId,
        rigId
      }));
      await db.insert(userRigs).values(assignments);
    }
  }

  async getUserRigs(userId: string): Promise<number[]> {
    const assignments = await db
      .select({ rigId: userRigs.rigId })
      .from(userRigs)
      .where(eq(userRigs.userId, userId));
    return assignments.map(a => a.rigId);
  }
  
  // Rig operations
  async getRigs(): Promise<Rig[]> {
    return await db.select().from(rigs).where(eq(rigs.isActive, true));
  }
  
  async getRig(id: number): Promise<Rig | undefined> {
    const [rig] = await db.select().from(rigs).where(eq(rigs.id, id));
    return rig;
  }
  
  async createRig(rig: InsertRig): Promise<Rig> {
    const [newRig] = await db.insert(rigs).values(rig).returning();
    return newRig;
  }

  async updateRig(id: number, rig: Partial<InsertRig>): Promise<Rig> {
    const [updatedRig] = await db.update(rigs).set(rig).where(eq(rigs.id, id)).returning();
    if (!updatedRig) throw new Error('Rig not found');
    return updatedRig;
  }

  async deleteRig(id: number): Promise<void> {
    await db.delete(rigs).where(eq(rigs.id, id));
  }
  
  // NPT Report operations
  async getNptReports(filters?: { rigId?: number; userId?: string; status?: string }): Promise<NptReport[]> {
    const conditions = [];
    if (filters?.rigId) conditions.push(eq(nptReports.rigId, filters.rigId));
    if (filters?.userId) conditions.push(eq(nptReports.userId, filters.userId));
    if (filters?.status) conditions.push(eq(nptReports.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(nptReports).where(and(...conditions)).orderBy(desc(nptReports.date));
    }
    
    return await db.select().from(nptReports).orderBy(desc(nptReports.date));
  }
  
  async getNptReport(id: number): Promise<NptReport | undefined> {
    const [report] = await db.select().from(nptReports).where(eq(nptReports.id, id));
    return report;
  }
  
  async createNptReport(report: InsertNptReport): Promise<NptReport> {
    // Calculate year and month from date
    const date = new Date(report.date);
    const year = date.getFullYear();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    
    const [newReport] = await db.insert(nptReports).values({
      ...report,
      date,
      year,
      month,
      hours: report.hours.toString(),
    }).returning();
    return newReport;
  }
  
  async updateNptReport(id: number, report: Partial<NptReport>): Promise<NptReport> {
    let updateData: any = { ...report, updatedAt: new Date() };
    
    // Convert hours to string if provided and it's a number
    if (updateData.hours !== undefined && typeof updateData.hours === 'number') {
      updateData.hours = updateData.hours.toString();
    }
    
    // Recalculate year and month if date is updated
    if (report.date) {
      const date = new Date(report.date);
      updateData.year = date.getFullYear();
      updateData.month = date.toLocaleDateString('en-US', { month: 'short' });
      updateData.date = date;
    }
    
    const [updatedReport] = await db
      .update(nptReports)
      .set(updateData)
      .where(eq(nptReports.id, id))
      .returning();
    return updatedReport;
  }
  
  async deleteNptReport(id: number): Promise<void> {
    await db.delete(nptReports).where(eq(nptReports.id, id));
  }
  
  // Dashboard stats
  async getDashboardStats(rigId?: number): Promise<{
    totalReports: number;
    pendingReports: number;
    approvedReports: number;
    qualityIssues: number;
  }> {
    const conditions = rigId ? [eq(nptReports.rigId, rigId)] : [];
    
    const [totalResult] = await db
      .select({ count: count() })
      .from(nptReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const [pendingResult] = await db
      .select({ count: count() })
      .from(nptReports)
      .where(
        conditions.length > 0 
          ? and(...conditions, eq(nptReports.status, 'Pending Review'))
          : eq(nptReports.status, 'Pending Review')
      );
    
    const [approvedResult] = await db
      .select({ count: count() })
      .from(nptReports)
      .where(
        conditions.length > 0 
          ? and(...conditions, eq(nptReports.status, 'Approved'))
          : eq(nptReports.status, 'Approved')
      );
    
    // Quality issues: reports missing required fields or rejected
    const [qualityResult] = await db
      .select({ count: count() })
      .from(nptReports)
      .where(
        conditions.length > 0 
          ? and(...conditions, 
              or(
                eq(nptReports.status, 'Rejected'),
                and(
                  eq(nptReports.nptType, 'Abraj'),
                  or(
                    eq(nptReports.system, ''),
                    eq(nptReports.parentEquipment, ''),
                    eq(nptReports.immediateCause, ''),
                    eq(nptReports.rootCause, '')
                  )
                )
              )
            )
          : or(
              eq(nptReports.status, 'Rejected'),
              and(
                eq(nptReports.nptType, 'Abraj'),
                or(
                  eq(nptReports.system, ''),
                  eq(nptReports.parentEquipment, ''),
                  eq(nptReports.immediateCause, ''),
                  eq(nptReports.rootCause, '')
                )
              )
            )
      );
    
    return {
      totalReports: totalResult.count,
      pendingReports: pendingResult.count,
      approvedReports: approvedResult.count,
      qualityIssues: qualityResult.count,
    };
  }
  
  // Reference data operations
  async getSystems(): Promise<System[]> {
    return await db.select().from(systems).where(eq(systems.isActive, true));
  }
  
  async createSystem(system: InsertSystem): Promise<System> {
    const [newSystem] = await db.insert(systems).values(system).returning();
    return newSystem;
  }
  
  async deleteSystem(id: number): Promise<void> {
    await db.update(systems).set({ isActive: false }).where(eq(systems.id, id));
  }
  
  async getEquipment(systemId?: number): Promise<Equipment[]> {
    if (systemId) {
      return await db.select().from(equipment).where(and(eq(equipment.isActive, true), eq(equipment.systemId, systemId)));
    }
    return await db.select().from(equipment).where(eq(equipment.isActive, true));
  }
  
  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [newEquipment] = await db.insert(equipment).values(equipmentData).returning();
    return newEquipment;
  }
  
  async deleteEquipment(id: number): Promise<void> {
    await db.update(equipment).set({ isActive: false }).where(eq(equipment.id, id));
  }
  
  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.isActive, true));
  }
  
  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }
  
  async deleteDepartment(id: number): Promise<void> {
    await db.update(departments).set({ isActive: false }).where(eq(departments.id, id));
  }
  
  async getActionParties(): Promise<ActionParty[]> {
    return await db.select().from(actionParties).where(eq(actionParties.isActive, true));
  }
  
  async createActionParty(actionParty: InsertActionParty): Promise<ActionParty> {
    const [newActionParty] = await db.insert(actionParties).values(actionParty).returning();
    return newActionParty;
  }
  
  async deleteActionParty(id: number): Promise<void> {
    await db.update(actionParties).set({ isActive: false }).where(eq(actionParties.id, id));
  }
  
  // Workflow operations
  async createWorkflowApproval(approval: Partial<InsertWorkflowApproval>): Promise<WorkflowApproval> {
    const [newApproval] = await db.insert(workflowApprovals).values(approval as InsertWorkflowApproval).returning();
    return newApproval;
  }
  
  async getWorkflowApprovals(reportId: number): Promise<WorkflowApproval[]> {
    return await db
      .select()
      .from(workflowApprovals)
      .where(eq(workflowApprovals.reportId, reportId))
      .orderBy(workflowApprovals.createdAt);
  }

  // Monthly Reports (Lifecycle tracking)
  async getMonthlyReports(filters?: { rigId?: number; month?: string; status?: string }): Promise<MonthlyReport[]> {
    const conditions = [];
    if (filters?.rigId) conditions.push(eq(monthlyReports.rigId, filters.rigId));
    if (filters?.month) conditions.push(eq(monthlyReports.month, filters.month));
    if (filters?.status) conditions.push(eq(monthlyReports.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(monthlyReports).where(and(...conditions)).orderBy(desc(monthlyReports.createdAt));
    }
    
    return await db.select().from(monthlyReports).orderBy(desc(monthlyReports.createdAt));
  }

  async getMonthlyReport(id: number): Promise<MonthlyReport | undefined> {
    const [report] = await db.select().from(monthlyReports).where(eq(monthlyReports.id, id));
    return report;
  }

  async getMonthlyReportByMonthAndRig(month: string, rigId: number): Promise<MonthlyReport | undefined> {
    const [report] = await db.select().from(monthlyReports)
      .where(and(eq(monthlyReports.month, month), eq(monthlyReports.rigId, rigId)));
    return report;
  }

  async createMonthlyReport(report: InsertMonthlyReport): Promise<MonthlyReport> {
    const [newReport] = await db.insert(monthlyReports).values(report).returning();
    return newReport;
  }

  async updateMonthlyReport(id: number, report: Partial<MonthlyReport>): Promise<MonthlyReport> {
    const [updatedReport] = await db
      .update(monthlyReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(monthlyReports.id, id))
      .returning();
    return updatedReport;
  }

  async deleteMonthlyReport(id: number): Promise<void> {
    await db.delete(monthlyReports).where(eq(monthlyReports.id, id));
  }

  // Stage Events (Audit log)
  async createStageEvent(event: InsertStageEvent): Promise<StageEvent> {
    const [newEvent] = await db.insert(stageEvents).values(event).returning();
    return newEvent;
  }

  async getStageEvents(reportId: number): Promise<StageEvent[]> {
    return await db
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.reportId, reportId))
      .orderBy(stageEvents.createdAt);
  }

  async getLatestStageEvent(reportId: number): Promise<StageEvent | undefined> {
    const [event] = await db
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.reportId, reportId))
      .orderBy(desc(stageEvents.createdAt))
      .limit(1);
    return event;
  }

  // Day Slices (Daily timeline)
  async getDaySlices(reportId: number): Promise<DaySlice[]> {
    return await db
      .select()
      .from(daySlices)
      .where(eq(daySlices.reportId, reportId))
      .orderBy(daySlices.date);
  }

  async getDaySlice(reportId: number, date: Date): Promise<DaySlice | undefined> {
    const [slice] = await db.select().from(daySlices)
      .where(and(eq(daySlices.reportId, reportId), eq(daySlices.date, date)));
    return slice;
  }

  async createDaySlice(slice: InsertDaySlice): Promise<DaySlice> {
    const [newSlice] = await db.insert(daySlices).values({
      ...slice,
      lastUpdated: new Date()
    }).returning();
    return newSlice;
  }

  async updateDaySlice(id: number, slice: Partial<DaySlice>): Promise<DaySlice> {
    const [updatedSlice] = await db
      .update(daySlices)
      .set({ ...slice, lastUpdated: new Date() })
      .where(eq(daySlices.id, id))
      .returning();
    return updatedSlice;
  }

  async upsertDaySlice(reportId: number, date: Date, data: Partial<DaySlice>): Promise<DaySlice> {
    const existing = await this.getDaySlice(reportId, date);
    
    if (existing) {
      return this.updateDaySlice(existing.id, data);
    } else {
      return this.createDaySlice({
        reportId,
        date,
        ...data
      } as InsertDaySlice);
    }
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    const conditions = [eq(notifications.recipient, userId)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }
    
    return await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.sentAt));
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.recipient, userId));
  }

  // SLA Rules
  async getSlaRules(): Promise<SlaRule[]> {
    return await db.select().from(slaRules).where(eq(slaRules.isActive, true));
  }

  async createSlaRule(rule: InsertSlaRule): Promise<SlaRule> {
    const [newRule] = await db.insert(slaRules).values(rule).returning();
    return newRule;
  }

  async updateSlaRule(id: number, rule: Partial<SlaRule>): Promise<SlaRule> {
    const [updatedRule] = await db
      .update(slaRules)
      .set({ ...rule, updatedAt: new Date() })
      .where(eq(slaRules.id, id))
      .returning();
    return updatedRule;
  }
  
  async getReportsByApprover(approverRole: string): Promise<NptReport[]> {
    return await db
      .select()
      .from(nptReports)
      .where(eq(nptReports.currentApprover, approverRole));
  }

  // Billing upload operations
  async saveBillingUpload(upload: { fileName: string; uploadedBy: string; status: string; result: BillingUploadResult }): Promise<void> {
    // For now, store in memory - in production, this would be a database table
    console.log('Billing upload saved:', upload.fileName, upload.status);
  }

  async getBillingUploads(): Promise<any[]> {
    // For now, return empty array - in production, this would query the database
    return [];
  }

  async getRigByNumber(rigNumber: number): Promise<Rig | undefined> {
    const [rig] = await db.select().from(rigs).where(eq(rigs.rigNumber, rigNumber));
    return rig;
  }

  async getSystemByName(name: string): Promise<System | undefined> {
    const [system] = await db.select().from(systems).where(eq(systems.name, name));
    return system;
  }
  
  // Smart NPT Tracking - Report Deliveries
  async createReportDelivery(delivery: InsertReportDelivery): Promise<ReportDelivery> {
    const [newDelivery] = await db.insert(reportDeliveries).values(delivery).returning();
    return newDelivery;
  }
  
  async getReportDeliveries(reportId?: number): Promise<ReportDelivery[]> {
    if (reportId) {
      return await db.select().from(reportDeliveries).where(eq(reportDeliveries.reportId, reportId));
    }
    return await db.select().from(reportDeliveries);
  }
  
  async updateReportDelivery(id: number, updates: Partial<ReportDelivery>): Promise<ReportDelivery> {
    const [updated] = await db.update(reportDeliveries).set(updates).where(eq(reportDeliveries.id, id)).returning();
    if (!updated) throw new Error('Report delivery not found');
    return updated;
  }
  
  // Smart NPT Tracking - Alert Rules
  async getAlertRules(): Promise<AlertRule[]> {
    return await db.select().from(alertRules).orderBy(alertRules.createdAt);
  }
  
  async createAlertRule(rule: InsertAlertRule): Promise<AlertRule> {
    const [newRule] = await db.insert(alertRules).values(rule).returning();
    return newRule;
  }
  
  async updateAlertRule(id: number, updates: Partial<AlertRule>): Promise<AlertRule> {
    const [updated] = await db.update(alertRules).set(updates).where(eq(alertRules.id, id)).returning();
    if (!updated) throw new Error('Alert rule not found');
    return updated;
  }
  
  async deleteAlertRule(id: number): Promise<void> {
    await db.delete(alertRules).where(eq(alertRules.id, id));
  }
}

export const storage = new DatabaseStorage();
