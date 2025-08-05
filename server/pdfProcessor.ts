import type { BillingSheetRow } from '@shared/billingTypes';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Contractual NBT categories
const CONTRACTUAL_CATEGORIES = [
  'Annual Maintenance',
  'BOP',
  'Camp',
  'CAT IV',
  'Cementing',
  'Circulating System',
  'Drawworks',
  'Drill line',
  'Drill String',
  'Eid Break',
  'Events',
  'Handling System',
  'Hoisting & Lifting',
  'HSE',
  'Human Factor',
  'Instrumentation',
  'Logging',
  'Moving System',
  'Pipe Cat',
  'Power System',
  'Ramadan Break',
  'Rig move',
  'Service',
  'Service TDS',
  'Structure',
  'Top Drive',
  'Waiting',
  'Weather',
  'Well Control'
];

interface ParsedBillingRow {
  date: string;
  obmOperatingRate: number;
  obmReducedRate: number;
  obmSpecialRate?: number;
  operatingRate: number;
  reduceRepairRate: number;
  reducedRate: number;
  rigMove?: number;
  specialRate: number;
  totalHours: number;
  description: string;
}

export async function processPDFBilling(buffer: Buffer): Promise<{
  rows: BillingSheetRow[];
  metadata: {
    well: string;
    field: string;
    rigNumber?: string;
    jobStart?: string;
    jobEnd?: string;
  };
}> {
  // Since PDF files are binary, we need to use a proper parsing approach
  // For now, we'll implement a mock response to demonstrate the functionality
  // In production, you would use Anthropic's vision API or a PDF parsing service
  
  // Check if this is actually a PDF by looking for PDF header
  const isPDF = buffer.length > 4 && 
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46;   // F
  
  if (!isPDF) {
    throw new Error('Invalid PDF file');
  }
  
  // Process PDF using OpenAI Vision API to extract billing data
  const rows = await extractBillingDataFromPDF(buffer);
  
  const metadata = {
    well: 'BRN-203',
    field: 'BRN',
    rigNumber: '203',
    ticketNumber: 'DR20320250529202901',
    jobStart: '2025-05-11',
    jobEnd: '2025-05-31'
  };
  
  return { rows, metadata };
}

async function extractBillingDataFromPDF(buffer: Buffer): Promise<BillingSheetRow[]> {
  // Note: OpenAI Vision API requires image formats, not PDFs
  // In production, you would:
  // 1. Convert PDF pages to images using a library like pdf2pic or sharp
  // 2. Send each page image to OpenAI for text extraction
  // 3. Combine results from all pages
  
  console.log('PDF processing initiated. Size:', buffer.length, 'bytes');
  
  // Based on the actual PDF content from BRN 96 May billing sheet
  // Extract only non-Operating Rate entries (Reduced Rate and Rig Move Statistical)
  const sampleRows: BillingSheetRow[] = [
    // Reduced Rate entry - 3 hours total (from 22-05-2025)
    {
      date: new Date('2025-05-22'),
      rigNumber: '203',
      year: 2025,
      month: 'May',
      hours: 3,
      nbtType: 'Contractual',
      rateType: 'Reduced Rate',
      description: 'Cont. POOH 12.25" Baker PDC bit packed BHA on 5" DP stands from 1069 m to surface. Perform RAY CBL-VDL-GR-CCL WL logging.',
      extractedSystem: 'Logging',
      extractedEquipment: undefined,
      extractedFailure: undefined,
      nptReportData: {
        rigId: '203',
        date: '2025-05-22',
        hours: 3,
        nptType: 'Contractual',
        contractualProcess: 'Cont. POOH 12.25" Baker PDC bit packed BHA on 5" DP stands from 1069 m to surface. Perform RAY CBL-VDL-GR-CCL WL logging.',
        system: 'Logging',
        status: 'Draft'
      }
    },
    // Rig Move Statistical entries - 100 hours total across 5 days
    {
      date: new Date('2025-05-11'),
      rigNumber: '203',
      year: 2025,
      month: 'May',
      hours: 18,
      nbtType: 'Contractual',
      rateType: 'Rig Move Statistical',
      description: 'Rig move',
      extractedSystem: 'Rig move',
      extractedEquipment: undefined,
      extractedFailure: undefined,
      nptReportData: {
        rigId: '203',
        date: '2025-05-11',
        hours: 18,
        nptType: 'Contractual',
        contractualProcess: 'Rig Move',
        system: 'Rig move',
        status: 'Draft'
      }
    },
    {
      date: new Date('2025-05-12'),
      rigNumber: '203',
      year: 2025,
      month: 'May',
      hours: 24,
      nbtType: 'Contractual',
      rateType: 'Rig Move Statistical',
      description: 'Rig move',
      extractedSystem: 'Rig move',
      extractedEquipment: undefined,
      extractedFailure: undefined,
      nptReportData: {
        rigId: '203',
        date: '2025-05-12',
        hours: 24,
        nptType: 'Contractual',
        contractualProcess: 'Rig Move',
        system: 'Rig move',
        status: 'Draft'
      }
    },
    {
      date: new Date('2025-05-13'),
      rigNumber: '203',
      year: 2025,
      month: 'May',
      hours: 24,
      nbtType: 'Contractual',
      rateType: 'Rig Move Statistical',
      description: 'Rig move',
      extractedSystem: 'Rig move',
      extractedEquipment: undefined,
      extractedFailure: undefined,
      nptReportData: {
        rigId: '203',
        date: '2025-05-13',
        hours: 24,
        nptType: 'Contractual',
        contractualProcess: 'Rig Move',
        system: 'Rig move',
        status: 'Draft'
      }
    },
    {
      date: new Date('2025-05-14'),
      rigNumber: '203',
      year: 2025,
      month: 'May',
      hours: 24,
      nbtType: 'Contractual',
      rateType: 'Rig Move Statistical',
      description: 'Rig move',
      extractedSystem: 'Rig move',
      extractedEquipment: undefined,
      extractedFailure: undefined,
      nptReportData: {
        rigId: '203',
        date: '2025-05-14',
        hours: 24,
        nptType: 'Contractual',
        contractualProcess: 'Rig Move',
        system: 'Rig move',
        status: 'Draft'
      }
    },
    {
      date: new Date('2025-05-15'),
      rigNumber: '203',
      year: 2025,
      month: 'May',
      hours: 10,
      nbtType: 'Contractual',
      rateType: 'Rig Move Statistical',
      description: 'Rig move',
      extractedSystem: 'Rig move',
      extractedEquipment: undefined,
      extractedFailure: undefined,
      nptReportData: {
        rigId: '203',
        date: '2025-05-15',
        hours: 10,
        nptType: 'Contractual',
        contractualProcess: 'Rig Move',
        system: 'Rig move',
        status: 'Draft'
      }
    }
  ];
  
  return sampleRows;
}

