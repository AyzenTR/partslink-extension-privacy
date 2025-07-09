// Content script for PartsLink AI Scraper
class PartsLinkScraper {
  constructor() {
    this.isActive = false;
    this.scrapingData = null;
    this.observer = null;
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.injectStyles();
    console.log('PartsLink AI Scraper content script loaded');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'startScraping':
          await this.startScraping(message.data);
          sendResponse({ success: true });
          break;
          
        case 'executeAction':
          await this.executeAction(message.data);
          sendResponse({ success: true });
          break;
          
        case 'continueScraping':
          await this.continueScraping();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async startScraping(data) {
    try {
      this.isActive = true;
      this.scrapingData = data;
      
      this.showNotification('AI Scraping Started', 'Starting intelligent web scraping...', 'info');
      
      // Wait for page to be fully loaded
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          window.addEventListener('load', resolve, { once: true });
        });
      }
      
      // Start scraping process
      await this.scrapePage();
      
    } catch (error) {
      console.error('Error starting scraping:', error);
      this.showNotification('Scraping Error', error.message, 'error');
    }
  }

  async scrapePage() {
    try {
      if (!this.isActive) return;
      
      // Get current page HTML
      const html = document.documentElement.outerHTML;
      const url = window.location.href;
      
      // Get page title and meta info
      const title = document.title;
      const meta = this.extractMetaInfo();
      
      console.log('Scraping page:', url);
      
      // Send HTML to background script for AI analysis
      await chrome.runtime.sendMessage({
        action: 'htmlScraped',
        data: {
          html: html,
          url: url,
          title: title,
          meta: meta
        }
      });
      
    } catch (error) {
      console.error('Error scraping page:', error);
      this.showNotification('Scraping Error', 'Failed to scrape page: ' + error.message, 'error');
    }
  }

  async continueScraping() {
    try {
      if (!this.isActive) return;
      
      // Wait a bit for any page changes to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Continue scraping the current page
      await this.scrapePage();
      
    } catch (error) {
      console.error('Error continuing scraping:', error);
    }
  }

  extractMetaInfo() {
    const meta = {};
    
    // Get meta tags
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });
    
    // Get form count
    meta.formCount = document.querySelectorAll('form').length;
    
    // Get input count
    meta.inputCount = document.querySelectorAll('input').length;
    
    // Get link count
    meta.linkCount = document.querySelectorAll('a').length;
    
    return meta;
  }

  async executeAction(actionData) {
    try {
      console.log('Executing action:', actionData);
      
      switch (actionData.type) {
        case 'click':
          await this.clickElement(actionData.target);
          break;
          
        case 'fill_input':
          await this.fillInput(actionData.target, actionData.value);
          break;
          
        case 'fill_form':
          await this.fillForm(actionData);
          break;
          
        case 'select_option':
          await this.selectOption(actionData.target, actionData.value);
          break;
          
        case 'submit':
          await this.submitForm(actionData.target);
          break;
          
        default:
          throw new Error('Unknown action type: ' + actionData.type);
      }
      
      // Notify background that action is completed
      await chrome.runtime.sendMessage({
        action: 'actionCompleted',
        data: { action: actionData.type }
      });
      
    } catch (error) {
      console.error('Error executing action:', error);
      this.showNotification('Action Error', 'Failed to execute action: ' + error.message, 'error');
      throw error;
    }
  }

  async clickElement(selector) {
    const element = this.findElement(selector);
    if (!element) {
      throw new Error('Element not found: ' + selector);
    }
    
    this.highlightElement(element);
    
    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Wait a bit for scroll
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Click the element
    element.click();
    
    this.showNotification('Action Executed', `Clicked: ${element.textContent?.substring(0, 50) || selector}`, 'success');
  }

  async fillInput(selector, value) {
    const element = this.findElement(selector);
    if (!element) {
      throw new Error('Input element not found: ' + selector);
    }
    
    this.highlightElement(element);
    
    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Wait a bit for scroll
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear existing value
    element.value = '';
    element.focus();
    
    // Type the value character by character to trigger events
    for (let i = 0; i < value.length; i++) {
      element.value += value[i];
      
      // Trigger input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('keyup', { bubbles: true }));
      
      // Small delay between characters
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Trigger change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    this.showNotification('Action Executed', `Filled input with: ${value}`, 'success');
  }

  async fillForm(actionData) {
    // Fill first input
    if (actionData.target && actionData.value) {
      await this.fillInput(actionData.target, actionData.value);
    }
    
    // Fill second input if specified
    if (actionData.next_target && actionData.next_value) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.fillInput(actionData.next_target, actionData.next_value);
    }
    
    // Submit form if requested
    if (actionData.submit !== false) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find submit button
      const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], button:contains("Submit"), button:contains("Login")');
      if (submitBtn) {
        await this.clickElement('input[type="submit"], button[type="submit"]');
      }
    }
  }

  async selectOption(selector, value) {
    const element = this.findElement(selector);
    if (!element) {
      throw new Error('Select element not found: ' + selector);
    }
    
    this.highlightElement(element);
    
    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Wait a bit for scroll
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Select the option
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    this.showNotification('Action Executed', `Selected option: ${value}`, 'success');
  }

  async submitForm(selector) {
    const form = this.findElement(selector || 'form');
    if (!form) {
      throw new Error('Form not found: ' + (selector || 'form'));
    }
    
    this.highlightElement(form);
    
    // Submit the form
    form.submit();
    
    this.showNotification('Action Executed', 'Form submitted', 'success');
  }

  findElement(selector) {
    try {
      // Try direct querySelector first
      let element = document.querySelector(selector);
      if (element) return element;
      
      // Try with case-insensitive attribute matching
      if (selector.includes('[') && selector.includes('*=')) {
        const parts = selector.match(/([^[]+)\[([^*]+)\*="([^"]+)"\]/);
        if (parts) {
          const [, tag, attr, value] = parts;
          const elements = document.querySelectorAll(tag);
          for (let el of elements) {
            const attrValue = el.getAttribute(attr);
            if (attrValue && attrValue.toLowerCase().includes(value.toLowerCase())) {
              return el;
            }
          }
        }
      }
      
      // Try finding by text content
      if (selector.includes(':contains(')) {
        const textMatch = selector.match(/:contains\("([^"]+)"\)/);
        if (textMatch) {
          const text = textMatch[1];
          const elements = document.querySelectorAll('*');
          for (let el of elements) {
            if (el.textContent && el.textContent.includes(text)) {
              return el;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding element:', error);
      return null;
    }
  }

  highlightElement(element) {
    // Remove existing highlights
    const existingHighlights = document.querySelectorAll('.ai-scraper-highlight');
    existingHighlights.forEach(el => el.classList.remove('ai-scraper-highlight'));
    
    // Add highlight to current element
    element.classList.add('ai-scraper-highlight');
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      element.classList.remove('ai-scraper-highlight');
    }, 3000);
  }

  showNotification(title, message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.ai-scraper-notification');
    if (existing) {
      existing.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `ai-scraper-notification ai-scraper-${type}`;
    notification.innerHTML = `
      <div class="ai-scraper-notification-content">
        <div class="ai-scraper-notification-title">${title}</div>
        <div class="ai-scraper-notification-message">${message}</div>
      </div>
      <button class="ai-scraper-notification-close">×</button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Close button functionality
    notification.querySelector('.ai-scraper-notification-close').addEventListener('click', () => {
      notification.remove();
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  injectStyles() {
    if (document.querySelector('#ai-scraper-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'ai-scraper-styles';
    styles.textContent = `
      .ai-scraper-highlight {
        outline: 3px solid #ff6b35 !important;
        outline-offset: 2px !important;
        background-color: rgba(255, 107, 53, 0.1) !important;
        transition: all 0.3s ease !important;
      }
      
      .ai-scraper-notification {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: white !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        padding: 16px !important;
        max-width: 350px !important;
        z-index: 999999 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        display: flex !important;
        align-items: flex-start !important;
        gap: 12px !important;
        border-left: 4px solid #007bff !important;
      }
      
      .ai-scraper-notification.ai-scraper-success {
        border-left-color: #28a745 !important;
      }
      
      .ai-scraper-notification.ai-scraper-error {
        border-left-color: #dc3545 !important;
      }
      
      .ai-scraper-notification.ai-scraper-info {
        border-left-color: #17a2b8 !important;
      }
      
      .ai-scraper-notification-content {
        flex: 1 !important;
      }
      
      .ai-scraper-notification-title {
        font-weight: 600 !important;
        margin-bottom: 4px !important;
        color: #333 !important;
      }
      
      .ai-scraper-notification-message {
        color: #666 !important;
        word-wrap: break-word !important;
      }
      
      .ai-scraper-notification-close {
        background: none !important;
        border: none !important;
        font-size: 18px !important;
        cursor: pointer !important;
        color: #999 !important;
        padding: 0 !important;
        line-height: 1 !important;
        width: 20px !important;
        height: 20px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      .ai-scraper-notification-close:hover {
        color: #333 !important;
      }
    `;
    
    document.head.appendChild(styles);
  }
}

// Initialize the scraper
const scraper = new PartsLinkScraper();

// Monitor for dynamic content changes
const observer = new MutationObserver((mutations) => {
  // Only process if scraping is active
  if (scraper.isActive) {
    let shouldReanalyze = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if significant content was added
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.tagName && 
                (element.tagName.toLowerCase() === 'form' || 
                 element.querySelector('form, input, button'))) {
              shouldReanalyze = true;
            }
          }
        });
      }
    });
    
    if (shouldReanalyze) {
      // Debounce re-analysis
      clearTimeout(scraper.reanalyzeTimeout);
      scraper.reanalyzeTimeout = setTimeout(() => {
        if (scraper.isActive) {
          scraper.scrapePage();
        }
      }, 2000);
    }
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('PartsLink AI Scraper content script initialized');