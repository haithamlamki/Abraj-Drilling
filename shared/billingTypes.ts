// Types for billing sheet processing and NPT generation

export interface BillingSheetRow {
  rigNumber?: string;
  date?: string | Date;
  year?: string;
  month?: string;
  hours?: number | string;
  rateType?: string;
  description?: string;
  nbtType?: string;
  system?: string;
  ticketNumber?: string;
  extractedSystem?: string;
  extractedEquipment?: string;
  extractedFailure?: string;
  extractedData?: {
    description?: string;
    system?: string;
    equipment?: string;
  };
}

export interface ProcessedBillingData {
  fileName: string;
  uploadedAt: Date;
  extractedRows: BillingSheetRow[];
  processingStatus: 'completed' | 'processing' | 'failed';
  errorMessage?: string;
}

export interface BillingUpload {
  id: number;
  fileName: string;
  originalName: string;
  uploadedAt: Date;
  extractedRows: BillingSheetRow[];
  processingStatus: string;
  errorMessage?: string;
}

export interface BillingSheetUpload {
  fileName: string;
  uploadedBy: string;
  status: string;
  result: BillingUploadResult;
}

export interface BillingUploadResult {
  extractedRows: BillingSheetRow[];
  processingStatus: 'completed' | 'processing' | 'failed';
  errorMessage?: string;
  importedCount?: number;
  skippedCount?: number;
}