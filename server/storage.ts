import {
  users,
  rigs,
  nptReports,
  systems,
  equipment,
  departments,
  actionParties,
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
  
  // Rig operations
  getRigs(): Promise<Rig[]>;
  getRig(id: number): Promise<Rig | undefined>;
  createRig(rig: InsertRig): Promise<Rig>;
  
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
  
  // Billing upload operations
  saveBillingUpload(upload: { fileName: string; uploadedBy: string; status: string; result: BillingUploadResult }): Promise<void>;
  getBillingUploads(): Promise<any[]>;
  getRigByNumber(rigNumber: number): Promise<Rig | undefined>;
  getSystemByName(name: string): Promise<System | undefined>;
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
    await db.delete(users).where(eq(users.id, id));
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
}

export const storage = new DatabaseStorage();
