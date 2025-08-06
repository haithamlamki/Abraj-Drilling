export const NPT_STATUS = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW", 
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type NptStatus = typeof NPT_STATUS[keyof typeof NPT_STATUS];

export type ApproverType = "role" | "user";

export const APPROVAL_ACTIONS = {
  APPROVE: "APPROVE",
  REJECT: "REJECT", 
  REQUEST_CHANGES: "REQUEST_CHANGES",
} as const;

export type ApprovalAction = typeof APPROVAL_ACTIONS[keyof typeof APPROVAL_ACTIONS];

export const ROLE_KEYS = {
  TOOL_PUSHER: "toolpusher",
  E_MAINTENANCE: "e_maintenance", 
  DS: "ds",
  OSE: "ose",
} as const;

export type RoleKey = typeof ROLE_KEYS[keyof typeof ROLE_KEYS];

export interface WorkflowDefinition {
  id: number;
  name: string;
  rigId: number | null;
  isActive: boolean;
}

export interface WorkflowStep {
  id: number;
  workflowId: number;
  stepOrder: number;
  approverType: ApproverType;
  roleKey: string | null;
  userId: string | null;
  isRequired: boolean;
}

export interface NptApproval {
  id: number;
  reportId: number;
  stepOrder: number;
  approverUserId: string;
  action: ApprovalAction;
  comment: string | null;
  createdAt: Date;
}

export interface Delegation {
  id: number;
  delegatorUserId: string;
  delegateUserId: string;
  startsAt: Date;
  endsAt: Date;
  rigId: number | null;
  roleKey: string | null;
  isActive: boolean;
}

export interface EffectiveApprover {
  id: string;
  name: string;
  roleKey?: string;
  isDelegated?: boolean;
  delegatorName?: string;
}