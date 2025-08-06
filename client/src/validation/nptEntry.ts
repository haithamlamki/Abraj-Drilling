import { z } from "zod";
import { isContractual, isAbraj, needsN2, needsInvestigationReport } from "@shared/nptRules";

export const nptEntrySchema = z.object({
  nptType: z.string().min(1, "NPT Type is required"),
  system: z.string().min(1, "System is required"),
  hours: z.number().min(0).max(24),
  department: z.string().min(1, "Department is required"),

  contractualProcess: z.string().optional(),
  equipment: z.string().optional(),
  thePart: z.string().optional(),
  failureDesc: z.string().optional(),
  rootCause: z.string().optional(),
  corrective: z.string().optional(),
  futureAction: z.string().optional(),
  actionParty: z.string().optional(),

  n2Number: z.string().optional(),
  investigationFileId: z.string().optional(),
  investigationAiText: z.string().optional(),

  // Other existing fields
  rigId: z.number().optional(),
  userId: z.string().optional(),
  date: z.date().optional(),
  wellName: z.string().optional(),
  status: z.string().optional(),
})
.superRefine((v, ctx) => {
  // Required by NPT type
  if (isContractual(v.nptType)) {
    if (!v.contractualProcess?.trim()) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        path: ["contractualProcess"], 
        message: "Contractual Process is required for Contractual NPT type." 
      });
    }
  }
  
  if (isAbraj(v.nptType)) {
    const requiredFields = [
      { field: "equipment", label: "Equipment" },
      { field: "thePart", label: "The Part" },
      { field: "failureDesc", label: "Failure Description" },
      { field: "rootCause", label: "Root Cause" },
      { field: "corrective", label: "Corrective Action" },
      { field: "futureAction", label: "Future Action" },
      { field: "actionParty", label: "Action Party" },
    ] as const;
    
    for (const { field, label } of requiredFields) {
      if (!v[field]?.toString().trim()) {
        ctx.addIssue({ 
          code: z.ZodIssueCode.custom, 
          path: [field], 
          message: `${label} is required for Abraj NPT type.` 
        });
      }
    }
  }

  // N2 conditional requirement
  if (needsN2(v.department, v.hours)) {
    if (!v.n2Number?.toString().trim()) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        path: ["n2Number"], 
        message: "N2 Number is required for this hours range and department." 
      });
    }
  }

  // Investigation report when ≥ 6.0h (file or AI text)
  if (needsInvestigationReport(v.hours)) {
    const hasFile = !!v.investigationFileId?.trim();
    const hasAi = !!v.investigationAiText?.trim();
    if (!hasFile && !hasAi) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        path: ["investigationFileId"], 
        message: "Investigation report (file upload or AI-generated text) is required for ≥ 6.0 hours." 
      });
    }
  }
});

export type NptEntryFormData = z.infer<typeof nptEntrySchema>;