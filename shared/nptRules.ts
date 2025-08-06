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

/** Per NPT type, which fields are enabled (true = editable) */
export function enabledFields(nptType?: string) {
  const c = isContractual(nptType);
  const a = isAbraj(nptType);
  return {
    system: true,                         // always editable
    contractualProcess: c,                // editable ONLY for Contractual
    // equipment/failure/cause group:
    equipment: a,
    thePart: a,
    failureDesc: a,
    rootCause: a,
    corrective: a,
    futureAction: a,
    actionParty: a,
    // N2 is editable always, but required only by hours/department
    n2Number: true,
  } as const;
}

/** When type changes, blank the now-disabled fields to keep payload clean */
export function cleanupByType<T extends Record<string, any>>(row: T): T {
  const e = enabledFields(row.nptType);
  const out = { ...row };
  if (!e.contractualProcess && 'contractualProcess' in out) {
    (out as any).contractualProcess = "";
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