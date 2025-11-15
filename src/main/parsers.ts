import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { BankTransaction, QBTransaction } from './matcher';

/**
 * Parse Bank CSV file
 */
export function parseBankCSV(filePath: string, year?: number): BankTransaction[] {
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false
  });

  const transactions: BankTransaction[] = [];

  for (const row of result.data as any[]) {
    try {
      const date = parseDate(row['Date']);
      
      // Filter by year if specified
      if (year && date.getFullYear() !== year) {
        continue;
      }

      // Exclude fees
      if (row['Type'] === 'Fee') {
        continue;
      }

      // Parse and round to 2 decimal places to match Python behavior
      const amount = Math.round(parseFloat(row['Amount']?.toString().replace(/,/g, '') || '0') * 100) / 100;

      transactions.push({
        date,
        type: row['Type'] as 'Deposit' | 'Withdrawal',
        vendor: row['Vendor'] || '',
        description: row['Description'] || '',
        amount,
        sourceFile: row['Source_File'] || '',
        matched: false
      });
    } catch (error) {
      console.error(`Error parsing bank row:`, row, error);
    }
  }

  console.log(`Loaded ${transactions.length} bank transactions`);
  return transactions;
}

/**
 * Parse QuickBooks Excel file
 */
export function parseQBExcel(filePath: string, year?: number): QBTransaction[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON, skip first 2 rows (headers)
  const data = XLSX.utils.sheet_to_json(sheet, { 
    header: 1,
    defval: ''
  }) as any[][];

  // Find header row (usually row 3, index 2)
  let headerRowIndex = 2;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    if (data[i].includes('Trans #') || data[i].includes('Date')) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = data[headerRowIndex];
  const rows = data.slice(headerRowIndex + 1);

  const transactions: QBTransaction[] = [];

  for (const row of rows) {
    try {
      // Skip empty rows or total rows
      if (!row || row.length === 0 || !row[0]) {
        continue;
      }

      const rowObj: any = {};
      headers.forEach((header: string, index: number) => {
        rowObj[header] = row[index];
      });

      // Skip if no transaction number
      if (!rowObj['Trans #']) {
        continue;
      }

      const date = parseDate(rowObj['Date']);
      
      // Filter by year if specified
      if (year && date.getFullYear() !== year) {
        continue;
      }

      // Filter to Operating Account only
      const account = rowObj['Account'] || '';
      if (account && !account.includes('Operating Account') && !account.includes('Chase 0275')) {
        continue;
      }

      // Parse and round to 2 decimal places to match Python behavior
      const debit = Math.round(parseFloat(rowObj['Debit']?.toString().replace(/,/g, '') || '0') * 100) / 100;
      const credit = Math.round(parseFloat(rowObj['Credit']?.toString().replace(/,/g, '') || '0') * 100) / 100;
      const amount = Math.round(parseFloat(rowObj['Amount']?.toString().replace(/,/g, '') || '0') * 100) / 100;

      // Use Split field as fallback for name if Name is empty
      const name = rowObj['Name']?.trim() || rowObj['Split']?.trim() || '';

      transactions.push({
        date,
        transNumber: rowObj['Trans #'] || '',
        type: rowObj['Type'] || '',
        account: rowObj['Account'] || '',
        name,
        memo: rowObj['Memo'] || '',
        split: rowObj['Split'] || '',
        debit,
        credit,
        amount,
        matched: false
      });
    } catch (error) {
      console.error(`Error parsing QB row:`, row, error);
    }
  }

  console.log(`Loaded ${transactions.length} QB transactions`);
  return transactions;
}

/**
 * Extract year from filename
 * Looks for 4-digit year pattern (e.g., "2025", "2024")
 */
export function extractYearFromFilename(filename: string): number | undefined {
  const match = filename.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: any): Date {
  if (!dateStr) {
    throw new Error('Invalid date');
  }

  // If already a date
  if (dateStr instanceof Date) {
    return dateStr;
  }

  // Handle Excel serial date numbers
  if (typeof dateStr === 'number') {
    return excelDateToJSDate(dateStr);
  }

  // String dates
  const str = dateStr.toString().trim();
  
  // Try MM/DD/YYYY
  const usFormat = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const usMatch = str.match(usFormat);
  if (usMatch) {
    const month = parseInt(usMatch[1]) - 1;
    const day = parseInt(usMatch[2]);
    const year = parseInt(usMatch[3]);
    return new Date(year, month, day);
  }

  // Try ISO format
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new Error(`Unable to parse date: ${dateStr}`);
}

/**
 * Convert Excel serial date to JavaScript Date (local timezone, midnight)
 */
function excelDateToJSDate(serial: number): Date {
  // Excel epoch is Jan 1, 1900 (but Excel incorrectly treats 1900 as leap year)
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  const dateUTC = new Date(utcValue);
  
  // Return as local midnight, not UTC
  return new Date(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate());
}
