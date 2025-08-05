import type { BillingSheetRow, BillingUploadResult } from "@shared/billingTypes";

export class BillingProcessor {
  
  // Enhanced keywords for intelligent rate type detection
  private readonly rateTypeKeywords = {
    repairRate: [
      'repair rate', 'repair_rate', 'repair', 'rpr rate', 'rpr_rate',
      'maintenance rate', 'maint rate', 'breakdown rate'
    ],
    reduceRate: [
      'reduce repair rate', 'reduced rate', 'reduce_rate', 'reduced', 'reduced_rate',
      'partial rate', 'reduced repair', 'rdcd rate', 'rdcd_rate', 'standby rate'
    ],
    zeroRate: [
      'zero rate', 'zero_rate', 'zero', '0 rate', 'no charge', 'non-billable',
      'npt rate', 'idle rate', 'waiting rate', 'breakdown'
    ],
    operationRate: [
      'operation rate', 'operation_rate', 'operation', 'drilling rate', 'drilling_rate',
      'productive rate', 'normal rate', 'standard rate', 'full rate', 'working rate'
    ]
  };

  // Comprehensive equipment/system keywords for extraction
  private readonly systemEquipmentMap = {
    'Mud Pumps': [
      'mud pump', 'pump', 'triplex pump', 'duplex pump', 'slush pump', 'circulation pump',
      'pump liner', 'pump piston', 'pump valve', 'suction valve', 'discharge valve'
    ],
    'BOP': [
      'bop', 'blowout preventer', 'ram preventer', 'annular preventer', 'blind ram',
      'pipe ram', 'shear ram', 'accumulator', 'choke line', 'kill line'
    ],
    'Hoisting': [
      'mast', 'derrick', 'crown block', 'traveling block', 'hook', 'swivel',
      'kelly', 'rotary table', 'drawworks', 'deadline anchor', 'fast line'
    ],
    'Power System': [
      'engine', 'generator', 'power system', 'diesel engine', 'electric motor',
      'scr house', 'distribution panel', 'transformer', 'electrical system'
    ],
    'Rotary': [
      'rotary table', 'kelly', 'kelly bushing', 'rotary drive', 'top drive',
      'rotary hose', 'rotary slip', 'master bushing'
    ],
    'Circulation': [
      'circulation system', 'standpipe', 'mud manifold', 'choke manifold',
      'mud tank', 'trip tank', 'degasser', 'desander', 'desilter', 'shale shaker'
    ],
    'Safety': [
      'safety system', 'gas detector', 'fire system', 'diverter', 'emergency shutdown',
      'h2s detector', 'escape capsule', 'lifeboat'
    ],
    'Wellhead': [
      'wellhead', 'casing head', 'tubing head', 'christmas tree', 'surface safety valve',
      'wing valve', 'master valve'
    ],
    'ESP': [
      'esp', 'electric submersible pump', 'downhole pump', 'esp motor', 'esp cable',
      'esp controller', 'variable speed drive'
    ]
  };

  // Failure/cause keywords for intelligent extraction
  private readonly failureKeywords = [
    'failure', 'failed', 'break', 'broken', 'malfunction', 'issue', 'problem',
    'fault', 'error', 'damage', 'damaged', 'leak', 'stuck', 'seized', 'worn',
    'cracked', 'torn', 'ruptured', 'blocked', 'clogged', 'overheated', 'tripped'
  ];

  // Rig name patterns for enhanced recognition
  private readonly rigPatterns = [
    /(?:RABA[_-]?)(\d+)/i,
    /(?:Raba\s+East\s+)(\d+)/i,
    /(?:Raba\s+West\s+)(\d+)/i,
    /(?:Rig\s+)(\d+)/i,
    /(?:Unit\s+)(\d+)/i,
    /(?:Platform\s+)(\d+)/i
  ];

