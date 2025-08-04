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
  extractedFailure?: string;
}

export interface BillingUploadResult {
  fileName: string;
  totalRows: number;
  processedRows: number;
  errors: string[];
  extractedData: BillingSheetRow[];
}

export interface BillingSheetUpload {
  id: string;
  fileName: string;
  uploadDate: Date;
  uploadedBy: string;
  status: 'Processing' | 'Completed' | 'Failed';
  result?: BillingUploadResult;
}