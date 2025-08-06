export const NPT_TYPES = { 
  CONTRACTUAL: "Contractual", 
  ABRAJ: "Abraj" 
} as const;

export const DEPARTMENTS = {
  DRILLING_PROJECT: "Drilling & Project",
  MAINTENANCE_ME: "Maintenance (M/E)",
} as const;

export type NptType = typeof NPT_TYPES[keyof typeof NPT_TYPES];

export const isContractual = (t?: string) => t === NPT_TYPES.CONTRACTUAL;
export const isAbraj = (t?: string) => t === NPT_TYPES.ABRAJ;

export function needsN2(dept?: string, hrs?: number) {
  if (hrs == null) return false;
  if (dept === DEPARTMENTS.DRILLING_PROJECT) return hrs >= 3.75 && hrs <= 5.75;
  if (dept === DEPARTMENTS.MAINTENANCE_ME) return hrs >= 2.0 && hrs <= 5.75;
  return false;
}

export const needsInvestigationReport = (hrs?: number) => (hrs ?? 0) >= 6.0;

// Helper functions for UI feedback
export const getDisabledFieldsHelp = (nptType?: string) => {
  if (isContractual(nptType)) {
    return "Equipment/Failure/Cause fields are locked for Contractual NPT type.";
  }
  if (isAbraj(nptType)) {
    return "Contractual Process field is locked for Abraj NPT type.";
  }
  return null;
};

export const getN2RequirementHelp = (dept?: string, hrs?: number) => {
  if (!needsN2(dept, hrs)) return null;
  
  if (dept === DEPARTMENTS.DRILLING_PROJECT) {
    return "N2 Number is required for Drilling & Project when hours are between 3.75-5.75.";
  }
  if (dept === DEPARTMENTS.MAINTENANCE_ME) {
    return "N2 Number is required for Maintenance (M/E) when hours are between 2.0-5.75.";
  }
  return null;
};

export const getInvestigationRequirementHelp = (hrs?: number) => {
  if (!needsInvestigationReport(hrs)) return null;
  return "Failure Investigation Report (file upload or AI-generated text) is required when hours ≥ 6.0.";
};