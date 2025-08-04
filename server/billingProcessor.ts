import type { BillingSheetRow, BillingUploadResult } from "@shared/billingTypes";

export class BillingProcessor {
  
  // Keywords for rate type detection
  private readonly rateTypeKeywords = {
    repairRate: ['repair rate', 'repair_rate', 'repair'],
    reduceRate: ['reduce repair rate', 'reduced rate', 'reduce_rate', 'reduced'],
    zeroRate: ['zero rate', 'zero_rate', 'zero'],
    operationRate: ['operation rate', 'operation_rate', 'operation', 'drilling rate', 'drilling_rate']
  };

  // Equipment keywords for extraction
  private readonly equipmentKeywords = [
    'mud pump', 'pump', 'bop', 'mast', 'engine', 'esp', 'generator', 
    'circulation', 'rotary', 'hoisting', 'power', 'safety', 'wellhead',
    'choke', 'manifold', 'accumulator', 'liner', 'piston', 'valve'
  ];

  // Process uploaded billing sheet content
  async processBillingSheet(fileName: string, content: string): Promise<BillingUploadResult> {
    const result: BillingUploadResult = {
      fileName,
      totalRows: 0,
      processedRows: 0,
      errors: [],
      extractedData: []
    };

    try {
      // Parse CSV/Excel-like content
      const lines = content.split('\n').filter(line => line.trim());
      result.totalRows = lines.length - 1; // Exclude header

      // Extract rig number from filename or content
      const rigNumber = this.extractRigNumber(fileName, content);
      
      // Process each data row (skip header)
      for (let i = 1; i < lines.length; i++) {
        try {
          const rowData = this.parseRow(lines[i], rigNumber);
          if (rowData) {
            result.extractedData.push(rowData);
            result.processedRows++;
          }
        } catch (error) {
          result.errors.push(`Row ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      result.errors.push(`File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private extractRigNumber(fileName: string, content: string): string {
    // Extract from filename patterns like "RABA-44", "Raba East 47", etc.
    const fileNameMatch = fileName.match(/(?:RABA[_-]?|Raba\s+East\s+)(\d+)/i);
    if (fileNameMatch) {
      return fileNameMatch[1];
    }

    // Extract from content header
    const contentMatch = content.match(/rig\s*(?:number|#)?\s*:?\s*(\d+)/i);
    if (contentMatch) {
      return contentMatch[1];
    }

    return 'Unknown';
  }

  private parseRow(rowText: string, rigNumber: string): BillingSheetRow | null {
    const cells = rowText.split(',').map(cell => cell.trim().replace(/['"]/g, ''));
    
    if (cells.length < 4) return null; // Need at least date, hours, rate info, description

    // Extract date (assuming format like "22-06-2025" or similar)
    const dateStr = cells[0];
    const date = this.parseDate(dateStr);
    if (!date) throw new Error(`Invalid date format: ${dateStr}`);

    // Extract hours
    const hoursStr = cells.find(cell => /^\d+(\.\d+)?$/.test(cell)) || '0';
    const hours = parseFloat(hoursStr);
    if (hours <= 0) return null; // Skip rows with no hours

    // Determine rate type and NBT type
    const { rateType, nbtType } = this.determineRateType(rowText);

    // Extract description (usually the longest text field)
    const description = cells.find(cell => cell.length > 10) || '';

    // Extract equipment and failure from description
    const extractedEquipment = this.extractEquipment(description);
    const extractedFailure = this.extractFailure(description);

    return {
      rigNumber,
      date,
      year: date.getFullYear(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      hours,
      nbtType,
      rateType,
      description,
      extractedEquipment,
      extractedFailure
    };
  }

  private parseDate(dateStr: string): Date | null {
    // Handle various date formats
    const formats = [
      /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const [, p1, p2, p3] = match;
        // Try both DD-MM-YYYY and YYYY-MM-DD interpretations
        const date1 = new Date(parseInt(p3), parseInt(p2) - 1, parseInt(p1));
        const date2 = new Date(parseInt(p1), parseInt(p2) - 1, parseInt(p3));
        
        return date1.getFullYear() > 2000 ? date1 : date2;
      }
    }

    return null;
  }

  private determineRateType(rowText: string): { rateType: BillingSheetRow['rateType'], nbtType: BillingSheetRow['nbtType'] } {
    const lowerText = rowText.toLowerCase();

    // Check for repair rate
    if (this.rateTypeKeywords.repairRate.some(keyword => lowerText.includes(keyword))) {
      return { rateType: 'Repair Rate', nbtType: 'Abroad' };
    }

    // Check for reduce repair rate
    if (this.rateTypeKeywords.reduceRate.some(keyword => lowerText.includes(keyword))) {
      return { rateType: 'Reduce Repair Rate', nbtType: 'Abroad' };
    }

    // Check for zero rate
    if (this.rateTypeKeywords.zeroRate.some(keyword => lowerText.includes(keyword))) {
      return { rateType: 'Zero Rate', nbtType: 'Abroad' };
    }

    // Check for operation rate
    if (this.rateTypeKeywords.operationRate.some(keyword => lowerText.includes(keyword))) {
      return { rateType: 'Operation Rate', nbtType: 'Contractual' };
    }

    // Default to contractual for other rates
    return { rateType: 'Other', nbtType: 'Contractual' };
  }

  private extractEquipment(description: string): string | undefined {
    const lowerDesc = description.toLowerCase();
    
    for (const equipment of this.equipmentKeywords) {
      if (lowerDesc.includes(equipment)) {
        return equipment.charAt(0).toUpperCase() + equipment.slice(1);
      }
    }

    return undefined;
  }

  private extractFailure(description: string): string | undefined {
    const failureKeywords = [
      'failure', 'failed', 'break', 'broken', 'malfunction', 'issue', 
      'problem', 'fault', 'error', 'damage', 'damaged', 'leak', 'stuck'
    ];

    const lowerDesc = description.toLowerCase();
    
    for (const keyword of failureKeywords) {
      if (lowerDesc.includes(keyword)) {
        // Extract sentence containing the failure keyword
        const sentences = description.split(/[.!?]/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(keyword)) {
            return sentence.trim();
          }
        }
      }
    }

    return undefined;
  }
}