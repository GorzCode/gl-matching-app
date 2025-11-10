# 🏗️ Build Guide - Aritas GL Matching Application

## 📋 Prerequisites

- **Node.js** (v18 or higher) - Download from https://nodejs.org/
- **Windows** (for building .exe)
- **Terminal** (PowerShell, Command Prompt, or Git Bash)

## 🚀 Step-by-Step Build Process

### Step 1: Install Dependencies

Open PowerShell/Terminal in the `gl-matching-app` folder:

```bash
npm install
```

This installs:
- Electron 33.0.2
- TypeScript 5.6.3
- papaparse (CSV parsing)
- xlsx (Excel reading)
- electron-builder (packaging)

**Expected time:** 2-3 minutes

### Step 2: Build TypeScript

Compile TypeScript to JavaScript:

```bash
npm run build
```

This:
- Compiles all `.ts` files in `src/` to JavaScript in `build/`
- Copies renderer files (HTML, CSS, JS)

**Expected output:**
```
✓ TypeScript compilation complete
✓ Renderer files copied
```

### Step 3: Test in Development Mode

Run the app to test functionality:

```bash
npm run dev
```

This launches the Electron app in development mode with DevTools open.

**Test checklist:**
- [ ] App window opens with Aritas branding
- [ ] Can select bank CSV file
- [ ] Can select QuickBooks Excel file
- [ ] "Match Transactions" button enables when both files selected
- [ ] Processing runs and shows logs
- [ ] Results folder opens with output CSVs

Press `Ctrl+C` to stop.

### Step 4: Build Portable .exe

Create the standalone executable:

```bash
npm run build:exe
```

This:
- Builds TypeScript
- Packages with electron-builder
- Creates portable .exe (no installer needed)

**Expected output:**
```
• electron-builder  version=25.1.8
• loaded configuration  file=package.json
• building target=portable
• writing file="dist/Aritas GL Matching-1.0.0-portable.exe"
```

**Output location:**
```
dist/
└── Aritas GL Matching-1.0.0-portable.exe  (~150-200 MB)
```

### Step 5: Add Your Icon (Optional)

1. Create a 256x256 PNG of Aritas Advisors logo
2. Convert to `.ico` format using:
   - https://convertio.co/png-ico/
   - https://www.icoconverter.com/
3. Save as `assets/icon.ico`
4. Rebuild: `npm run build:exe`

## 🎯 Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `npm install` | Install all dependencies |
| `npm run build` | Compile TypeScript only |
| `npm run dev` | Run in development mode |
| `npm run build:exe` | Create portable .exe |

## 📦 Distribution

### Portable .exe
- **File:** `dist/Aritas GL Matching-1.0.0-portable.exe`
- **Size:** ~150-200 MB
- **Requirements:** Windows 10/11 (64-bit)
- **Installation:** None required - just run the .exe
- **Data Storage:** Results saved to user's Downloads folder

### Testing the .exe

1. Copy the .exe to a different computer (optional)
2. Double-click to run
3. Test full workflow:
   - Select files
   - Run matching
   - Open results folder
   - Verify CSV outputs

## 🔧 Troubleshooting

### "npm: command not found"
**Solution:** Install Node.js from https://nodejs.org/

### Build fails with TypeScript errors
**Solution:** 
```bash
npm install typescript@5.6.3 --save-dev
npm run build
```

### .exe doesn't run
**Possible causes:**
- Windows SmartScreen blocks it (click "More info" → "Run anyway")
- Antivirus false positive (add exception)
- 32-bit Windows (app is 64-bit only)

### Matching not working correctly
**Debug steps:**
1. Run in dev mode: `npm run dev`
2. Open DevTools (F12)
3. Check Console tab for errors
4. Review log output in app

### Excel file not parsing
**Check:**
- File is .xlsx or .xls format
- Headers in row 3 or earlier
- Required columns exist (Date, Trans #, Name, etc.)

## 📝 Customization

### Change Year Extraction
**File:** `src/main/parsers.ts`
**Function:** `extractYearFromFilename()`

```typescript
// Current: Looks for 4-digit year like "2025"
const match = filename.match(/\b(20\d{2})\b/);
```

### Add Vendor Mappings
**File:** `src/main/matcher.ts`
**Function:** `normalizeVendor()`

```typescript
const mappings: { [key: string]: string[] } = {
  'YOUR VENDOR': ['VARIANT 1', 'VARIANT 2'],
  // Add more...
};
```

### Adjust Matching Tolerance
**File:** `src/main/matcher.ts`

- **Fuzzy amount:** Line 233 - Change `1.0` to desired tolerance
- **Date windows:** Lines 79, 83 - Change `3` and `7` to desired days
- **Split detection:** Line 145 - Change `5` to desired window

### Change Output Directory
**File:** `src/main/index.ts`
**Line:** ~135

```typescript
// Current: Downloads folder
const downloadsPath = app.getPath('downloads');

// Change to Desktop:
const downloadsPath = app.getPath('desktop');

// Or custom path:
const outputDir = 'C:\\CustomPath\\Results';
```

### Update Branding
**Files:**
- `src/renderer/styles.css` - Colors (lines 3-9)
- `src/renderer/index.html` - Text and titles
- `assets/icon.ico` - Application icon

## 🎨 Color Scheme

```css
--primary-color: #1e3a5f;      /* Deep Navy Blue */
--secondary-color: #2c5f8d;    /* Medium Blue */
--accent-color: #c9a961;       /* Gold */
--success-color: #27ae60;      /* Green */
--warning-color: #f39c12;      /* Orange */
--error-color: #e74c3c;        /* Red */
```

## 📊 File Structure

```
gl-matching-app/
├── src/
│   ├── main/
│   │   ├── index.ts           → Main process (Electron backend)
│   │   ├── matcher.ts         → Matching algorithm (6 passes)
│   │   ├── parsers.ts         → CSV/Excel file readers
│   │   └── exporter.ts        → CSV/TXT file writers
│   ├── renderer/
│   │   ├── index.html         → UI layout
│   │   ├── styles.css         → Styling + branding
│   │   └── app.js             → Frontend logic
│   └── preload/
│       └── preload.ts         → IPC security bridge
├── build/                     → Compiled output (git ignored)
├── dist/                      → Final .exe (git ignored)
├── assets/
│   └── icon.ico              → Application icon
├── package.json              → Dependencies & scripts
├── tsconfig.json             → TypeScript config
└── README.md                 → Documentation
```

## 🚀 Production Checklist

Before distributing to users:

- [ ] Test on fresh Windows machine
- [ ] Verify .exe launches without Node.js installed
- [ ] Test with real bank and QB files
- [ ] Confirm output CSVs are correct
- [ ] Check match rate is acceptable (>95%)
- [ ] Verify results folder opens
- [ ] Test with different year files
- [ ] Review error handling (invalid files, etc.)
- [ ] Add your custom icon
- [ ] Update version number in `package.json`
- [ ] Create user documentation

## 📞 Support

For build issues or questions:
- Check the main `README.md` for feature documentation
- Review TypeScript errors in build output
- Run in dev mode for debugging
- Contact Aritas Advisors technical team

---

**Built with:** Electron, TypeScript, and the Aritas Advisors playbook architecture 🚀
