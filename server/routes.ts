import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { BillingProcessor } from "./billingProcessor";
import { insertNptReportSchema, insertSystemSchema, insertEquipmentSchema, insertDepartmentSchema, insertActionPartySchema } from "@shared/schema";
import type { BillingSheetRow } from "@shared/billingTypes";
import { z } from "zod";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

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

  // User management routes (Admin only)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can view all users" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update users" });
      }
      
      const { id } = req.params;
      const updateData = req.body;
      
      const updatedUser = await storage.updateUser(id, updateData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete users" });
      }
      
      const { id } = req.params;
      
      // Prevent self-deletion
      if (id === userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create users" });
      }
      
      const { email, firstName, lastName, role, rigId } = req.body;
      
      // Create a temporary user ID for the new user
      const newUserId = `temp_${Date.now()}`;
      
      const newUser = await storage.upsertUser({
        id: newUserId,
        email,
        firstName,
        lastName,
        role,
        rigId,
        profileImageUrl: null,
      });
      
      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
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
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }
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
      
      // Convert hours to string for database storage
      const dataToUpdate = { ...validatedData };
      if (dataToUpdate.hours !== undefined) {
        dataToUpdate.hours = dataToUpdate.hours.toString();
      }
      const report = await storage.updateNptReport(id, dataToUpdate);
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

  // Billing upload routes
  app.post('/api/billing-upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const fileName = req.file.originalname;
      const fileContent = req.file.buffer.toString('utf-8');

      const billingProcessor = new BillingProcessor();
      const result = await billingProcessor.processBillingSheet(fileName, fileContent);

      // Store upload record
      await storage.saveBillingUpload({
        fileName,
        uploadedBy: userId,
        status: result.errors.length === 0 ? 'Completed' : 'Failed',
        result
      });

      res.json(result);
    } catch (error) {
      console.error("Error processing billing upload:", error);
      res.status(500).json({ message: "Error processing file upload" });
    }
  });

  app.get('/api/billing-uploads', isAuthenticated, async (req: any, res) => {
    try {
      const uploads = await storage.getBillingUploads();
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching billing uploads:", error);
      res.status(500).json({ message: "Failed to fetch upload history" });
    }
  });

  app.post('/api/billing-convert', isAuthenticated, async (req: any, res) => {
    try {
      const { rows }: { rows: BillingSheetRow[] } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const createdReports = [];
      const errors = [];

      for (const row of rows) {
        try {
          // Find rig by number
          const rig = await storage.getRigByNumber(parseInt(row.rigNumber));
          if (!rig) {
            errors.push(`Rig ${row.rigNumber} not found`);
            continue;
          }

          // Use enhanced NPT report data if available, otherwise create basic report
          let reportData;
          if (row.nptReportData) {
            reportData = {
              ...row.nptReportData,
              rigId: rig.id,
              date: new Date(row.nptReportData.date),
              year: row.year,
              month: row.month,
              userId: user.id
            };
          } else {
            // Fallback to basic extraction
            reportData = {
              rigId: rig.id,
              date: row.date,
              year: row.year,
              month: row.month,
              hours: row.hours,
              nptType: row.nbtType,
              system: row.extractedSystem || null,
              parentEquipment: row.extractedEquipment || null,
              partEquipment: row.extractedFailure || null,
              contractualProcess: row.nbtType === 'Contractual' ? row.description : null,
              immediateCause: row.nbtType === 'Abraj' ? row.description : null,
              wellName: null,  
              userId: user.id,
              status: 'Draft' as const
            };
          }

          const newReport = await storage.createNptReport(reportData);
          createdReports.push(newReport);
          
        } catch (error) {
          errors.push(`Row ${rows.indexOf(row) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({ 
        message: `Successfully created ${createdReports.length} NPT reports${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
        createdReports,
        errors
      });
    } catch (error) {
      console.error("Error converting billing data:", error);
      res.status(500).json({ message: "Error creating NPT reports from billing data" });
    }
  });

  // Reports export endpoint
  app.get('/api/reports/export', isAuthenticated, async (req: any, res) => {
    try {
      const { rig, month, year, status } = req.query;
      
      let allReports = await storage.getNptReports();
      
      // Apply filters
      const filteredReports = allReports.filter(report => {
        if (rig !== 'all' && report.rigId !== parseInt(rig)) return false;
        if (month !== 'all' && report.month !== month) return false;
        if (year !== 'all' && report.year !== parseInt(year)) return false;
        if (status !== 'all' && report.status !== status) return false;
        return true;
      });

      // Convert to CSV
      const headers = [
        'Date', 'Rig Number', 'Year', 'Month', 'Hours', 'NPT Type', 'System',
        'Part Equipment', 'Contractual Process', 'Immediate Cause', 'Root Cause',
        'Corrective Action', 'Future Action', 'Department', 'Action Party',
        'Well Name', 'Notification Number', 'Status', 'Created At'
      ];

      const csvRows = [headers.join(',')];
      
      for (const report of filteredReports) {
        const rig = await storage.getRig(report.rigId);
        const row = [
          new Date(report.date).toLocaleDateString(),
          rig?.rigNumber || '',
          report.year,
          report.month,
          report.hours,
          report.nptType,
          report.system || '',
          report.partEquipment || '',
          report.contractualProcess || '',
          report.immediateCause || '',
          report.rootCause || '',
          report.correctiveAction || '',
          report.futureAction || '',
          report.department || '',
          report.actionParty || '',
          report.wellName || '',
          report.notificationNumber || '',
          report.status || 'draft',
          report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ''
        ];
        csvRows.push(row.map(field => `"${field}"`).join(','));
      }

      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="npt-reports.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting reports:", error);
      res.status(500).json({ message: "Failed to export reports" });
    }
  });

  // Reports dashboard stats endpoint
  app.get('/api/dashboard/reports-stats', isAuthenticated, async (req: any, res) => {
    try {
      const reports = await storage.getNptReports();
      
      const stats = {
        totalReports: reports.length,
        pendingReports: reports.filter(r => r.status === 'pending').length,
        approvedReports: reports.filter(r => r.status === 'approved').length,
        totalHours: reports.reduce((sum, r) => sum + parseFloat(r.hours), 0),
        avgHoursPerReport: reports.length > 0 ? 
          reports.reduce((sum, r) => sum + parseFloat(r.hours), 0) / reports.length : 0,
        nptTypeDistribution: reports.reduce((acc, r) => {
          const hours = parseFloat(r.hours);
          const existing = acc.find(item => item.type === r.nptType);
          if (existing) {
            existing.hours += hours;
            existing.count += 1;
          } else {
            acc.push({ type: r.nptType, hours, count: 1 });
          }
          return acc;
        }, [] as Array<{ type: string; hours: number; count: number }>),
        monthlyTrends: reports.reduce((acc, r) => {
          const key = `${r.year}-${r.month}`;
          const hours = parseFloat(r.hours);
          const existing = acc.find(item => item.month === key);
          if (existing) {
            existing.hours += hours;
            existing.count += 1;
          } else {
            acc.push({ month: key, hours, count: 1 });
          }
          return acc;
        }, [] as Array<{ month: string; hours: number; count: number }>)
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Approval workflow endpoints
  app.post('/api/npt-reports/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (user?.role !== 'admin' && user?.role !== 'supervisor') {
        return res.status(403).json({ message: "Only administrators and supervisors can approve reports" });
      }

      await storage.updateNptReport(reportId, {
        status: 'Approved'
      });

      res.json({ message: "Report approved successfully" });
    } catch (error) {
      console.error("Error approving report:", error);
      res.status(500).json({ message: "Failed to approve report" });
    }
  });

  app.post('/api/npt-reports/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const { reason } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (user?.role !== 'admin' && user?.role !== 'supervisor') {
        return res.status(403).json({ message: "Only administrators and supervisors can reject reports" });
      }

      if (!reason?.trim()) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      await storage.updateNptReport(reportId, {
        status: 'Rejected',
        rejectionReason: reason
      });

      res.json({ message: "Report rejected successfully" });
    } catch (error) {
      console.error("Error rejecting report:", error);
      res.status(500).json({ message: "Failed to reject report" });
    }
  });

  app.post('/api/npt-reports/:id/submit', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const report = await storage.getNptReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (report.userId !== userId) {
        return res.status(403).json({ message: "You can only submit your own reports" });
      }

      if (report.status !== 'draft') {
        return res.status(400).json({ message: "Only draft reports can be submitted for approval" });
      }

      await storage.updateNptReport(reportId, {
        status: 'Pending Review'
      });

      res.json({ message: "Report submitted for approval successfully" });
    } catch (error) {
      console.error("Error submitting report for approval:", error);
      res.status(500).json({ message: "Failed to submit report for approval" });
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