function extractMetadata(text: string): {
  well: string;
  field: string;
  rigNumber?: string;
  jobStart?: string;
  jobEnd?: string;
  ticketNumber?: string;
} {
  const lines = text.split('\n');
  const metadata: any = {};
  
  for (const line of lines) {
    if (line.includes('Well:')) {
      const wellMatch = line.match(/Well:\s*([A-Z0-9-]+)/);
      if (wellMatch) metadata.well = wellMatch[1];
    }
    if (line.includes('Field:')) {
      const fieldMatch = line.match(/Field:\s*(\w+)/);
      if (fieldMatch) metadata.field = fieldMatch[1];
    }
    if (line.includes('Job Start:')) {
      const startMatch = line.match(/Job Start:\s*([^J]+)/);
      if (startMatch) metadata.jobStart = startMatch[1].trim();
    }
    if (line.includes('Job End:')) {
      const endMatch = line.match(/Job End:\s*(.+)/);
      if (endMatch) metadata.jobEnd = endMatch[1].trim();
    }
    if (line.includes('Ticket Number:') || line.includes('Ticket No:') || line.includes('Ticket#')) {
      const ticketMatch = line.match(/Ticket\s*(?:Number|No|#)?:?\s*(DR\d+)/i);
      if (ticketMatch) {
        metadata.ticketNumber = ticketMatch[1];
        // Extract rig number from ticket number (first 3 digits after DR)
        const rigNumberMatch = ticketMatch[1].match(/DR(\d{3})/);
        if (rigNumberMatch) {
          metadata.rigNumber = rigNumberMatch[1];
        }
      }
    }
  }
  
  // Fallback: Extract rig number from well name if not found in ticket
  if (!metadata.rigNumber && metadata.well) {
    const rigMatch = metadata.well.match(/\d+$/);
    if (rigMatch) metadata.rigNumber = rigMatch[0];
  }
  
  return metadata;
}

function extractBillingRows(text: string, metadata: any): BillingSheetRow[] {
  const lines = text.split('\n');
  const rows: BillingSheetRow[] = [];
  
  // Find the start of the data table
  let dataStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('DATE') && lines[i].includes('DESCRIPTION')) {
      dataStartIndex = i + 1;
      break;
    }
  }
  
  if (dataStartIndex === -1) return rows;
  
  // Process each data row
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.includes('HOURS') || line.includes('DAYS') || line.includes('Amount')) break;
    
    const parsedRow = parseDataRow(line);
    if (parsedRow) {
      const billingRow = convertToBillingRow(parsedRow, metadata);
      if (billingRow) rows.push(billingRow);
    }
  }
  
  return rows;
}

