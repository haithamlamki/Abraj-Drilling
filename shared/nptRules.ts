export const NPT_TYPES = { CONTRACTUAL: "Contractual", ABRAJ: "Abraj" } as const;
export const DEPARTMENTS = {
  DRILLING_PROJECT: "Drilling & Project",
  MAINTENANCE_ME: "Maintenance (M/E)",
} as const;

export const isContractual = (t?: string) => t === NPT_TYPES.CONTRACTUAL;
export const isAbraj       = (t?: string) => t === NPT_TYPES.ABRAJ;

export function needsN2(dept?: string, hrs?: number) {
  if (hrs == null) return false;
  if (dept === DEPARTMENTS.DRILLING_PROJECT) return hrs >= 3.75 && hrs <= 5.75;
  if (dept === DEPARTMENTS.MAINTENANCE_ME)   return hrs >= 2.0  && hrs <= 5.75;
  return false;
}
export const needsInvestigationReport = (hrs?: number) => (hrs ?? 0) >= 6.0;

export function enabledFields(nptType?: string) {
  const C = isContractual(nptType);
  const A = isAbraj(nptType);
  
  return {
    system: true,                  // keep editable in both
    department: A,                 // only editable for Abraj
    contractualProcess: C,         // only editable for Contractual

    // Equipment/Failure/Cause group (editable only in Abraj):
    equipment: A,
    thePart: A,
    failureDesc: A,
    rootCause: A,
    corrective: A,
    futureAction: A,
    actionParty: A,

    n2Number: true,                // editable; requirement stays conditional
  } as const;
}

export function cleanupByType<T extends Record<string, any>>(row: T): T {
  const e = enabledFields(row.nptType);
  const out = { ...row };

  if (!e.contractualProcess && 'contractualProcess' in out) {
    (out as any).contractualProcess = "";
  }

  if (!e.department && 'department' in out) {       // clear when not editable
    (out as any).department = "";
  }

  if (!e.equipment && 'equipment' in out) {
    if ('equipment' in out) (out as any).equipment = "";
    if ('thePart' in out) (out as any).thePart = "";
    if ('failureDesc' in out) (out as any).failureDesc = "";
    if ('rootCause' in out) (out as any).rootCause = "";
    if ('corrective' in out) (out as any).corrective = "";
    if ('futureAction' in out) (out as any).futureAction = "";
    if ('actionParty' in out) (out as any).actionParty = "";
  }
  return out;
}

// Helper functions for UI feedback
export const getDisabledFieldsHelp = (nptType?: string) => {
  if (isContractual(nptType)) {
    return "Equipment/Failure/Cause/Department fields are locked for Contractual NPT type.";
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