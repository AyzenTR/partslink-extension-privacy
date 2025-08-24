// Injected script for deeper page interaction
(function() {
  'use strict';

  // This script runs in the page context (not isolated like content scripts)
  // It can access page variables and functions directly

  class PageInterceptor {
    constructor() {
      this.originalFetch = window.fetch;
      this.originalXHR = window.XMLHttpRequest;
      this.interceptedRequests = [];
      this.init();
    }

    init() {
      this.interceptFetch();
      this.interceptXHR();
      this.interceptFormSubmissions();
      this.setupPageEventListeners();
      
      console.log('PartsLink Page Interceptor initialized');
    }

    interceptFetch() {
      const self = this;
      
      window.fetch = function(...args) {
        const url = args[0];
        
        // Log API calls
        console.log('Intercepted fetch:', url);
        self.interceptedRequests.push({
          type: 'fetch',
          url: url,
          timestamp: Date.now()
        });
        
        // Call original fetch
        return self.originalFetch.apply(this, args).then(response => {
          // Log response
          console.log('Fetch response:', response.status, response.statusText);
          
          // Notify content script if it's a relevant API call
          if (self.isRelevantAPICall(url)) {
            self.notifyContentScript('apiCall', {
              type: 'fetch',
              url: url,
              status: response.status
            });
          }
          
          return response;
        });
      };
    }

    interceptXHR() {
      const self = this;
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._intercepted = {
          method: method,
          url: url,
          timestamp: Date.now()
        };
        
        return originalOpen.apply(this, arguments);
      };
      
      XMLHttpRequest.prototype.send = function(data) {
        if (this._intercepted) {
          console.log('Intercepted XHR:', this._intercepted.method, this._intercepted.url);
          
          self.interceptedRequests.push({
            type: 'xhr',
            method: this._intercepted.method,
            url: this._intercepted.url,
            timestamp: this._intercepted.timestamp
          });
          
          // Add event listener for response
          this.addEventListener('readystatechange', function() {
            if (this.readyState === 4) {
              console.log('XHR response:', this.status, this.statusText);
              
              if (self.isRelevantAPICall(this._intercepted.url)) {
                self.notifyContentScript('apiCall', {
                  type: 'xhr',
                  method: this._intercepted.method,
                  url: this._intercepted.url,
                  status: this.status,
                  response: this.responseText?.substring(0, 1000) // First 1000 chars
                });
              }
            }
          });
        }
        
        return originalSend.apply(this, arguments);
      };
    }

    interceptFormSubmissions() {
      const self = this;
      
      // Intercept form submissions
      document.addEventListener('submit', function(event) {
        const form = event.target;
        if (form.tagName === 'FORM') {
          console.log('Form submission intercepted:', form.action || window.location.href);
          
          // Extract form data
          const formData = new FormData(form);
          const formObject = {};
          for (let [key, value] of formData.entries()) {
            formObject[key] = value;
          }
          
          self.notifyContentScript('formSubmission', {
            action: form.action || window.location.href,
            method: form.method || 'GET',
            data: formObject
          });
        }
      });
    }

    setupPageEventListeners() {
      const self = this;
      
      // Listen for page navigation events
      let lastUrl = window.location.href;
      
      const checkUrlChange = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
          console.log('Page navigation detected:', lastUrl, '->', currentUrl);
          lastUrl = currentUrl;
          
          self.notifyContentScript('navigation', {
            from: lastUrl,
            to: currentUrl,
            timestamp: Date.now()
          });
        }
      };
      
      // Check for URL changes (for SPA navigation)
      setInterval(checkUrlChange, 1000);
      
      // Listen for popstate events
      window.addEventListener('popstate', checkUrlChange);
      
      // Listen for pushState/replaceState
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(...args) {
        originalPushState.apply(this, args);
        setTimeout(checkUrlChange, 100);
      };
      
      history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        setTimeout(checkUrlChange, 100);
      };
    }

    isRelevantAPICall(url) {
      // Check if this API call is relevant for car parts search
      const relevantKeywords = [
        'search', 'parts', 'vin', 'vehicle', 'catalog',
        'product', 'component', 'filter', 'query'
      ];
      
      const urlLower = url.toLowerCase();
      return relevantKeywords.some(keyword => urlLower.includes(keyword));
    }

    notifyContentScript(type, data) {
      // Send message to content script via custom event
      const event = new CustomEvent('pageInterceptorMessage', {
        detail: {
          type: type,
          data: data,
          timestamp: Date.now()
        }
      });
      
      document.dispatchEvent(event);
    }

    // Method to extract page-specific data
    extractPageData() {
      const data = {
        title: document.title,
        url: window.location.href,
        forms: [],
        inputs: [],
        links: [],
        tables: [],
        lists: []
      };
      
      // Extract forms
      document.querySelectorAll('form').forEach((form, index) => {
        const formData = {
          index: index,
          action: form.action,
          method: form.method,
          inputs: []
        };
        
        form.querySelectorAll('input, select, textarea').forEach(input => {
          formData.inputs.push({
            type: input.type || input.tagName.toLowerCase(),
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            required: input.required,
            value: input.value
          });
        });
        
        data.forms.push(formData);
      });
      
      // Extract standalone inputs
      document.querySelectorAll('input:not(form input)').forEach((input, index) => {
        data.inputs.push({
          index: index,
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          value: input.value
        });
      });
      
      // Extract relevant links
      document.querySelectorAll('a[href]').forEach((link, index) => {
        const text = link.textContent?.trim();
        if (text && text.length > 0 && text.length < 100) {
          data.links.push({
            index: index,
            href: link.href,
            text: text,
            title: link.title
          });
        }
      });
      
      // Extract tables (often contain parts data)
      document.querySelectorAll('table').forEach((table, index) => {
        const rows = [];
        table.querySelectorAll('tr').forEach((row, rowIndex) => {
          const cells = [];
          row.querySelectorAll('td, th').forEach(cell => {
            cells.push(cell.textContent?.trim());
          });
          if (cells.length > 0) {
            rows.push(cells);
          }
        });
        
        if (rows.length > 0) {
          data.tables.push({
            index: index,
            rows: rows.slice(0, 10) // Limit to first 10 rows
          });
        }
      });
      
      return data;
    }

    // Method to get all text content for AI analysis
    getPageTextContent() {
      // Remove script and style elements
      const clone = document.cloneNode(true);
      const scripts = clone.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());
      
      return clone.body ? clone.body.textContent : clone.textContent;
    }
  }

  // Initialize interceptor
  const interceptor = new PageInterceptor();
  
  // Make interceptor available globally for debugging
  window.partsLinkInterceptor = interceptor;
  
  // Listen for messages from content script
  document.addEventListener('contentScriptMessage', function(event) {
    const { type, data } = event.detail;
    
    switch (type) {
      case 'extractPageData':
        const pageData = interceptor.extractPageData();
        
        // Send response back
        const responseEvent = new CustomEvent('injectedScriptResponse', {
          detail: {
            type: 'pageData',
            data: pageData
          }
        });
        document.dispatchEvent(responseEvent);
        break;
        
      case 'getTextContent':
        const textContent = interceptor.getPageTextContent();
        
        const textEvent = new CustomEvent('injectedScriptResponse', {
          detail: {
            type: 'textContent',
            data: textContent
          }
        });
        document.dispatchEvent(textEvent);
        break;
    }
  });

})();