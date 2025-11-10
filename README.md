# Aritas GL Matching Application

A professional desktop application for matching General Ledger transactions with bank statements.

## 🚀 Quick Start

### Install Dependencies
```bash
cd gl-matching-app
npm install
```

### Run in Development Mode
```bash
npm run dev
```

### Build Portable .exe
```bash
npm run build:exe
```

The portable executable will be created in the `dist/` folder.

## 📋 Features

- **Intelligent 6-Pass Matching Algorithm**
  - Exact date + amount matching
  - Near-date matching (±3 days, ±7 days)
  - Transaction splits detection (2-3 QB entries → 1 bank entry)
  - Fuzzy amount matching (±$1 for rounding)
  - Vendor name + type compatible matching

- **File Support**
  - Bank transactions: CSV format
  - QuickBooks GL: Excel (.xlsx, .xls)

- **Output Files**
  - `{YEAR}_Matched_Transactions.csv` - All matched pairs with match types
  - `{YEAR}_Unmatched_Bank.csv` - Bank transactions not found in QB
  - `{YEAR}_Unmatched_QB.csv` - QB transactions not found in bank
  - `{YEAR}_Reconciliation_Report.txt` - Comprehensive statistical analysis

- **Smart Features**
  - Automatic year detection from filenames
  - Vendor name normalization
  - Type compatibility checking (Deposit ↔ Debit, Withdrawal ↔ Credit)
  - Real-time progress logging
  - Professional Aritas Advisors branding

## 🎨 Customization

### Change Year Detection
The app automatically extracts the year from filenames (e.g., "2025" from "bank-transactions-2025.csv").

### Add Vendor Mappings
Edit `src/main/matcher.ts` in the `normalizeVendor()` method to add custom vendor name mappings.

### Adjust Matching Tolerance
- Fuzzy amount: Line 233 in `matcher.ts` (currently ±$1)
- Date windows: Lines 79, 83 (currently ±3, ±7 days)
- Split detection: Line 145 (currently ±5 days)

## 📦 Building for Distribution

```bash
# Build the .exe
npm run build:exe

# Output will be in:
dist/Aritas GL Matching-1.0.0-portable.exe
```

The portable .exe includes:
- ✅ All dependencies bundled
- ✅ No installation required
- ✅ Runs on any Windows machine
- ✅ Saves results to Downloads folder

## 🔧 Tech Stack

- **Electron 33.0.2** - Desktop framework
- **TypeScript 5.6.3** - Type-safe development
- **papaparse** - CSV parsing
- **xlsx** - Excel file reading
- **electron-builder** - Portable .exe packaging

## 📝 Input File Requirements

### Bank Transactions CSV
Required columns:
- `Date` (MM/DD/YYYY format)
- `Type` (Deposit or Withdrawal)
- `Vendor`
- `Description`
- `Amount` (numeric, can include commas)
- `Source_File` (optional)

### QuickBooks GL Excel
Required columns:
- `Date`
- `Trans #`
- `Type`
- `Account` (filters to "Operating Account - Chase 0275")
- `Name`
- `Memo`
- `Split`
- `Debit`
- `Credit`
- `Amount`

## 🐛 Troubleshooting

### "Cannot find module 'electron'"
Run `npm install` to install dependencies.

### Matching rate is low
- Verify date formats are consistent
- Check that amounts match (including decimals)
- Review vendor name mappings
- Check QB account filter

### Excel file not parsing
- Ensure file is .xlsx or .xls format
- Verify headers are in row 3 or earlier
- Check that required columns exist

## 📄 License

© 2025 Aritas Advisors. All rights reserved.

## 🆘 Support

For issues or questions, contact Aritas Advisors technical support.
