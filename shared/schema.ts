import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  jsonb,
  index,
  serial,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (Required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (Required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"), // Add password field for custom login
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("drilling_manager"), // admin, supervisor, drilling_manager
  rigId: integer("rig_id").references(() => rigs.id), // Kept for backward compatibility
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rigs table
export const rigs = pgTable("rigs", {
  id: serial("id").primaryKey(),
  rigNumber: integer("rig_number").unique().notNull(),
  rigName: varchar("rig_name"), // Optional display name for special rigs like "Hoist 1"
  section: varchar("section").notNull(), // drilling/hoist
  client: varchar("client"),
  location: varchar("location"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User-Rig junction table for many-to-many relationship
export const userRigs = pgTable("user_rigs", {
  userId: varchar("user_id").references(() => users.id).notNull(),
  rigId: integer("rig_id").references(() => rigs.id).notNull(),
}, (table) => [
  index("idx_user_rigs_user").on(table.userId),
  index("idx_user_rigs_rig").on(table.rigId),
]);

// NPT Reports table
export const nptReports = pgTable("npt_reports", {
  id: serial("id").primaryKey(),
  rigId: integer("rig_id").references(() => rigs.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  year: integer("year").notNull(),
  month: varchar("month", { length: 3 }).notNull(),
  hours: decimal("hours", { precision: 10, scale: 2 }).notNull(),
  nptType: varchar("npt_type").notNull(), // Contractual, Abraj
  system: varchar("system"),
  parentEquipment: varchar("parent_equipment"),
  partEquipment: varchar("part_equipment"),
  contractualProcess: text("contractual_process"),
  department: varchar("department"),
  immediateCause: text("immediate_cause"),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  futureAction: text("future_action"),
  actionParty: varchar("action_party"),
  notificationNumber: varchar("notification_number"),
  investigationReport: varchar("investigation_report"),
  // Enhanced fields for conditional requirements
  n2Number: varchar("n2_number"),
  investigationFileId: varchar("investigation_file_id"),
  investigationAiText: text("investigation_ai_text"),
  wellName: varchar("well_name"),
  status: varchar("status").default('DRAFT'), // DRAFT, PENDING_REVIEW, APPROVED, REJECTED
  rejectionReason: text("rejection_reason"),
  // Enhanced workflow fields for delegation system
  currentStepOrder: integer("current_step_order"),
  currentNominalUserId: varchar("current_nominal_user_id").references(() => users.id),
  currentApproverUserId: varchar("current_approver_user_id").references(() => users.id),
  workflowStatus: varchar("workflow_status").default('initiated'), // initiated, pending_ds, pending_pme, pending_ose, approved, rejected
  currentApprover: varchar("current_approver"), // Current role waiting for approval (legacy)
  workflowPath: varchar("workflow_path"), // drilling or e-maintenance
  initiatedBy: varchar("initiated_by").references(() => users.id),
  initiatedAt: timestamp("initiated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow Approvals table
export const workflowApprovals = pgTable("workflow_approvals", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => nptReports.id).notNull(),
  approverId: varchar("approver_id").references(() => users.id).notNull(),
  approverRole: varchar("approver_role").notNull(), // tool_pusher, ds, pme, ose
  action: varchar("action").notNull(), // approve, reject, edit
  comments: text("comments"),
  editedFields: jsonb("edited_fields"), // Track which fields were edited
  previousValues: jsonb("previous_values"), // Store previous values before edit
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_workflow_approvals_report").on(table.reportId),
  index("idx_workflow_approvals_approver").on(table.approverId),
]);

// Workflow definitions (scoped per rig; null = global default)
export const workflowDefinitions = pgTable("workflow_definitions", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  rigId: integer("rig_id").references(() => rigs.id), // null = global default
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workflow steps configuration
export const workflowSteps = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflowDefinitions.id).notNull(),
  stepOrder: integer("step_order").notNull(),
  approverType: varchar("approver_type").notNull(), // 'role' | 'user'
  roleKey: varchar("role_key"), // when approver_type = 'role'
  userId: varchar("user_id").references(() => users.id), // when approver_type = 'user'
  isRequired: boolean("is_required").notNull().default(true),
}, (table) => [
  index("idx_workflow_steps_workflow").on(table.workflowId),
]);

// Per-report approval trail with enhanced tracking
export const nptApprovals = pgTable("npt_approvals", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => nptReports.id, { onDelete: "cascade" }).notNull(),
  stepOrder: integer("step_order").notNull(),
  approverUserId: varchar("approver_user_id").references(() => users.id).notNull(),
  delegatedFromUserId: varchar("delegated_from_user_id").references(() => users.id),
  action: varchar("action").notNull(), // 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_npt_approvals_report").on(table.reportId),
  index("idx_npt_approvals_approver").on(table.approverUserId),
]);

// Delegations for out-of-office approvals
export const delegations = pgTable("delegations", {
  id: serial("id").primaryKey(),
  delegatorUserId: varchar("delegator_user_id").references(() => users.id).notNull(),
  delegateUserId: varchar("delegate_user_id").references(() => users.id).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  rigId: integer("rig_id").references(() => rigs.id), // null = all rigs
  roleKey: varchar("role_key"), // null = all roles
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_delegations_delegator").on(table.delegatorUserId),
  index("idx_delegations_delegate").on(table.delegateUserId),
  index("idx_delegations_active").on(table.isActive),
]);

// Role assignments (which users are assigned to roles for specific rigs)
export const roleAssignments = pgTable("role_assignments", {
  id: serial("id").primaryKey(),
  rigId: integer("rig_id").references(() => rigs.id).notNull(),
  roleKey: varchar("role_key").notNull(), // toolpusher, e_maintenance, ds, osc
  userId: varchar("user_id").references(() => users.id).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("ux_role_assign").on(table.rigId, table.roleKey, table.userId),
  index("idx_role_assignments_user").on(table.userId),
]);

// Monthly NPT Report tracking (aggregation of daily entries)
export const monthlyReports = pgTable("monthly_reports", {
  id: serial("id").primaryKey(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM format
  rigId: integer("rig_id").references(() => rigs.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  status: varchar("status").notNull().default('Draft'), // Draft, Submitted, In_Review, Approved, Rejected
  slaDays: integer("sla_days").default(7), // SLA in days for approval
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }).default('0'),
  contractualHours: decimal("contractual_hours", { precision: 10, scale: 2 }).default('0'),
  operationalHours: decimal("operational_hours", { precision: 10, scale: 2 }).default('0'),
  abrajHours: decimal("abraj_hours", { precision: 10, scale: 2 }).default('0'),
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_monthly_reports_month_rig").on(table.month, table.rigId),
  index("idx_monthly_reports_status").on(table.status),
]);

// Stage Events (audit log for report lifecycle)
export const stageEvents = pgTable("stage_events", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => monthlyReports.id).notNull(),
  stage: varchar("stage").notNull(), // Created, Submitted, Reviewed, Approved, Rejected, Resubmitted
  byUser: varchar("by_user").references(() => users.id).notNull(),
  comments: text("comments"),
  previousStage: varchar("previous_stage"),
  metadata: jsonb("metadata"), // Additional data like approval time, etc.
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_events_report").on(table.reportId),
  index("idx_stage_events_stage").on(table.stage),
  index("idx_stage_events_user").on(table.byUser),
]);

// Day Slices (daily timeline tracking)
export const daySlices = pgTable("day_slices", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => monthlyReports.id).notNull(),
  date: timestamp("date").notNull(), // Specific day within the month
  dayStatus: varchar("day_status").notNull().default('No-Entry'), // No-Entry, Draft, Submitted, In_Review, Approved
  hours: decimal("hours", { precision: 10, scale: 2 }).default('0'),
  nptType: varchar("npt_type"), // Contractual, Operational, Abraj
  notes: text("notes"),
  nptReportIds: jsonb("npt_report_ids"), // Array of NPT report IDs for this day
  lastUpdated: timestamp("last_updated").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_day_slices_report_date").on(table.reportId, table.date),
  index("idx_day_slices_status").on(table.dayStatus),
]);

