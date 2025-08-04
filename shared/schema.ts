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
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("drilling_manager"), // admin, supervisor, drilling_manager
  rigId: integer("rig_id").references(() => rigs.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rigs table
export const rigs = pgTable("rigs", {
  id: serial("id").primaryKey(),
  rigNumber: integer("rig_number").unique().notNull(),
  section: varchar("section").notNull(), // drilling/hoist
  client: varchar("client"),
  location: varchar("location"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// NPT Reports table
export const nptReports = pgTable("npt_reports", {
  id: serial("id").primaryKey(),
  rigId: integer("rig_id").references(() => rigs.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  year: integer("year").notNull(),
  month: varchar("month", { length: 3 }).notNull(),
  hours: decimal("hours", { precision: 4, scale: 2 }).notNull(),
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
  wellName: varchar("well_name"),
  status: varchar("status").default('Draft'), // Draft, Pending Review, Approved, Rejected
  rejectionReason: text("rejection_reason"),
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
}).extend({
  date: z.string().transform((val) => new Date(val)),
  hours: z.number().min(0.1).max(24),
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Rig = typeof rigs.$inferSelect;
export type InsertRig = z.infer<typeof insertRigSchema>;
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
