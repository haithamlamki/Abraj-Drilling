import { z } from "zod";
import { isContractual, isAbraj, needsN2, needsInvestigationReport } from "../../shared/nptRules";

export const serverNptSchema = z.object({
  nptType: z.string(),
  system: z.string(),
  hours: z.number(),
  department: z.string(),

  contractualProcess: z.string().optional(),
  equipment: z.string().optional(),
  parentEquipment: z.string().optional(),
  immediateCause: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  futureAction: z.string().optional(),
  actionParty: z.string().optional(),

  n2Number: z.string().optional(),
  investigationFileId: z.string().optional(),
  investigationAiText: z.string().optional(),

  // Other fields that might be present
  rigId: z.number().optional(),
  userId: z.string().optional(),
  date: z.date().optional(),
  wellName: z.string().optional(),
  status: z.string().optional(),
  year: z.number().optional(),
  month: z.string().optional(),
})
// Normalize disabled fields server-side to keep DB clean
.transform(v => {
  if (isContractual(v.nptType)) {
    return {
      ...v,
      // keep system + contractualProcess; wipe the locked group:
      equipment: "",
      parentEquipment: "",
      immediateCause: "",
      rootCause: "",
      correctiveAction: "",
      futureAction: "",
      actionParty: "",
    };
  }
  if (isAbraj(v.nptType)) {
    return { 
      ...v, 
      contractualProcess: "" // locked for Abraj
    };
  }
  return v;
})
.superRefine((v, ctx) => {
  // Same enforcement as front-end
  if (isContractual(v.nptType) && !v.contractualProcess?.trim()) {
    ctx.addIssue({ 
      code: z.ZodIssueCode.custom, 
      path: ["contractualProcess"], 
      message: "Contractual Process is required for Contractual NPT type." 
    });
  }

  if (isAbraj(v.nptType)) {
    const requiredFields = [
      { field: "equipment", label: "Equipment" },
      { field: "parentEquipment", label: "Parent Equipment" },
      { field: "immediateCause", label: "Immediate Cause" },
      { field: "rootCause", label: "Root Cause" },
      { field: "correctiveAction", label: "Corrective Action" },
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

  if (needsN2(v.department, v.hours) && !v.n2Number?.toString().trim()) {
    ctx.addIssue({ 
      code: z.ZodIssueCode.custom, 
      path: ["n2Number"], 
      message: "N2 Number is required for this hours range and department." 
    });
  }

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

export type ServerNptData = z.infer<typeof serverNptSchema>;