// Notifications for alerts and reminders
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => monthlyReports.id),
  rule: varchar("rule").notNull(), // pending_approval, over_sla, missing_entry, stalled
  recipient: varchar("recipient").references(() => users.id).notNull(),
  message: text("message").notNull(),
  channel: varchar("channel").default('email'), // email, in_app, sms
  isRead: boolean("is_read").default(false),
  sentAt: timestamp("sent_at").defaultNow(),
  metadata: jsonb("metadata"), // Additional context data
}, (table) => [
  index("idx_notifications_recipient").on(table.recipient),
  index("idx_notifications_rule").on(table.rule),
  index("idx_notifications_sent").on(table.sentAt),
]);

// Report Deliveries - Track delivery windows
export const reportDeliveries = pgTable("report_deliveries", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => monthlyReports.id).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  deliveredAt: timestamp("delivered_at"),
  deliveredBy: varchar("delivered_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_deliveries_report").on(table.reportId),
  index("idx_deliveries_dates").on(table.startDate, table.endDate),
]);

// Alert Rules - Configurable alert conditions
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  code: varchar("code").unique().notNull(), // PENDING_APPROVAL, OVER_SLA, MISSING_DAY, STALLED
  description: text("description").notNull(),
  thresholdHours: integer("threshold_hours").notNull(),
  enabled: boolean("enabled").default(true),
  recipients: jsonb("recipients"), // Array of user IDs or roles
  emailTemplate: text("email_template"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_alert_rules_enabled").on(table.enabled),
]);



