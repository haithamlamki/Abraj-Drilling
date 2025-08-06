// Workflow management constants and types

export const ROLE_KEYS = [
  'toolpusher',
  'e_maintenance', 
  'ds',
  'ose'
] as const;

export type RoleKey = typeof ROLE_KEYS[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  toolpusher: 'Tool Pusher',
  e_maintenance: 'E-Maintenance', 
  ds: 'Drilling Supervisor',
  ose: 'Operations Support Engineer'
};

export const NPT_STATUS = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
} as const;

export type NptStatus = typeof NPT_STATUS[keyof typeof NPT_STATUS];

// Workflow step configuration
export interface WorkflowStepConfig {
  stepOrder: number;
  approverType: 'role' | 'user';
  roleKey?: RoleKey;
  userId?: string;
  isRequired: boolean;
}

// Default approval workflow - fallback when no custom workflow is configured
export const DEFAULT_APPROVAL_WORKFLOW: WorkflowStepConfig[] = [
  {
    stepOrder: 1,
    approverType: 'role',
    roleKey: 'toolpusher',
    isRequired: true
  },
  {
    stepOrder: 2, 
    approverType: 'role',
    roleKey: 'ds',
    isRequired: true
  },
  {
    stepOrder: 3,
    approverType: 'role', 
    roleKey: 'ose',
    isRequired: true
  }
];

// Default E-Maintenance workflow - used for E-Maintenance department NPTs
export const E_MAINTENANCE_WORKFLOW: WorkflowStepConfig[] = [
  {
    stepOrder: 1,
    approverType: 'role',
    roleKey: 'toolpusher',
    isRequired: true
  },
  {
    stepOrder: 2,
    approverType: 'role',
    roleKey: 'e_maintenance', 
    isRequired: true
  },
  {
    stepOrder: 3,
    approverType: 'role',
    roleKey: 'ds',
    isRequired: true
  },
  {
    stepOrder: 4,
    approverType: 'role',
    roleKey: 'ose',
    isRequired: true
  }
];