  // Process uploaded billing sheet content with intelligent recognition
  async processBillingSheet(fileName: string, content: string): Promise<BillingUploadResult> {
    const result: BillingUploadResult = {
      fileName,
      totalRows: 0,
      processedRows: 0,
      errors: [],
      extractedData: [],
      recognitionSummary: {
        repairRateRows: 0,
        reducedRateRows: 0,
        zeroRateRows: 0,
        contractualRows: 0,
        abroadRows: 0
      }
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
            
            // Update recognition summary
            this.updateRecognitionSummary(result.recognitionSummary, rowData);
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

  private updateRecognitionSummary(summary: BillingUploadResult['recognitionSummary'], rowData: BillingSheetRow): void {
    // Count by rate type
    switch (rowData.rateType) {
      case 'Repair Rate':
        summary.repairRateRows++;
        break;
      case 'Reduce Repair Rate':
        summary.reducedRateRows++;
        break;
      case 'Zero Rate':
        summary.zeroRateRows++;
        break;
    }

    // Count by NBT type
    if (rowData.nbtType === 'Abroad') {
      summary.abroadRows++;
    } else {
      summary.contractualRows++;
    }
  }

  private extractRigNumber(fileName: string, content: string): string {
    // Enhanced rig number extraction using multiple patterns
    for (const pattern of this.rigPatterns) {
      const fileNameMatch = fileName.match(pattern);
      if (fileNameMatch) {
        return fileNameMatch[1];
      }
    }

    // Extract from content header with enhanced patterns
    const contentPatterns = [
      /rig\s*(?:number|#|no)?\s*:?\s*(\d+)/i,
      /unit\s*(?:number|#|no)?\s*:?\s*(\d+)/i,
      /platform\s*(?:number|#|no)?\s*:?\s*(\d+)/i
    ];

    for (const pattern of contentPatterns) {
      const contentMatch = content.match(pattern);
      if (contentMatch) {
        return contentMatch[1];
      }
    }

    return 'Unknown';
  }

  private parseRow(rowText: string, rigNumber: string): BillingSheetRow | null {
    const cells = rowText.split(',').map(cell => cell.trim().replace(/['"]/g, ''));
    
    if (cells.length < 4) return null; // Need at least date, hours, rate info, description

    // Enhanced date extraction with multiple column positions
    const dateStr = this.findDateCell(cells);
    const date = this.parseDate(dateStr);
    if (!date) throw new Error(`Invalid date format: ${dateStr}`);

    // Enhanced hours extraction with column recognition
    const hours = this.findHoursCell(cells);
    if (hours <= 0) return null; // Skip rows with no hours

    // Intelligent rate type detection with column analysis
    const { rateType, nbtType, confidence: rateConfidence } = this.determineRateTypeAdvanced(rowText, cells);

    // Enhanced description extraction
    const description = this.findDescriptionCell(cells);

    // Advanced equipment and failure extraction
    const equipmentData = this.extractEquipment(description);
    const extractedFailure = this.extractFailure(description);

    // Calculate comprehensive confidence score
    let confidence = 0.4 + (rateConfidence * 0.2); // Base + rate detection confidence
    if (equipmentData.equipment) confidence += 0.2;
    if (equipmentData.system) confidence += 0.1;
    if (extractedFailure) confidence += 0.1;

    return {
      rigNumber,
      date,
      year: date.getFullYear(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      hours,
      nbtType,
      rateType,
      description,
      extractedEquipment: equipmentData.equipment,
      extractedSystem: equipmentData.system,
      extractedFailure,
      confidence: Math.min(confidence, 1.0)
    };
  }

  private findDateCell(cells: string[]): string {
    // Look for date patterns in multiple positions
    for (const cell of cells.slice(0, 5)) { // Check first 5 columns
      if (this.isDateFormat(cell)) {
        return cell;
      }
    }
    return cells[0]; // Fallback to first cell
  }

  private findHoursCell(cells: string[]): number {
    // Look for numeric values that could represent hours
    for (const cell of cells) {
      const match = cell.match(/^(\d+(?:\.\d+)?)(?:\s*h(?:ours?)?)?$/i);
      if (match) {
        const hours = parseFloat(match[1]);
        if (hours > 0 && hours <= 24) { // Reasonable hour range
          return hours;
        }
      }
    }
    return 0;
  }

  private findDescriptionCell(cells: string[]): string {
    // Find the longest text cell that's not a date or number
    let bestDescription = '';
    for (const cell of cells) {
      if (cell.length > bestDescription.length && 
          !this.isDateFormat(cell) && 
          !/^\d+(\.\d+)?$/.test(cell)) {
        bestDescription = cell;
      }
    }
    return bestDescription;
  }

  private isDateFormat(text: string): boolean {
    const datePatterns = [
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/,
      /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/,
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2}$/
    ];
    return datePatterns.some(pattern => pattern.test(text));
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

  private determineRateTypeAdvanced(rowText: string, cells: string[]): { 
    rateType: BillingSheetRow['rateType'], 
    nbtType: BillingSheetRow['nbtType'],
    confidence: number 
  } {
    const lowerText = rowText.toLowerCase();
    let maxConfidence = 0;
    let bestMatch = { rateType: 'Other' as BillingSheetRow['rateType'], nbtType: 'Contractual' as BillingSheetRow['nbtType'] };

    // Enhanced keyword matching with confidence scoring
    const rateTypes = [
      { keywords: this.rateTypeKeywords.repairRate, type: 'Repair Rate', nbt: 'Abroad' },
      { keywords: this.rateTypeKeywords.reduceRate, type: 'Reduce Repair Rate', nbt: 'Abroad' },
      { keywords: this.rateTypeKeywords.zeroRate, type: 'Zero Rate', nbt: 'Abroad' },
      { keywords: this.rateTypeKeywords.operationRate, type: 'Operation Rate', nbt: 'Contractual' }
    ];

    for (const rateType of rateTypes) {
      let confidence = 0;
      let matches = 0;
      
      for (const keyword of rateType.keywords) {
        if (lowerText.includes(keyword)) {
          matches++;
          confidence += keyword.length / lowerText.length; // Longer matches = higher confidence
        }
      }

      if (matches > 0) {
        confidence = Math.min(confidence * matches, 1.0);
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          bestMatch = {
            rateType: rateType.type as BillingSheetRow['rateType'],
            nbtType: rateType.nbt as BillingSheetRow['nbtType']
          };
        }
      }
    }

    // Additional pattern analysis for column-based detection
    const hasRateColumn = cells.some(cell => {
      const lowerCell = cell.toLowerCase();
      return lowerCell.includes('rate') || lowerCell.includes('repair') || lowerCell.includes('zero');
    });

    if (hasRateColumn && maxConfidence < 0.3) {
      maxConfidence = 0.3; // Boost confidence if rate-related column found
    }

    return {
      rateType: bestMatch.rateType,
      nbtType: bestMatch.nbtType,
      confidence: maxConfidence
    };
  }

  private extractEquipment(description: string): { system?: string; equipment?: string } {
    const lowerDesc = description.toLowerCase();
    
    // Search through system equipment map for best match
    for (const [system, equipmentList] of Object.entries(this.systemEquipmentMap)) {
      for (const equipment of equipmentList) {
        if (lowerDesc.includes(equipment.toLowerCase())) {
          return {
            system,
            equipment: equipment.charAt(0).toUpperCase() + equipment.slice(1)
          };
        }
      }
    }

    return {};
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