// SLA Configuration (keeping existing for compatibility)
export const slaRules = pgTable("sla_rules", {
  id: serial("id").primaryKey(),
  ruleName: varchar("rule_name").notNull(),
  description: text("description"),
  triggerCondition: varchar("trigger_condition").notNull(), // pending_approval, over_sla, missing_entry, stalled
  thresholdHours: integer("threshold_hours").notNull(),
  recipients: jsonb("recipients"), // Array of user IDs or roles
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reference data tables
export const systems = pgTable("systems", {
  id: serial("id").primaryKey(),
  name: varchar("name").unique().notNull(),
  isActive: boolean("is_active").default(true),
});

export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  systemId: integer("system_id").references(() => systems.id),
  isActive: boolean("is_active").default(true),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name").unique().notNull(),
  isActive: boolean("is_active").default(true),
});

export const actionParties = pgTable("action_parties", {
  id: serial("id").primaryKey(),
  name: varchar("name").unique().notNull(),
  isActive: boolean("is_active").default(true),
});

// Relations
export const userRelations = relations(users, ({ one, many }) => ({
  rig: one(rigs, {
    fields: [users.rigId],
    references: [rigs.id],
  }),
  nptReports: many(nptReports),
}));

export const rigRelations = relations(rigs, ({ many }) => ({
  users: many(users),
  nptReports: many(nptReports),
}));

export const nptReportRelations = relations(nptReports, ({ one }) => ({
  rig: one(rigs, {
    fields: [nptReports.rigId],
    references: [rigs.id],
  }),
  user: one(users, {
    fields: [nptReports.userId],
    references: [users.id],
  }),
}));

export const systemRelations = relations(systems, ({ many }) => ({
  equipment: many(equipment),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  system: one(systems, {
    fields: [equipment.systemId],
    references: [systems.id],
  }),
}));

