export const NPT_STATUS = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved", 
  REJECTED: "Rejected",
} as const;

export type NptStatus = typeof NPT_STATUS[keyof typeof NPT_STATUS];