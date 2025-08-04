import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertNptReportSchema, insertSystemSchema, insertEquipmentSchema, insertDepartmentSchema, insertActionPartySchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const rigId = user?.rigId;
      
      const stats = await storage.getDashboardStats(rigId || undefined);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // NPT Reports routes
  app.get('/api/npt-reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const filters: any = {};
      if (user?.role === 'drilling_manager') {
        filters.userId = userId;
      } else if (user?.rigId) {
        filters.rigId = user.rigId;
      }
      
      if (req.query.status) {
        filters.status = req.query.status;
      }
      
      const reports = await storage.getNptReports(filters);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching NPT reports:", error);
      res.status(500).json({ message: "Failed to fetch NPT reports" });
    }
  });

  app.get('/api/npt-reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const report = await storage.getNptReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Check access permissions
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === 'drilling_manager' && report.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching NPT report:", error);
      res.status(500).json({ message: "Failed to fetch NPT report" });
    }
  });

  app.post('/api/npt-reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.rigId) {
        return res.status(400).json({ message: "User must be assigned to a rig" });
      }
      
      const validatedData = insertNptReportSchema.parse({
        ...req.body,
        userId,
        rigId: user.rigId,
      });
      
      // Business rule validations
      const errors = validateNptReport(validatedData, user);
      if (errors.length > 0) {
        return res.status(400).json({ message: "Validation failed", errors });
      }
      
      const report = await storage.createNptReport(validatedData);
      res.status(201).json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating NPT report:", error);
      res.status(500).json({ message: "Failed to create NPT report" });
    }
  });

  app.put('/api/npt-reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const existingReport = await storage.getNptReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Check permissions
      if (user?.role === 'drilling_manager' && existingReport.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (['Approved', 'Rejected'].includes(existingReport.status!) && user?.role !== 'admin') {
        return res.status(403).json({ message: "Cannot modify approved/rejected reports" });
      }
      
      const validatedData = insertNptReportSchema.partial().parse(req.body);
      
      // Business rule validations
      const fullData = { ...existingReport, ...validatedData };
      const errors = validateNptReport(fullData, user!);
      if (errors.length > 0) {
        return res.status(400).json({ message: "Validation failed", errors });
      }
      
      const report = await storage.updateNptReport(id, validatedData);
      res.json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating NPT report:", error);
      res.status(500).json({ message: "Failed to update NPT report" });
    }
  });

  app.delete('/api/npt-reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete reports" });
      }
      
      await storage.deleteNptReport(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting NPT report:", error);
      res.status(500).json({ message: "Failed to delete NPT report" });
    }
  });

  // Approval routes
  app.put('/api/npt-reports/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!['admin', 'supervisor'].includes(user?.role || '')) {
        return res.status(403).json({ message: "Only supervisors and admins can approve reports" });
      }
      
      const report = await storage.updateNptReport(id, { status: 'Approved' });
      res.json(report);
    } catch (error) {
      console.error("Error approving NPT report:", error);
      res.status(500).json({ message: "Failed to approve NPT report" });
    }
  });

  app.put('/api/npt-reports/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!['admin', 'supervisor'].includes(user?.role || '')) {
        return res.status(403).json({ message: "Only supervisors and admins can reject reports" });
      }
      
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }
      
      const report = await storage.updateNptReport(id, { 
        status: 'Rejected',
        rejectionReason: reason
      });
      res.json(report);
    } catch (error) {
      console.error("Error rejecting NPT report:", error);
      res.status(500).json({ message: "Failed to reject NPT report" });
    }
  });

  // Reference data routes
  app.get('/api/systems', async (req, res) => {
    try {
      const systems = await storage.getSystems();
      res.json(systems);
    } catch (error) {
      console.error("Error fetching systems:", error);
      res.status(500).json({ message: "Failed to fetch systems" });
    }
  });

  app.post('/api/systems', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create systems" });
      }
      
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.createSystem(validatedData);
      res.status(201).json(system);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating system:", error);
      res.status(500).json({ message: "Failed to create system" });
    }
  });

  app.get('/api/equipment', async (req, res) => {
    try {
      const systemId = req.query.systemId ? parseInt(req.query.systemId as string) : undefined;
      const equipment = await storage.getEquipment(systemId);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  app.post('/api/equipment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create equipment" });
      }
      
      const validatedData = insertEquipmentSchema.parse(req.body);
      const equipment = await storage.createEquipment(validatedData);
      res.status(201).json(equipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating equipment:", error);
      res.status(500).json({ message: "Failed to create equipment" });
    }
  });

  app.get('/api/departments', async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post('/api/departments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create departments" });
      }
      
      const validatedData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(validatedData);
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating department:", error);
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.get('/api/action-parties', async (req, res) => {
    try {
      const actionParties = await storage.getActionParties();
      res.json(actionParties);
    } catch (error) {
      console.error("Error fetching action parties:", error);
      res.status(500).json({ message: "Failed to fetch action parties" });
    }
  });

  app.post('/api/action-parties', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create action parties" });
      }
      
      const validatedData = insertActionPartySchema.parse(req.body);
      const actionParty = await storage.createActionParty(validatedData);
      res.status(201).json(actionParty);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating action party:", error);
      res.status(500).json({ message: "Failed to create action party" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Business rule validation function
function validateNptReport(data: any, user: any): string[] {
  const errors: string[] = [];
  
  // Hours validation
  if (data.hours <= 0 || data.hours > 24) {
    errors.push("Hours must be between 0.1 and 24");
  }
  
  // NPT Type specific validations
  if (data.nptType === 'Contractual') {
    if (!data.contractualProcess?.trim()) {
      errors.push("Contractual Process is required for Contractual NPT type");
    }
  } else if (data.nptType === 'Abraj') {
    if (!data.system) errors.push("System is required for Abraj NPT type");
    if (!data.parentEquipment) errors.push("Parent Equipment is required for Abraj NPT type");
    if (!data.partEquipment?.trim()) errors.push("Part Equipment is required for Abraj NPT type");
    if (!data.department) errors.push("Department is required for Abraj NPT type");
    if (!data.immediateCause?.trim()) errors.push("Immediate Cause is required for Abraj NPT type");
    if (!data.rootCause?.trim()) errors.push("Root Cause is required for Abraj NPT type");
    if (!data.correctiveAction?.trim()) errors.push("Corrective Action is required for Abraj NPT type");
    if (!data.futureAction?.trim()) errors.push("Future Action is required for Abraj NPT type");
    if (!data.actionParty) errors.push("Action Party is required for Abraj NPT type");
  }
  
  // Notification Number validation
  const hours = parseFloat(data.hours);
  const department = data.department;
  
  const isDrillingOrProject = ['Drilling', 'Project'].includes(department);
  const isMaintenance = ['M.Maintenance', 'E.Maintenance'].includes(department);
  
  if (isDrillingOrProject && hours >= 3.75 && hours <= 5.75) {
    if (!data.notificationNumber?.trim()) {
      errors.push("Notification Number is required for Drilling/Project departments with hours between 3.75 and 5.75");
    }
  }
  
  if (isMaintenance && hours >= 2.0 && hours <= 5.75) {
    if (!data.notificationNumber?.trim()) {
      errors.push("Notification Number is required for Maintenance departments with hours between 2.0 and 5.75");
    }
  }
  
  // Investigation Report validation
  if (hours >= 6.0 && !data.investigationReport?.trim()) {
    errors.push("Investigation Report is required for hours >= 6.0");
  }
  
  return errors;
}