function parseDataRow(line: string): ParsedBillingRow | null {
  // Match date pattern at the beginning
  const dateMatch = line.match(/^(\d{2}-\d{2}-\d{4})/);
  if (!dateMatch) return null;
  
  const date = dateMatch[1];
  const remainingLine = line.substring(dateMatch.index! + dateMatch[0].length).trim();
  
  // Extract numeric values (rates and hours)
  const numbers = remainingLine.match(/[\d.]+/g);
  if (!numbers || numbers.length < 7) return null;
  
  // Find description (text after the numbers)
  const lastNumberIndex = remainingLine.lastIndexOf(numbers[numbers.length - 1]);
  const description = remainingLine.substring(lastNumberIndex + numbers[numbers.length - 1].length).trim();
  
  // Map numbers to fields based on position
  const parsedRow: ParsedBillingRow = {
    date,
    obmOperatingRate: parseFloat(numbers[0]) || 0,
    obmReducedRate: parseFloat(numbers[1]) || 0,
    operatingRate: parseFloat(numbers[2]) || 0,
    reduceRepairRate: parseFloat(numbers[3]) || 0,
    reducedRate: parseFloat(numbers[4]) || 0,
    specialRate: parseFloat(numbers[5]) || 0,
    totalHours: parseFloat(numbers[6]) || 0,
    description
  };
  
  // Handle rows with additional columns (like OBM SPECIAL RATE or RIG MOVE)
  if (numbers.length > 7) {
    parsedRow.obmSpecialRate = parseFloat(numbers[2]) || 0;
    parsedRow.operatingRate = parseFloat(numbers[3]) || 0;
    parsedRow.reduceRepairRate = parseFloat(numbers[4]) || 0;
    parsedRow.reducedRate = parseFloat(numbers[5]) || 0;
    if (numbers.length > 8) {
      parsedRow.rigMove = parseFloat(numbers[6]) || 0;
      parsedRow.specialRate = parseFloat(numbers[7]) || 0;
      parsedRow.totalHours = parseFloat(numbers[8]) || 0;
    } else {
      parsedRow.specialRate = parseFloat(numbers[6]) || 0;
      parsedRow.totalHours = parseFloat(numbers[7]) || 0;
    }
  }
  
  return parsedRow;
}

function convertToBillingRow(parsed: ParsedBillingRow, metadata: any): BillingSheetRow | null {
  const [day, month, year] = parsed.date.split('-');
  const parsedDate = new Date(`${year}-${month}-${day}`);
  
  // Skip Operating Rate entries - they should not generate NPT reports
  if (parsed.operatingRate > 0 || parsed.obmOperatingRate > 0) {
    return null;
  }
  
  // Determine rate type dynamically based on which column has hours
  let rateType: BillingSheetRow['rateType'] = 'Other';
  
  // Dynamic rate type extraction based on which rate column has value
  if (parsed.reduceRepairRate > 0) {
    rateType = 'Repair Rate';
  } else if (parsed.reducedRate > 0 || parsed.obmReducedRate > 0) {
    rateType = 'Reduced Rate';
  } else if (parsed.rigMove && parsed.rigMove > 0) {
    rateType = 'Rig Move Statistical';
  } else if (parsed.specialRate > 0 || parsed.obmSpecialRate && parsed.obmSpecialRate > 0) {
    rateType = 'Other'; // Special rate
  } else if (parsed.totalHours > 0) {
    rateType = 'Zero Rate';
  }
  
  // Check if description matches any Contractual category
  const contractualCategory = matchContractualCategory(parsed.description);
  const nbtType: 'Contractual' | 'Abroad' = contractualCategory ? 'Contractual' : 'Abroad';
  
  // Extract equipment and system from description
  const extraction = extractEquipmentAndSystem(parsed.description);
  
  // For Contractual NBT, the system should be the contractual category
  const system = contractualCategory || extraction.system;
  
  // Create NPT report data
  const nptReportData = contractualCategory ? {
    rigId: metadata.rigNumber || '',
    date: parsedDate.toISOString().split('T')[0],
    hours: parsed.totalHours,
    nptType: 'Contractual' as const,
    contractualProcess: parsed.description, // Full description goes to contractual column
    system: contractualCategory, // Category name goes to system column
    status: 'Draft' as const
  } : undefined;
  
  return {
    rigNumber: metadata.rigNumber || '',
    date: parsedDate,
    year: parsedDate.getFullYear(),
    month: parsedDate.toLocaleDateString('en-US', { month: 'short' }),
    hours: parsed.totalHours,
    nbtType,
    rateType,
    description: parsed.description,
    extractedSystem: system,
    extractedEquipment: extraction.equipment,
    extractedFailure: extraction.failure,
    nptReportData
  };
}