export const monthlyReportRelations = relations(monthlyReports, ({ one, many }) => ({
  rig: one(rigs, {
    fields: [monthlyReports.rigId],
    references: [rigs.id],
  }),
  createdByUser: one(users, {
    fields: [monthlyReports.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [monthlyReports.approvedBy],
    references: [users.id],
  }),
  stageEvents: many(stageEvents),
  daySlices: many(daySlices),
  notifications: many(notifications),
  deliveries: many(reportDeliveries),
}));

export const stageEventRelations = relations(stageEvents, ({ one }) => ({
  report: one(monthlyReports, {
    fields: [stageEvents.reportId],
    references: [monthlyReports.id],
  }),
  user: one(users, {
    fields: [stageEvents.byUser],
    references: [users.id],
  }),
}));

export const daySliceRelations = relations(daySlices, ({ one }) => ({
  report: one(monthlyReports, {
    fields: [daySlices.reportId],
    references: [monthlyReports.id],
  }),
  updatedByUser: one(users, {
    fields: [daySlices.updatedBy],
    references: [users.id],
  }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  report: one(monthlyReports, {
    fields: [notifications.reportId],
    references: [monthlyReports.id],
  }),
  recipientUser: one(users, {
    fields: [notifications.recipient],
    references: [users.id],
  }),
}));

export const reportDeliveryRelations = relations(reportDeliveries, ({ one }) => ({
  report: one(monthlyReports, {
    fields: [reportDeliveries.reportId],
    references: [monthlyReports.id],
  }),
  deliveredByUser: one(users, {
    fields: [reportDeliveries.deliveredBy],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNptReportSchema = createInsertSchema(nptReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  year: true,  // Remove from required fields - will be derived server-side
  month: true, // Remove from required fields - will be derived server-side
}).extend({
  date: z.string().transform((val) => new Date(val)),
  hours: z.number().min(0).max(24),
});

// Server-side schema for processing with transformations
export const serverNptReportSchema = insertNptReportSchema.transform((data) => {
  const d = typeof data.date === "string" ? new Date(data.date) : data.date;
  const snappedHours = Math.round(data.hours * 4) / 4; // Snap to quarter hours
  
  return {
    ...data,
    date: d,
    hours: snappedHours,
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
  };
}).superRefine((val, ctx) => {
  const isQuarter = (v: number) => Number.isFinite(v) && Math.round(v * 4) === v * 4;
  
  if (!isQuarter(val.hours)) {
    ctx.addIssue({ 
      code: z.ZodIssueCode.custom, 
      path: ["hours"], 
      message: "Hours must be in 0.25 steps" 
    });
  }
  
  // Conditional validation based on NPT type
  if (val.nptType === "Contractual" && !val.contractualProcess?.trim()) {
    ctx.addIssue({ 
      code: z.ZodIssueCode.custom, 
      path: ["contractualProcess"], 
      message: "Contractual process is required for Contractual NPT" 
    });
  }
});

export const insertRigSchema = createInsertSchema(rigs).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSchema = createInsertSchema(systems).omit({
  id: true,
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
});

export const insertActionPartySchema = createInsertSchema(actionParties).omit({
  id: true,
});

export const insertMonthlyReportSchema = createInsertSchema(monthlyReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStageEventSchema = createInsertSchema(stageEvents).omit({
  id: true,
  createdAt: true,
});

export const insertDaySliceSchema = createInsertSchema(daySlices).omit({
  id: true,
  lastUpdated: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  sentAt: true,
});

export const insertSlaRuleSchema = createInsertSchema(slaRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportDeliverySchema = createInsertSchema(reportDeliveries).omit({
  id: true,
  createdAt: true,
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowDefinitionSchema = createInsertSchema(workflowDefinitions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
});

export const insertNptApprovalSchema = createInsertSchema(nptApprovals).omit({
  id: true,
  createdAt: true,
});

export const insertDelegationSchema = createInsertSchema(delegations).omit({
  id: true,
  createdAt: true,
});

export const insertRoleAssignmentSchema = createInsertSchema(roleAssignments).omit({
  id: true,
  createdAt: true,
});



// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Rig = typeof rigs.$inferSelect;
export type InsertRig = z.infer<typeof insertRigSchema>;
export type WorkflowApproval = typeof workflowApprovals.$inferSelect;
export type InsertWorkflowApproval = typeof workflowApprovals.$inferInsert;
export type NptReport = typeof nptReports.$inferSelect;
export type InsertNptReport = z.infer<typeof insertNptReportSchema>;
export type System = typeof systems.$inferSelect;
export type InsertSystem = z.infer<typeof insertSystemSchema>;
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type ActionParty = typeof actionParties.$inferSelect;
export type InsertActionParty = z.infer<typeof insertActionPartySchema>;

// Lifecycle tracking types
export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type InsertMonthlyReport = z.infer<typeof insertMonthlyReportSchema>;
export type StageEvent = typeof stageEvents.$inferSelect;
export type InsertStageEvent = z.infer<typeof insertStageEventSchema>;
export type DaySlice = typeof daySlices.$inferSelect;
export type InsertDaySlice = z.infer<typeof insertDaySliceSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type SlaRule = typeof slaRules.$inferSelect;
export type InsertSlaRule = z.infer<typeof insertSlaRuleSchema>;
export type ReportDelivery = typeof reportDeliveries.$inferSelect;
export type InsertReportDelivery = z.infer<typeof insertReportDeliverySchema>;
export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;

// Enhanced workflow types for delegation system
export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;
export type InsertWorkflowDefinition = typeof workflowDefinitions.$inferInsert;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;
export type NptApproval = typeof nptApprovals.$inferSelect;
export type InsertNptApproval = typeof nptApprovals.$inferInsert;
export type Delegation = typeof delegations.$inferSelect;
export type InsertDelegation = typeof delegations.$inferInsert;
export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type InsertRoleAssignment = typeof roleAssignments.$inferInsert;
