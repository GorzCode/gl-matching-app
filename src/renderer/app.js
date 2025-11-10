// Aritas GL Matching - Frontend Logic

// DOM Elements
const bankFilePathInput = document.getElementById('bankFilePath');
const qbFilePathInput = document.getElementById('qbFilePath');
const selectBankBtn = document.getElementById('selectBankBtn');
const selectQBBtn = document.getElementById('selectQBBtn');
const processBtn = document.getElementById('processBtn');
const openResultsBtn = document.getElementById('openResultsBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const logsDiv = document.getElementById('logs');
const resultsStatsDiv = document.getElementById('resultsStats');
const appVersionSpan = document.getElementById('appVersion');

// Stats elements
const statMatched = document.getElementById('statMatched');
const statMatchRate = document.getElementById('statMatchRate');
const statUnmatchedBank = document.getElementById('statUnmatchedBank');
const statUnmatchedQB = document.getElementById('statUnmatchedQB');

// State
let bankFilePath = null;
let qbFilePath = null;
let isProcessing = false;
let lastResultsFolder = null;

/**
 * Initialize application
 */
async function init() {
  // Load app version
  try {
    const version = await window.electronAPI.getAppVersion();
    appVersionSpan.textContent = `v${version}`;
  } catch (error) {
    console.error('Failed to get app version:', error);
  }

  // Setup log listener
  window.electronAPI.onLogMessage((data) => {
    addLog(data.message, data.level);
  });

  addLog('Welcome to Aritas GL Matching & Reconciliation Tool', 'info');
  addLog('Select your bank and QuickBooks files to begin', 'info');
}

/**
 * Select Bank CSV file
 */
selectBankBtn.addEventListener('click', async () => {
  const filePath = await window.electronAPI.selectBankFile();
  
  if (filePath) {
    bankFilePath = filePath;
    const fileName = filePath.split(/[/\\]/).pop();
    bankFilePathInput.value = fileName;
    addLog(`✓ Bank file selected: ${fileName}`, 'success');
    updateProcessButton();
  }
});

/**
 * Select QuickBooks Excel file
 */
selectQBBtn.addEventListener('click', async () => {
  const filePath = await window.electronAPI.selectQBFile();
  
  if (filePath) {
    qbFilePath = filePath;
    const fileName = filePath.split(/[/\\]/).pop();
    qbFilePathInput.value = fileName;
    addLog(`✓ QuickBooks file selected: ${fileName}`, 'success');
    updateProcessButton();
  }
});

/**
 * Process reconciliation
 */
processBtn.addEventListener('click', async () => {
  if (!bankFilePath || !qbFilePath) {
    addLog('❌ Please select both files', 'error');
    return;
  }

  isProcessing = true;
  updateProcessButton();
  hideStats();

  addLog('', 'info');
  addLog('═══════════════════════════════════════════════════════════', 'info');
  addLog('🚀 Starting GL Matching & Reconciliation...', 'info');
  addLog('═══════════════════════════════════════════════════════════', 'info');

  try {
    const result = await window.electronAPI.processReconciliation(bankFilePath, qbFilePath);

    if (result.success) {
      lastResultsFolder = result.outputDir;
      openResultsBtn.disabled = false;
      
      // Display stats
      showStats(result.stats);
      
      addLog('', 'info');
      addLog('═══════════════════════════════════════════════════════════', 'success');
      addLog('✅ RECONCILIATION COMPLETE!', 'success');
      addLog('═══════════════════════════════════════════════════════════', 'success');
    } else {
      addLog('', 'error');
      addLog('❌ Reconciliation failed: ' + result.error, 'error');
    }
  } catch (error) {
    addLog('', 'error');
    addLog('❌ Unexpected error: ' + error.message, 'error');
  } finally {
    isProcessing = false;
    updateProcessButton();
  }
});

/**
 * Open results folder
 */
openResultsBtn.addEventListener('click', async () => {
  if (lastResultsFolder) {
    const result = await window.electronAPI.openResultsFolder(lastResultsFolder);
    if (result.success) {
      addLog(`📂 Opened results folder`, 'info');
    } else {
      addLog(`❌ Failed to open folder: ${result.error}`, 'error');
    }
  }
});

/**
 * Clear logs
 */
clearLogsBtn.addEventListener('click', () => {
  logsDiv.innerHTML = '';
  addLog('Logs cleared', 'info');
});

/**
 * Add log entry
 */
function addLog(message, level = 'info') {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${level}`;
  
  const timestamp = new Date().toLocaleTimeString();
  logEntry.textContent = message ? `[${timestamp}] ${message}` : '';
  
  logsDiv.appendChild(logEntry);
  logsDiv.scrollTop = logsDiv.scrollHeight;
}

/**
 * Update process button state
 */
function updateProcessButton() {
  const hasFiles = bankFilePath && qbFilePath;
  processBtn.disabled = !hasFiles || isProcessing;
  
  const btnText = processBtn.querySelector('.btn-text');
  const spinner = processBtn.querySelector('.spinner');
  
  if (isProcessing) {
    btnText.style.display = 'none';
    spinner.style.display = 'inline';
  } else {
    btnText.style.display = 'inline';
    spinner.style.display = 'none';
  }
}

/**
 * Show statistics
 */
function showStats(stats) {
  statMatched.textContent = stats.totalMatched.toLocaleString();
  statMatchRate.textContent = stats.matchRate.toFixed(1) + '%';
  statUnmatchedBank.textContent = stats.unmatchedBank.toLocaleString();
  statUnmatchedQB.textContent = stats.unmatchedQB.toLocaleString();
  
  resultsStatsDiv.style.display = 'block';
}

/**
 * Hide statistics
 */
function hideStats() {
  resultsStatsDiv.style.display = 'none';
}

// Initialize on load
init();
