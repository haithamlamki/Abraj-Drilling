import { z } from "zod";
import { needsN2, needsInvestigationReport, isContractual, isAbraj } from "@shared/nptRules";

// Build NPT schema based on mode
export function buildNptBulkSchema(mode: "draft" | "review") {
  // Base schema with all fields optional
  const baseSchema = z.object({
    rigNumber: z.union([z.string(), z.number()]).optional(),
    year: z.union([z.string(), z.number()]).optional(), 
    month: z.union([z.string(), z.number()]).optional(),
    date: z.string().optional(),
    hours: z.union([z.string(), z.number()]).optional(),
    nptType: z.string().optional(),
    system: z.string().optional(),
    equipment: z.string().optional(),
    partEquipment: z.string().optional(),
    contractualProcess: z.string().optional(),
    immediateCause: z.string().optional(),
    rootCause: z.string().optional(),
    correctiveAction: z.string().optional(),
    futureAction: z.string().optional(),
    department: z.string().optional(),
    actionParty: z.string().optional(),
    wellName: z.string().optional(),
    notificationNumber: z.string().optional(),
    investigationWellName: z.string().optional(),
    investigationFileId: z.string().optional(),
    investigationAiText: z.string().optional(),
    status: z.string().optional(),
    nptReportData: z.any().optional(), // For billing sheet data
  });

  if (mode === "draft") {
    // Draft mode: accept anything, just coerce hours to quarter steps if present
    return baseSchema.transform((val) => {
      if (val.hours !== undefined && val.hours !== null && val.hours !== '') {
        const hoursNum = typeof val.hours === 'string' ? parseFloat(val.hours) : val.hours;
        if (!isNaN(hoursNum)) {
          const clamped = Math.min(24, Math.max(0, hoursNum));
          val.hours = Math.round(clamped / 0.25) * 0.25;
        }
      }
      return val;
    });
  }

  // Review mode: strict validation with business rules
  const reviewSchema = z.object({
    rigNumber: z.union([z.string().min(1), z.number()]),
    year: z.union([z.string().min(1), z.number()]),
    month: z.union([z.string().min(1), z.number()]),
    date: z.string().min(1, "Date is required"),
    hours: z.union([z.string().min(1), z.number()]).transform(val => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      const clamped = Math.min(24, Math.max(0, num));
      return Math.round(clamped / 0.25) * 0.25;
    }),
    nptType: z.string().min(1, "NPT Type is required"),
    system: z.string().optional(),
    equipment: z.string().optional(),
    partEquipment: z.string().optional(),
    contractualProcess: z.string().optional(),
    immediateCause: z.string().optional(),
    rootCause: z.string().optional(),
    correctiveAction: z.string().optional(),
    futureAction: z.string().optional(),
    department: z.string().optional(),
    actionParty: z.string().optional(),
    wellName: z.string().optional(),
    notificationNumber: z.string().optional(),
    investigationWellName: z.string().optional(),
    investigationFileId: z.string().optional(),
    investigationAiText: z.string().optional(),
    status: z.string().optional(),
    nptReportData: z.any().optional(),
  }).superRefine((data, ctx) => {
    // Business rule validations only for review mode
    const hours = typeof data.hours === 'string' ? parseFloat(data.hours) : data.hours;
    
    // N2 Number requirement
    if (needsN2(data.department, hours)) {
      if (!data.notificationNumber || data.notificationNumber.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `N2 Number is required for ${data.department} when hours are between ${
            data.department === 'Drilling & Project' ? '3.75-5.75' : '2.0-5.75'
          }`,
          path: ['notificationNumber']
        });
      }
    }
    
    // Investigation requirement
    if (needsInvestigationReport(hours)) {
      const hasFile = data.investigationFileId && data.investigationFileId.trim() !== '';
      const hasAiText = data.investigationAiText && data.investigationAiText.trim() !== '';
      
      if (!hasFile && !hasAiText) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Failure Investigation Report required (file upload or AI-generated text) when hours ≥ 6.0',
          path: ['investigationWellName']
        });
      }
    }
    
    // NPT Type specific field requirements
    if (isContractual(data.nptType)) {
      if (!data.contractualProcess || data.contractualProcess.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Contractual Process is required for Contractual NPT type',
          path: ['contractualProcess']
        });
      }
    }
    
    if (isAbraj(data.nptType)) {
      if (!data.department || data.department.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Department is required for Abraj NPT type',
          path: ['department']
        });
      }
      
      if (!data.equipment || data.equipment.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Equipment is required for Abraj NPT type',
          path: ['equipment']
        });
      }
    }
  });

  return reviewSchema;
}

// Schema for bulk operation with multiple rows
export function buildBulkNptSchema(mode: "draft" | "review") {
  const rowSchema = buildNptBulkSchema(mode);
  return z.object({
    rows: z.array(rowSchema)
  });
}