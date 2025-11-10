import * as Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';
import { MatchedPair, BankTransaction, QBTransaction, ReconciliationResult } from './matcher';

/**
 * Export matched transactions to CSV
 */
export function exportMatchedCSV(matched: MatchedPair[], outputDir: string, year: string): string {
  const filename = `${year}_Matched_Transactions.csv`;
  const filePath = path.join(outputDir, filename);

  const data = matched.map(m => ({
    'Match_Type': m.matchType,
    'Bank_Date': formatDate(m.bankDate),
    'QB_Date': formatDate(m.qbDate),
    'Amount': m.amount.toFixed(2),
    'Bank_Type': m.bankType,
    'Bank_Vendor': m.bankVendor,
    'QB_Name': m.qbName,
    'QB_Trans_#': m.qbTransNumber,
    'QB_Type': m.qbType,
    'QB_Memo': m.qbMemo,
    'QB_Split': m.qbSplit,
    'Bank_Description': m.bankDescription
  }));

  const csv = Papa.unparse(data);
  fs.writeFileSync(filePath, csv, 'utf-8');

  return filePath;
}

/**
 * Export unmatched bank transactions to CSV
 */
export function exportUnmatchedBankCSV(unmatched: BankTransaction[], outputDir: string, year: string): string {
  const filename = `${year}_Unmatched_Bank.csv`;
  const filePath = path.join(outputDir, filename);

  const data = unmatched.map(t => ({
    'Date': formatDate(t.date),
    'Type': t.type,
    'Vendor': t.vendor,
    'Description': t.description,
    'Amount': t.amount.toFixed(2),
    'Source_File': t.sourceFile
  }));

  const csv = Papa.unparse(data);
  fs.writeFileSync(filePath, csv, 'utf-8');

  return filePath;
}

/**
 * Export unmatched QB transactions to CSV
 */
export function exportUnmatchedQBCSV(unmatched: QBTransaction[], outputDir: string, year: string): string {
  const filename = `${year}_Unmatched_QB.csv`;
  const filePath = path.join(outputDir, filename);

  const data = unmatched.map(t => ({
    'Date': formatDate(t.date),
    'Trans #': t.transNumber,
    'Type': t.type,
    'Name': t.name,
    'Memo': t.memo,
    'Split': t.split,
    'Debit': t.debit.toFixed(2),
    'Credit': t.credit.toFixed(2),
    'Amount': t.amount.toFixed(2)
  }));

  const csv = Papa.unparse(data);
  fs.writeFileSync(filePath, csv, 'utf-8');

  return filePath;
}

/**
 * Generate comprehensive reconciliation report
 */
