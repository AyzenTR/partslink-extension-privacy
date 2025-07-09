// Popup script for PartsLink AI Scraper
class PopupController {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSavedData();
    this.checkScrapingStatus();
  }

  setupEventListeners() {
    document.getElementById('startScraping').addEventListener('click', () => this.startScraping());
    document.getElementById('stopScraping').addEventListener('click', () => this.stopScraping());
    document.getElementById('clearLog').addEventListener('click', () => this.clearLog());
    
    // Save input data as user types
    document.getElementById('vinInput').addEventListener('input', () => this.saveInputData());
    document.getElementById('partName').addEventListener('input', () => this.saveInputData());
    document.getElementById('apiKey').addEventListener('input', () => this.saveApiKey());
  }

  async loadSavedData() {
    try {
      const data = await chrome.storage.local.get(['vinInput', 'partName', 'geminiApiKey']);
      if (data.vinInput) {
        document.getElementById('vinInput').value = data.vinInput;
      }
      if (data.partName) {
        document.getElementById('partName').value = data.partName;
      }
      if (data.geminiApiKey) {
        document.getElementById('apiKey').value = data.geminiApiKey;
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }

  async saveInputData() {
    try {
      const vinInput = document.getElementById('vinInput').value;
      const partName = document.getElementById('partName').value;
      
      await chrome.storage.local.set({
        vinInput: vinInput,
        partName: partName
      });
    } catch (error) {
      console.error('Error saving input data:', error);
    }
  }

  async saveApiKey() {
    try {
      const apiKey = document.getElementById('apiKey').value;
      await chrome.storage.local.set({ geminiApiKey: apiKey });
      
      // Reinitialize AI model in background script
      chrome.runtime.sendMessage({ action: 'reinitializeAI' });
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  }

  async checkScrapingStatus() {
    try {
      const status = await chrome.storage.local.get(['isScrapingActive']);
      if (status.isScrapingActive) {
        this.setScrapingUI(true);
        this.showStatus('Scraping in progress...', 'info');
      }
    } catch (error) {
      console.error('Error checking scraping status:', error);
    }
  }

  async startScraping() {
    const vinInput = document.getElementById('vinInput').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    
    if (!apiKey) {
      this.showStatus('Please enter your Gemini API key first', 'error');
      return;
    }
    
    if (!vinInput) {
      this.showStatus('Please enter a VIN number', 'error');
      return;
    }

    if (vinInput.length !== 17) {
      this.showStatus('VIN must be exactly 17 characters', 'error');
      return;
    }

    const partName = document.getElementById('partName').value.trim();
    const aiModel = document.getElementById('aiModel').value;

    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('partslink24.com')) {
        this.showStatus('Please navigate to partslink24.com first', 'error');
        return;
      }

      // Send message to background script to start scraping
      const response = await chrome.runtime.sendMessage({
        action: 'startScraping',
        data: {
          vin: vinInput,
          partName: partName,
          aiModel: aiModel,
          tabId: tab.id
        }
      });

      if (response.success) {
        this.setScrapingUI(true);
        this.showStatus('Starting AI scraping process...', 'success');
        this.addLog('Scraping started with VIN: ' + vinInput);
      } else {
        this.showStatus('Failed to start scraping: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error starting scraping:', error);
      this.showStatus('Error starting scraping: ' + error.message, 'error');
    }
  }

  async stopScraping() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'stopScraping'
      });

      if (response.success) {
        this.setScrapingUI(false);
        this.showStatus('Scraping stopped', 'info');
        this.addLog('Scraping stopped by user');
      } else {
        this.showStatus('Failed to stop scraping: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error stopping scraping:', error);
      this.showStatus('Error stopping scraping: ' + error.message, 'error');
    }
  }

  setScrapingUI(isActive) {
    const startBtn = document.getElementById('startScraping');
    const stopBtn = document.getElementById('stopScraping');
    const vinInput = document.getElementById('vinInput');
    
    if (isActive) {
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      vinInput.disabled = true;
    } else {
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      vinInput.disabled = false;
    }
  }

  showStatus(message, type) {
    const statusArea = document.getElementById('statusArea');
    statusArea.innerHTML = `<div class="status ${type}">${message}</div>`;
    
    // Auto-hide success/info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (statusArea.innerHTML.includes(message)) {
          statusArea.innerHTML = '';
        }
      }, 5000);
    }
  }

  addLog(message) {
    const logArea = document.getElementById('logArea');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}\n`;
    logArea.textContent += logEntry;
    logArea.scrollTop = logArea.scrollHeight;
    
    // Store logs in chrome storage
    this.saveLogEntry(logEntry);
  }

  async saveLogEntry(logEntry) {
    try {
      const logs = await chrome.storage.local.get(['scrapingLogs']);
      const currentLogs = logs.scrapingLogs || '';
      const newLogs = currentLogs + logEntry;
      
      // Keep only last 1000 lines
      const lines = newLogs.split('\n');
      const trimmedLogs = lines.slice(-1000).join('\n');
      
      await chrome.storage.local.set({ scrapingLogs: trimmedLogs });
    } catch (error) {
      console.error('Error saving log entry:', error);
    }
  }

  async clearLog() {
    document.getElementById('logArea').textContent = '';
    try {
      await chrome.storage.local.remove(['scrapingLogs']);
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  }

  async loadLogs() {
    try {
      const logs = await chrome.storage.local.get(['scrapingLogs']);
      if (logs.scrapingLogs) {
        document.getElementById('logArea').textContent = logs.scrapingLogs;
        const logArea = document.getElementById('logArea');
        logArea.scrollTop = logArea.scrollHeight;
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popupController = new PopupController();
  
  // Load existing logs
  popupController.loadLogs();
  
  // Listen for real-time updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateLog') {
      popupController.addLog(message.data);
    } else if (message.action === 'updateStatus') {
      popupController.showStatus(message.data.message, message.data.type);
    } else if (message.action === 'scrapingComplete') {
      popupController.setScrapingUI(false);
      popupController.showStatus('Scraping completed!', 'success');
      popupController.addLog('Scraping completed successfully');
    } else if (message.action === 'scrapingError') {
      popupController.setScrapingUI(false);
      popupController.showStatus('Scraping error: ' + message.data, 'error');
      popupController.addLog('Scraping error: ' + message.data);
    }
  });
});