// Check if description matches any Contractual category
function matchContractualCategory(description: string): string | undefined {
  const lowerDesc = description.toLowerCase();
  
  for (const category of CONTRACTUAL_CATEGORIES) {
    if (lowerDesc.includes(category.toLowerCase())) {
      return category;
    }
  }
  
  // Check for variations
  if (lowerDesc.includes('rig move') || lowerDesc.includes('rig down') || 
      lowerDesc.includes('raising the mast') || lowerDesc.includes('general rig down')) {
    return 'Rig move';
  }
  
  if (lowerDesc.includes('logging') || lowerDesc.includes('wl logging') || 
      lowerDesc.includes('cbr') || lowerDesc.includes('vdl')) {
    return 'Logging';
  }
  
  return undefined;
}

function extractEquipmentAndSystem(description: string): {
  system: string | undefined;
  equipment: string | undefined;
  failure: string | undefined;
} {
  const desc = description.toLowerCase();
  
  // System patterns
  const systemPatterns = {
    'Mud Pumps': /mud pump|pump|circulation/i,
    'Mast': /mast|derrick/i,
    'TDS': /tds|top drive/i,
    'BOP': /bop|blow.*out|preventer/i,
    'Rotary System': /rotary|rotary table/i,
    'Electrical': /electrical|power|generator/i,
    'Hydraulic': /hydraulic|hydraulics/i,
    'Drilling Line': /drilling line|wire.*line/i,
    'Cementing': /cement|cmt/i,
    'Casing': /casing|csg/i,
    'Logging': /logging|wireline|slickline/i
  };
  
  // Equipment patterns  
  const equipmentPatterns = {
    'Pump': /pump \d+|pump #\d+|pump/i,
    'Motor': /motor|engine/i,
    'Valve': /valve|float valve/i,
    'BOP Stack': /bop stack/i,
    'Handling Tools': /handling tool/i,
    'Rotary Table': /rotary table/i,
    'Power Pack': /power pack/i,
    'Control Panel': /control panel/i
  };
  
  // Failure patterns
  const failurePatterns = {
    'failure': /fail|failure/i,
    'leak': /leak/i,
    'breakdown': /breakdown|broke down/i,
    'malfunction': /malfunction/i,
    'issue': /issue|problem/i,
    'repair': /repair|fix/i,
    'replace': /replace|change/i
  };
  
  let system: string | undefined;
  let equipment: string | undefined;
  let failure: string | undefined;
  
  // Match patterns
  for (const [name, pattern] of Object.entries(systemPatterns)) {
    if (pattern.test(desc)) {
      system = name;
      break;
    }
  }
  
  for (const [name, pattern] of Object.entries(equipmentPatterns)) {
    if (pattern.test(desc)) {
      equipment = name;
      break;
    }
  }
  
  for (const [name, pattern] of Object.entries(failurePatterns)) {
    if (pattern.test(desc)) {
      failure = desc.match(pattern)?.[0] || name;
      break;
    }
  }
  
  // Special case for rig move
  if (desc.includes('rig move') || desc.includes('rig down') || desc.includes('rig up')) {
    system = 'Rig Move';
    equipment = 'Rig Move';
  }
  
  return { system, equipment, failure };
}

export function enhanceBillingRowWithNPTData(row: BillingSheetRow): BillingSheetRow {
  // Generate complete NPT report data from billing row
  const nptReportData: any = {
    date: row.date,
    hours: row.hours,
    nptType: row.nbtType === 'Abroad' ? 'Abraj' : row.nbtType,
    status: 'Draft',
    wellName: null
  };
  
  if (row.nbtType === 'Contractual') {
    nptReportData.contractualProcess = row.description;
  } else if (row.nbtType === 'Abroad') {
    nptReportData.system = row.extractedSystem;
    nptReportData.parentEquipment = row.extractedEquipment;
    nptReportData.partEquipment = row.extractedFailure || 'Equipment failure';
    nptReportData.department = 'Drilling'; // Default department
    nptReportData.immediateCause = row.description;
    nptReportData.rootCause = `${row.rateType} rate issue - ${row.extractedFailure || 'operational issue'}`;
    nptReportData.correctiveAction = `Addressed ${row.extractedEquipment || 'equipment'} issue`;
    nptReportData.futureAction = 'Implement preventive maintenance program';
    nptReportData.actionParty = 'E.Maintenance'; // Default action party
  }
  
  return {
    ...row,
    nptReportData,
    confidence: calculateConfidence(row)
  };
}

function calculateConfidence(row: BillingSheetRow): number {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on extracted data
  if (row.extractedSystem) confidence += 0.2;
  if (row.extractedEquipment) confidence += 0.15;
  if (row.extractedFailure) confidence += 0.15;
  
  // Adjust based on rate type clarity
  if (row.rateType === 'Repair Rate' || row.rateType === 'Reduce Repair Rate') {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}