import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { parseBankCSV, parseQBExcel, extractYearFromFilename } from './parsers';
import { GLMatcher, BankTransaction, QBTransaction } from './matcher';
import { 
  exportMatchedCSV, 
  exportUnmatchedBankCSV, 
  exportUnmatchedQBCSV, 
  generateReport 
} from './exporter';
import { analyzeVendorsWithGemini } from './gemini-analyzer';

let mainWindow: BrowserWindow | null = null;
let lastResults: {
  bankTransactions: BankTransaction[];
  qbTransactions: QBTransaction[];
  outputDir: string;
  year: string;
} | null = null;

/**
 * Create main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Aritas GL Matching',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * App initialization
 */
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * IPC: Select Bank CSV file
 */
ipcMain.handle('select-bank-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    title: 'Select Bank Transactions CSV',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

/**
 * IPC: Select QuickBooks Excel file
 */
ipcMain.handle('select-qb-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    title: 'Select QuickBooks GL Excel',
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

/**
 * IPC: Process reconciliation
 */
ipcMain.handle('process-reconciliation', async (_event, bankPath: string, qbPath: string, aiMappings?: { [key: string]: string[] }) => {
  try {
    log('Starting reconciliation process...', 'info');

    // Extract year from filenames
    const bankYear = extractYearFromFilename(path.basename(bankPath));
    const qbYear = extractYearFromFilename(path.basename(qbPath));
    const year = bankYear || qbYear || new Date().getFullYear();

    log(`Using year: ${year}`, 'info');

    // Parse files
    log('Step 1: Loading bank transactions...', 'info');
    const bankTransactions = parseBankCSV(bankPath, year);
    log(`✓ Loaded ${bankTransactions.length} bank transactions`, 'success');

    log('Step 2: Loading QuickBooks transactions...', 'info');
    const qbTransactions = parseQBExcel(qbPath, year);
    log(`✓ Loaded ${qbTransactions.length} QB transactions`, 'success');

    // Run matching
    log('Step 3: Running intelligent matching algorithm...', 'info');
    if (aiMappings && Object.keys(aiMappings).length > 0) {
      log(`  Using ${Object.keys(aiMappings).length} AI-generated vendor mappings`, 'info');
    }
    const matcher = new GLMatcher(bankTransactions, qbTransactions, aiMappings);
    const result = matcher.match();

    log(`✓ Matching complete!`, 'success');
    log(`  Total Matched: ${result.matched.length}`, 'info');
    log(`  Match Rate: ${result.matchRate.toFixed(1)}%`, 'info');
    log(`  Unmatched Bank: ${result.unmatchedBank.length}`, 'warning');
    log(`  Unmatched QB: ${result.unmatchedQB.length}`, 'warning');

    // Generate outputs
    log('Step 4: Generating output files...', 'info');
    
    // Create output directory in Downloads
    const downloadsPath = app.getPath('downloads');
    const outputDir = path.join(downloadsPath, `GL_Matching_Results_${year}_${Date.now()}`);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Export files
    const matchedPath = exportMatchedCSV(result.matched, outputDir, year.toString());
    log(`✓ Created: ${path.basename(matchedPath)}`, 'success');

    if (result.unmatchedBank.length > 0) {
      const unmatchedBankPath = exportUnmatchedBankCSV(result.unmatchedBank, outputDir, year.toString());
      log(`✓ Created: ${path.basename(unmatchedBankPath)}`, 'success');
    }

    if (result.unmatchedQB.length > 0) {
      const unmatchedQBPath = exportUnmatchedQBCSV(result.unmatchedQB, outputDir, year.toString());
      log(`✓ Created: ${path.basename(unmatchedQBPath)}`, 'success');
    }

    const reportPath = generateReport(result, bankTransactions, qbTransactions, outputDir, year.toString());
    log(`✓ Created: ${path.basename(reportPath)}`, 'success');

    // Store results for later
    lastResults = {
      bankTransactions,
      qbTransactions,
      outputDir,
      year: year.toString()
    };

    log('', 'info');
    log('🎉 Reconciliation Complete!', 'success');
    log(`Results saved to: ${outputDir}`, 'info');

    return {
      success: true,
      outputDir,
      stats: {
        totalMatched: result.matched.length,
        matchRate: result.matchRate,
        unmatchedBank: result.unmatchedBank.length,
        unmatchedQB: result.unmatchedQB.length
      }
    };

  } catch (error: any) {
    console.error('Reconciliation error:', error);
    log(`❌ Error: ${error.message}`, 'error');
    
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC: Analyze vendors with Gemini AI
 */
ipcMain.handle('analyze-vendors-gemini', async (_event, apiKey: string, bankPath: string, qbPath: string) => {
  try {
    log('🤖 Starting AI vendor analysis...', 'info');
    
    // Parse files
    const bankTransactions = await parseBankCSV(bankPath);
    const qbTransactions = await parseQBExcel(qbPath);
    
    log(`Extracted ${bankTransactions.length} bank vendors and ${qbTransactions.length} QB vendors`, 'info');
    
    // Call Gemini
    const mappings = await analyzeVendorsWithGemini(apiKey, bankTransactions, qbTransactions);
    
    const mappingCount = Object.keys(mappings).length;
    let totalVariants = 0;
    for (const variants of Object.values(mappings)) {
      totalVariants += variants.length;
    }
    
    log(`✅ AI found ${mappingCount} vendor groups with ${totalVariants} total mappings`, 'success');
    
    // Log each mapping
    for (const [canonical, variants] of Object.entries(mappings)) {
      log(`  ${canonical} ← [${variants.join(', ')}]`, 'info');
    }
    
    return { 
      success: true, 
      mappings,
      stats: {
        groups: mappingCount,
        totalVariants
      }
    };
  } catch (error: any) {
    log(`❌ AI analysis failed: ${error.message}`, 'error');
    return { 
      success: false, 
      error: error.message 
    };
  }
});

/**
 * IPC: Open results folder
 */
ipcMain.handle('open-results-folder', async (_event, folderPath: string) => {
  try {
    const { shell } = require('electron');
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

/**
 * IPC: Get app version
 */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

/**
 * Helper: Send log message to renderer
 */
function log(message: string, level: 'info' | 'success' | 'warning' | 'error') {
  console.log(`[${level.toUpperCase()}] ${message}`);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-message', { message, level });
  }
}

/**
 * Error handling
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox(
    'Fatal Error',
    `A critical error occurred:\n\n${error.message}\n\nThe application will now close.`
  );
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
