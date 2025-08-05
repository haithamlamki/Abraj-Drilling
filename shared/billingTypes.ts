// Types for billing sheet processing
export interface BillingSheetRow {
  rigNumber: string;
  date: Date;
  year: number;
  month: string;
  hours: number;
  nbtType: 'Abroad' | 'Contractual';
  rateType: 'Repair Rate' | 'Reduce Repair Rate' | 'Zero Rate' | 'Operation Rate' | 'Other';
  description: string;
  extractedEquipment?: string;
  extractedSystem?: string;
  extractedFailure?: string;
  confidence?: number;
  nptReportData?: NptReportData;
}

export interface NptReportData {
  rigId: string;
  date: string;
  hours: number;
  nptType: 'Abroad' | 'Contractual';
  wellName?: string;
  status: 'Draft';
  // Contractual fields
  contractualProcess?: string;
  // Abraj fields
  system?: string;
  parentEquipment?: string;
  partEquipment?: string;
  department?: string;
  immediateCause?: string;
  rootCause?: string;
  correctiveAction?: string;
  futureAction?: string;
  actionParty?: string;
  notificationNumber?: string;
  investigationReport?: string;
}

export interface BillingUploadResult {
  fileName: string;
  totalRows: number;
  processedRows: number;
  errors: string[];
  extractedData: BillingSheetRow[];
  recognitionSummary: {
    repairRateRows: number;
    reducedRateRows: number;
    zeroRateRows: number;
    contractualRows: number;
    abroadRows: number;
  };
}

export interface BillingSheetUpload {
  id: string;
  fileName: string;
  uploadDate: Date;
  uploadedBy: string;
  status: 'Processing' | 'Completed' | 'Failed';
  result?: BillingUploadResult;
}