export function generateReport(
  result: ReconciliationResult,
  bankTransactions: BankTransaction[],
  qbTransactions: QBTransaction[],
  outputDir: string,
  year: string
): string {
  const filename = `${year}_Reconciliation_Report.txt`;
  const filePath = path.join(outputDir, filename);

  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push(`BANK RECONCILIATION REPORT - ${year}`);
  lines.push('='.repeat(80));
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');

  // Bank Summary
  lines.push('BANK SUMMARY:');
  lines.push(`  Total Transactions: ${result.totalBank}`);
  const deposits = bankTransactions.filter(t => t.type === 'Deposit');
  const withdrawals = bankTransactions.filter(t => t.type === 'Withdrawal');
  const depositSum = deposits.reduce((sum, t) => sum + t.amount, 0);
  const withdrawalSum = withdrawals.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  lines.push(`  Deposits: ${deposits.length} - $${depositSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  lines.push(`  Withdrawals: ${withdrawals.length} - $${withdrawalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  lines.push('');

  // QuickBooks Summary
  lines.push('QUICKBOOKS SUMMARY:');
  lines.push(`  Total Transactions: ${result.totalQB}`);
  const debits = qbTransactions.filter(t => t.debit > 0);
  const credits = qbTransactions.filter(t => t.credit > 0);
  const debitSum = debits.reduce((sum, t) => sum + t.debit, 0);
  const creditSum = credits.reduce((sum, t) => sum + t.credit, 0);
  lines.push(`  Debits: ${debits.length} - $${debitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  lines.push(`  Credits: ${credits.length} - $${creditSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  lines.push('');

  // Matching Results
  lines.push('MATCHING RESULTS:');
  lines.push(`  Total Matched: ${result.matched.length}`);
  lines.push(`  Match Rate: ${result.matchRate.toFixed(1)}%`);
  lines.push(`  Unmatched Bank: ${result.unmatchedBank.length}`);
  lines.push(`  Unmatched QB: ${result.unmatchedQB.length}`);
  lines.push('');

  // Match Breakdown
  if (result.matched.length > 0) {
    lines.push('MATCH BREAKDOWN:');
    const matchTypes: { [key: string]: number } = {};
    result.matched.forEach(m => {
      matchTypes[m.matchType] = (matchTypes[m.matchType] || 0) + 1;
    });
    Object.entries(matchTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      lines.push(`  ${type}: ${count}`);
    });
    lines.push('');
  }

  // Unmatched Details
  if (result.unmatchedBank.length > 0) {
    lines.push('UNMATCHED BANK:');
    const unmatchedDeposits = result.unmatchedBank.filter(t => t.type === 'Deposit');
    const unmatchedWithdrawals = result.unmatchedBank.filter(t => t.type === 'Withdrawal');
    const depositTotal = unmatchedDeposits.reduce((sum, t) => sum + t.amount, 0);
    const withdrawalTotal = unmatchedWithdrawals.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    lines.push(`  Deposits: ${unmatchedDeposits.length} - $${depositTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    lines.push(`  Withdrawals: ${unmatchedWithdrawals.length} - $${withdrawalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    lines.push('');
  }

  if (result.unmatchedQB.length > 0) {
    lines.push('UNMATCHED QB:');
    const unmatchedDebits = result.unmatchedQB.filter(t => t.debit > 0);
    const unmatchedCredits = result.unmatchedQB.filter(t => t.credit > 0);
    const debitTotal = unmatchedDebits.reduce((sum, t) => sum + t.debit, 0);
    const creditTotal = unmatchedCredits.reduce((sum, t) => sum + t.credit, 0);
    lines.push(`  Debits: ${unmatchedDebits.length} - $${debitTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    lines.push(`  Credits: ${unmatchedCredits.length} - $${creditTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    lines.push('');
  }

  // Statistical Summary
  lines.push('='.repeat(80));
  lines.push('STATISTICAL SUMMARY');
  lines.push('='.repeat(80));
  lines.push('');

  // Match rate by type
  lines.push('MATCH RATE BY TRANSACTION TYPE:');
  const matchedDeposits = result.matched.filter(m => m.bankType === 'Deposit').length;
  const matchedWithdrawals = result.matched.filter(m => m.bankType === 'Withdrawal').length;
  lines.push(`  Deposits: ${matchedDeposits}/${deposits.length} (${(matchedDeposits / deposits.length * 100).toFixed(1)}%)`);
  lines.push(`  Withdrawals: ${matchedWithdrawals}/${withdrawals.length} (${(matchedWithdrawals / withdrawals.length * 100).toFixed(1)}%)`);
  lines.push('');

  // Match rate by amount range
  lines.push('MATCH RATE BY AMOUNT RANGE:');
  const ranges = [
    { min: 0, max: 1000, label: 'Under $1,000' },
    { min: 1000, max: 5000, label: '$1,000 - $5,000' },
    { min: 5000, max: 10000, label: '$5,000 - $10,000' },
    { min: 10000, max: 50000, label: '$10,000 - $50,000' },
    { min: 50000, max: Infinity, label: 'Over $50,000' }
  ];

  ranges.forEach(range => {
    const inRange = bankTransactions.filter(t => 
      Math.abs(t.amount) >= range.min && Math.abs(t.amount) < range.max
    );
    const matchedInRange = result.matched.filter(m =>
      m.amount >= range.min && m.amount < range.max
    );
    if (inRange.length > 0) {
      const pct = (matchedInRange.length / inRange.length * 100).toFixed(1);
      lines.push(`  ${range.label}: ${matchedInRange.length}/${inRange.length} (${pct}%)`);
    }
  });
  lines.push('');

  // Top unmatched vendors
  if (result.unmatchedBank.length > 0) {
    lines.push('TOP 10 UNMATCHED BANK VENDORS:');
    const vendorTotals: { [vendor: string]: { count: number; total: number } } = {};
    result.unmatchedBank.forEach(t => {
      if (!vendorTotals[t.vendor]) {
        vendorTotals[t.vendor] = { count: 0, total: 0 };
      }
      vendorTotals[t.vendor].count++;
      vendorTotals[t.vendor].total += Math.abs(t.amount);
    });
    
    Object.entries(vendorTotals)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .forEach(([vendor, data]) => {
        lines.push(`  ${vendor}: ${data.count} transactions, $${data.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      });
    lines.push('');
  }

  if (result.unmatchedQB.length > 0) {
    lines.push('TOP 10 UNMATCHED QB VENDORS:');
    const vendorTotals: { [vendor: string]: { count: number; total: number } } = {};
    result.unmatchedQB.forEach(t => {
      if (!vendorTotals[t.name]) {
        vendorTotals[t.name] = { count: 0, total: 0 };
      }
      vendorTotals[t.name].count++;
      vendorTotals[t.name].total += Math.abs(t.debit + t.credit);
    });
    
    Object.entries(vendorTotals)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .forEach(([vendor, data]) => {
        lines.push(`  ${vendor}: ${data.count} transactions, $${data.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      });
    lines.push('');
  }

  lines.push('='.repeat(80));

  const report = lines.join('\n');
  fs.writeFileSync(filePath, report, 'utf-8');

  return filePath;
}

/**
 * Helper: Format date as MM/DD/YYYY
 */
function formatDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}
