import * as XLSX from "xlsx";
import { db } from "../db.js";
import { rigs } from "@shared/schema";

export async function importRigsFromExcel(filePath: string) {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with default values for missing cells
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    
    // Map Excel columns to database fields
    const rigsData = jsonData.map((row: any) => {
      const rawRigNumber = String(row["Rig Number"] || row["Rig#"] || row["RigNumber"] || "").trim();
      let rigNumber: number;
      let rigName: string | undefined;
      
      // Handle special rig names like "Hoist 1", "Hoist 2", etc.
      if (rawRigNumber.toLowerCase().startsWith('hoist')) {
        const hoistNum = rawRigNumber.match(/\d+/)?.[0];
        rigNumber = hoistNum ? 9000 + parseInt(hoistNum) : 0; // Map Hoist 1->9001, Hoist 2->9002, etc.
        rigName = rawRigNumber; // Store original name
      } else {
        rigNumber = parseInt(rawRigNumber) || 0;
        rigName = undefined;
      }
      
      return {
        rigNumber,
        rigName,
        section: String(row["Section"] || row["Department"] || "").trim(),
        client: String(row["Client"] || row["Company"] || "").trim(), 
        location: String(row["Location"] || row["Area"] || "").trim(),
        isActive: validateStatus(row["Status"]),
      };
    }).filter(r => r.rigNumber > 0); // Only include rows with valid rig numbers
    
    if (rigsData.length === 0) {
      throw new Error("No valid rig data found in Excel file");
    }
    
    // Upsert rigs - update if exists, insert if new
    for (const rig of rigsData) {
      await db.insert(rigs)
        .values(rig)
        .onConflictDoUpdate({
          target: rigs.rigNumber,
          set: {
            rigName: rig.rigName,
            section: rig.section,
            client: rig.client,
            location: rig.location,
            isActive: rig.isActive,
            updatedAt: new Date(),
          },
        });
    }
    
    return {
      success: true,
      imported: rigsData.length,
      rigs: rigsData
    };
  } catch (error) {
    console.error("Error importing rigs from Excel:", error);
    throw new Error(`Failed to import rigs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function validateStatus(status: any): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  // Consider active if status is "active" or not specified
  return normalized === "active" || normalized === "" || !status;
}