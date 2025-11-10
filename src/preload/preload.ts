import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  selectBankFile: () => ipcRenderer.invoke('select-bank-file'),
  selectQBFile: () => ipcRenderer.invoke('select-qb-file'),
  
  // Processing
  processReconciliation: (bankPath: string, qbPath: string) => 
    ipcRenderer.invoke('process-reconciliation', bankPath, qbPath),
  
  // Results
  openResultsFolder: (folderPath: string) => 
    ipcRenderer.invoke('open-results-folder', folderPath),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Logging
  onLogMessage: (callback: (data: { message: string; level: string }) => void) => {
    ipcRenderer.on('log-message', (_event, data) => callback(data));
  }
});
