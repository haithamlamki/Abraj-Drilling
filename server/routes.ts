import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { BillingProcessor } from "./billingProcessor";
import { processPDFBilling, enhanceBillingRowWithNPTData } from "./pdfProcessor";
import { workflowService } from "./workflowService";
import { lifecycleService } from "./lifecycleService";
import { insertNptReportSchema, insertRigSchema, insertSystemSchema, insertEquipmentSchema, insertDepartmentSchema, insertActionPartySchema, insertReportDeliverySchema, insertAlertRuleSchema } from "@shared/schema";
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

  // Custom login endpoint for email/password authentication
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Simple password verification for demo
      // In production, you would use bcrypt for hashing
      if (user.password && user.password !== password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Set password if user doesn't have one
      if (!user.password && password) {
        await storage.updateUserPassword(user.id, password);
      }

      // Create a session-like response
      req.session = req.session || {};
      (req.session as any).user = {
        claims: { sub: user.id },
        access_token: 'demo_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour
      };

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

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
      
      // Add assigned rigs for each user
      const usersWithRigs = await Promise.all(users.map(async (user) => {
        const rigIds = await storage.getUserRigs(user.id);
        return { ...user, rigIds };
      }));
      
      res.json(usersWithRigs);
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
      const { rigIds, ...updateData } = req.body;
      
      // Update user data
      const updatedUser = await storage.updateUser(id, updateData);
      
      // Update rig assignments if provided
      if (rigIds !== undefined) {
        await storage.assignUserToRigs(id, rigIds);
      }
      
      // Return user with their assigned rigs
      const userRigIds = await storage.getUserRigs(id);
      res.json({ ...updatedUser, rigIds: userRigIds });
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
      
      const { id, email, firstName, lastName, role, rigIds, departmentId } = req.body;
      
      // Use provided ID or create a temporary one
      const newUserId = id || `temp_${Date.now()}`;
      
      const newUser = await storage.upsertUser({
        id: newUserId,
        email,
        firstName,
        lastName,
        role,
        rigId: rigIds && rigIds.length > 0 ? rigIds[0] : null, // Keep first rig for backward compatibility
        profileImageUrl: null,
      });
      
      // Add multiple rig assignments if provided
      if (rigIds && rigIds.length > 0) {
        await storage.assignUserToRigs(newUserId, rigIds);
      }
      
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
      const dataToUpdate: any = { ...validatedData };
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
      
      if (user?.role?.toLowerCase() !== 'admin') {
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

  // Rig routes
  app.get('/api/rigs', async (req, res) => {
    try {
      const rigs = await storage.getRigs();
      res.json(rigs);
    } catch (error) {
      console.error("Error fetching rigs:", error);
      res.status(500).json({ message: "Failed to fetch rigs" });
    }
  });

  app.post('/api/rigs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create rigs" });
      }
      
      const validatedData = insertRigSchema.parse(req.body);
      const rig = await storage.createRig(validatedData);
      res.status(201).json(rig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating rig:", error);
      res.status(500).json({ message: "Failed to create rig" });
    }
  });

  app.put('/api/rigs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update rigs" });
      }
      
      const rigId = parseInt(req.params.id);
      const validatedData = insertRigSchema.partial().parse(req.body);
      const rig = await storage.updateRig(rigId, validatedData);
      res.json(rig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating rig:", error);
      res.status(500).json({ message: "Failed to update rig" });
    }
  });

  app.delete('/api/rigs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete rigs" });
      }
      
      const rigId = parseInt(req.params.id);
      await storage.deleteRig(rigId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting rig:", error);
      res.status(500).json({ message: "Failed to delete rig" });
    }
  });

  // POST /api/rigs/import - Import rigs from Excel file
  app.post("/api/rigs/import", isAuthenticated, upload.single('file'), async (req: any, res) => {
    if (req.user?.claims?.sub) {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can import rigs" });
      }
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileName = req.file.originalname;
      const fileExtension = fileName.toLowerCase().split('.').pop();

      if (!['xlsx', 'xls'].includes(fileExtension || '')) {
        return res.status(400).json({ message: "Only Excel files (.xlsx, .xls) are supported" });
      }

      // Parse Excel file
      const xlsx = require('xlsx');
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      let imported = 0;
      const errors: string[] = [];

      // Process each row
      for (const row of data) {
        try {
          // Map the Excel columns to our rig data structure
          const rigData = {
            rigNumber: parseInt(String(row['Rig Number'] || row['RigNumber'] || row['Rig'] || '').trim()),
            section: String(row['Section'] || row['Unit'] || 'KOC').trim(),
            client: String(row['Client'] || row['Company'] || 'Kuwait Oil Company').trim(),
            location: String(row['Location'] || row['Field'] || '').trim(),
            isActive: row['Status'] ? String(row['Status']).toLowerCase() === 'active' : true
          };

          // Validate required fields
          if (!rigData.rigNumber) {
            errors.push(`Row ${imported + 1}: Missing rig number`);
            continue;
          }

          // Check if rig already exists
          const existingRig = await storage.getRigByNumber(rigData.rigNumber);
          if (existingRig) {
            // Update existing rig
            await storage.updateRig(existingRig.id, rigData);
          } else {
            // Create new rig
            await storage.createRig(rigData);
          }
          
          imported++;
        } catch (error) {
          errors.push(`Row ${imported + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Import completed: ${imported} rigs processed`,
        imported,
        total: data.length,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error("Error importing rigs:", error);
      res.status(500).json({ message: "Failed to import rigs" });
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
      const fileExtension = fileName.toLowerCase().split('.').pop();

      let result;
      
      if (fileExtension === 'pdf') {
        // Process PDF file
        const { rows, metadata } = await processPDFBilling(req.file.buffer);
        
        // Enhance rows with NPT data
        const enhancedRows = rows.map(row => enhanceBillingRowWithNPTData(row, metadata));
        
        result = {
          fileName,
          totalRows: rows.length,
          processedRows: enhancedRows.length,
          errors: [],
          extractedData: enhancedRows,
          recognitionSummary: {
            repairRateRows: enhancedRows.filter(r => r.rateType === 'Repair Rate').length,
            reducedRateRows: enhancedRows.filter(r => r.rateType === 'Reduce Repair Rate').length,
            zeroRateRows: enhancedRows.filter(r => r.rateType === 'Zero Rate').length,
            contractualRows: enhancedRows.filter(r => r.nbtType === 'Contractual').length,
            abroadRows: enhancedRows.filter(r => r.nbtType === 'Abroad').length,
          }
        };
      } else {
        // Process Excel/CSV file
        const fileContent = req.file.buffer.toString('utf-8');
        const billingProcessor = new BillingProcessor();
        result = await billingProcessor.processBillingSheet(fileName, fileContent);
      }

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

  app.post('/api/npt-reports/from-billing', isAuthenticated, async (req: any, res) => {
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
              immediateCause: row.nbtType === 'Abroad' ? row.description : null,
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

  // Workflow endpoints
  app.post('/api/npt-reports/:id/initiate-workflow', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }

      const report = await storage.getNptReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Only Tool Pushers can initiate workflow
      if (user.role !== 'tool_pusher') {
        return res.status(403).json({ message: "Only Tool Pushers can initiate workflow" });
      }

      // Initialize workflow through lifecycle service
      await lifecycleService.initializeWorkflow(reportId);
      res.json({ message: "Workflow initiated successfully" });
    } catch (error) {
      console.error("Error initiating workflow:", error);
      res.status(500).json({ message: "Failed to initiate workflow" });
    }
  });

  app.post('/api/npt-reports/:id/workflow-action', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const { action, comments, editedData } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }

      const report = await storage.getNptReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Check if user can perform action based on report status and user role
      const canPerform = ['tool_pusher', 'drilling_superintendent', 'operations_superintendent'].includes(user.role || '');
      if (!canPerform) {
        return res.status(403).json({ message: "You cannot perform actions on this report at this stage" });
      }

      // Process workflow action through lifecycle service
      await lifecycleService.processWorkflowAction(
        reportId,
        userId,
        user.role || '',
        action,
        comments,
        editedData
      );

      res.json({ message: `Report ${action}ed successfully` });
    } catch (error) {
      console.error("Error processing workflow action:", error);
      res.status(500).json({ message: "Failed to process workflow action" });
    }
  });

  app.get('/api/npt-reports/pending-approval', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }

      // Map user role to workflow role
      const roleMapping: Record<string, string> = {
        'Tool Pusher': 'tool_pusher',
        'Drilling Supervisor': 'ds',
        'DS': 'ds',
        'PME': 'pme',
        'E-Maintenance Engineer': 'pme',
        'OSE': 'ose',
        'Operation Support Engineer': 'ose',
      };
      
      const workflowRole = roleMapping[user.role || ''] || user.role?.toLowerCase() || '';
      const reports = await storage.getReportsByApprover(workflowRole);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching pending reports:", error);
      res.status(500).json({ message: "Failed to fetch pending reports" });
    }
  });

  app.get('/api/npt-reports/:id/workflow-history', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const approvals = await storage.getWorkflowApprovals(reportId);
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching workflow history:", error);
      res.status(500).json({ message: "Failed to fetch workflow history" });
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

  // =============================================================================
  // LIFECYCLE TRACKING ROUTES (Monthly NPT Reports with daily granularity)
  // =============================================================================

  // Get all monthly reports with filtering
  app.get('/api/monthly-reports', isAuthenticated, async (req: any, res) => {
    try {
      const { rigId, month, status } = req.query;
      const filters: any = {};
      if (rigId) filters.rigId = parseInt(rigId);
      if (month) filters.month = month;
      if (status) filters.status = status;

      const reports = await storage.getMonthlyReports(filters);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching monthly reports:", error);
      res.status(500).json({ message: "Failed to fetch monthly reports" });
    }
  });

  // Get specific monthly report
  app.get('/api/monthly-reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const report = await storage.getMonthlyReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: "Monthly report not found" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error fetching monthly report:", error);
      res.status(500).json({ message: "Failed to fetch monthly report" });
    }
  });

  // Create or get monthly report for a specific month/rig
  app.post('/api/monthly-reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { month, rigId } = req.body;

      if (!month || !rigId) {
        return res.status(400).json({ message: "Month and rigId are required" });
      }

      const report = await lifecycleService.getOrCreateMonthlyReport(month, rigId, userId);
      res.json(report);
    } catch (error) {
      console.error("Error creating monthly report:", error);
      res.status(500).json({ message: "Failed to create monthly report" });
    }
  });

  // Submit monthly report for approval
  app.post('/api/monthly-reports/:id/submit', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { comments } = req.body;

      const report = await lifecycleService.submitReport(reportId, userId, comments);
      res.json(report);
    } catch (error) {
      console.error("Error submitting monthly report:", error);
      res.status(400).json({ message: error.message || "Failed to submit monthly report" });
    }
  });

  // Approve monthly report
  app.post('/api/monthly-reports/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { comments } = req.body;
      
      // Check if user has approval permissions
      const user = await storage.getUser(userId);
      if (!user || !['admin', 'supervisor'].includes(user.role?.toLowerCase() || '')) {
        return res.status(403).json({ message: "Only supervisors and admins can approve reports" });
      }

      const report = await lifecycleService.approveReport(reportId, userId, comments);
      res.json(report);
    } catch (error) {
      console.error("Error approving monthly report:", error);
      res.status(400).json({ message: error.message || "Failed to approve monthly report" });
    }
  });

  // Reject monthly report
  app.post('/api/monthly-reports/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }
      
      // Check if user has approval permissions
      const user = await storage.getUser(userId);
      if (!user || !['admin', 'supervisor'].includes(user.role?.toLowerCase() || '')) {
        return res.status(403).json({ message: "Only supervisors and admins can reject reports" });
      }

      const report = await lifecycleService.rejectReport(reportId, userId, reason);
      res.json(report);
    } catch (error) {
      console.error("Error rejecting monthly report:", error);
      res.status(400).json({ message: error.message || "Failed to reject monthly report" });
    }
  });

  // Resubmit rejected report
  app.post('/api/monthly-reports/:id/resubmit', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { comments } = req.body;

      const report = await lifecycleService.resubmitReport(reportId, userId, comments);
      res.json(report);
    } catch (error) {
      console.error("Error resubmitting monthly report:", error);
      res.status(400).json({ message: error.message || "Failed to resubmit monthly report" });
    }
  });

  // Get timeline data for a monthly report (day slices + stage events)
  app.get('/api/monthly-reports/:id/timeline', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const timelineData = await lifecycleService.getTimelineData(reportId);
      res.json(timelineData);
    } catch (error) {
      console.error("Error fetching timeline data:", error);
      res.status(500).json({ message: error.message || "Failed to fetch timeline data" });
    }
  });

  // Update day slice
  app.put('/api/monthly-reports/:id/days/:date', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const date = new Date(req.params.date);
      const userId = req.user.claims.sub;
      const dayData = req.body;

      const daySlice = await lifecycleService.updateDaySlice(reportId, date, dayData, userId);
      res.json(daySlice);
    } catch (error) {
      console.error("Error updating day slice:", error);
      res.status(500).json({ message: "Failed to update day slice" });
    }
  });

  // Link NPT reports to a specific day
  app.post('/api/monthly-reports/:id/days/:date/link-npt', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const date = new Date(req.params.date);
      const userId = req.user.claims.sub;
      const { nptReportIds } = req.body;

      const daySlice = await lifecycleService.linkNptReportToDay(reportId, date, nptReportIds, userId);
      res.json(daySlice);
    } catch (error) {
      console.error("Error linking NPT reports to day:", error);
      res.status(500).json({ message: "Failed to link NPT reports to day" });
    }
  });

  // Get KPIs and analytics
  app.get('/api/lifecycle/kpis', isAuthenticated, async (req: any, res) => {
    try {
      const { rigId, startMonth, endMonth } = req.query;
      const filters: any = {};
      if (rigId) filters.rigId = parseInt(rigId);
      if (startMonth) filters.startMonth = startMonth;
      if (endMonth) filters.endMonth = endMonth;

      const kpis = await lifecycleService.getKPIs(filters);
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      res.status(500).json({ message: "Failed to fetch KPIs" });
    }
  });

  // Get user notifications
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { unreadOnly } = req.query;
      
      const notifications = await storage.getNotifications(userId, unreadOnly === 'true');
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.put('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.put('/api/notifications/read-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Smart NPT Tracking - Report Deliveries Endpoints
  app.get('/api/report-deliveries', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = req.query.reportId ? parseInt(req.query.reportId as string) : undefined;
      const deliveries = await storage.getReportDeliveries(reportId);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching report deliveries:", error);
      res.status(500).json({ message: "Failed to fetch report deliveries" });
    }
  });

  app.post('/api/report-deliveries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'supervisor'].includes(user.role || '')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const validatedData = insertReportDeliverySchema.parse(req.body);
      const delivery = await storage.createReportDelivery(validatedData);
      res.status(201).json(delivery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating report delivery:", error);
      res.status(500).json({ message: "Failed to create report delivery" });
    }
  });

  app.patch('/api/report-deliveries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'supervisor'].includes(user.role || '')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const updatedDelivery = await storage.updateReportDelivery(parseInt(id), req.body);
      res.json(updatedDelivery);
    } catch (error) {
      console.error("Error updating report delivery:", error);
      res.status(500).json({ message: "Failed to update report delivery" });
    }
  });

  // Smart NPT Tracking - Alert Rules Endpoints
  app.get('/api/alert-rules', isAuthenticated, async (req: any, res) => {
    try {
      const rules = await storage.getAlertRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching alert rules:", error);
      res.status(500).json({ message: "Failed to fetch alert rules" });
    }
  });

  app.post('/api/alert-rules', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create alert rules" });
      }
      
      const validatedData = insertAlertRuleSchema.parse(req.body);
      const rule = await storage.createAlertRule(validatedData);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating alert rule:", error);
      res.status(500).json({ message: "Failed to create alert rule" });
    }
  });

  app.patch('/api/alert-rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update alert rules" });
      }
      
      const updatedRule = await storage.updateAlertRule(parseInt(id), req.body);
      res.json(updatedRule);
    } catch (error) {
      console.error("Error updating alert rule:", error);
      res.status(500).json({ message: "Failed to update alert rule" });
    }
  });

  app.delete('/api/alert-rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete alert rules" });
      }
      
      await storage.deleteAlertRule(parseInt(id));
      res.json({ message: "Alert rule deleted successfully" });
    } catch (error) {
      console.error("Error deleting alert rule:", error);
      res.status(500).json({ message: "Failed to delete alert rule" });
    }
  });

  // Today's queue endpoint for Smart NPT Tracking dashboard
  app.get('/api/todays-queue', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const today = new Date();
      const todayQueue = await lifecycleService.getTodaysQueue(user.role || '', today);
      
      res.json(todayQueue);
    } catch (error) {
      console.error("Error fetching today's queue:", error);
      res.status(500).json({ message: "Failed to fetch today's queue" });
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
