// Background service worker for PartsLink AI Scraper
class AIScrapingOrchestrator {
  constructor() {
    this.isScrapingActive = false;
    this.currentSession = null;
    this.aiModel = null;
    this.scrapingData = {
      vin: '',
      partName: '',
      currentStep: 0,
      maxSteps: 50, // Prevent infinite loops
      foundParts: []
    };
    
    this.init();
  }

  init() {
    this.setupMessageListeners();
    this.setupAIModel();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  async setupAIModel() {
    try {
      // Get API key from storage
      const result = await chrome.storage.local.get(['geminiApiKey']);
      
      if (!result.geminiApiKey) {
        console.warn('Gemini API key not configured');
        this.aiModel = {
          model: "models/gemini-2.0-flash",
          initialized: false,
          error: 'API key not configured'
        };
        return;
      }
      
      this.aiModel = {
        model: "models/gemini-2.0-flash",
        apiKey: result.geminiApiKey,
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
        initialized: true
      };
      
      console.log('AI Model initialized with Gemini 2.0 Flash API');
    } catch (error) {
      console.error('Failed to initialize AI model:', error);
      this.aiModel = {
        model: "models/gemini-2.0-flash",
        initialized: false,
        error: error.message
      };
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'startScraping':
          const result = await this.startScraping(message.data);
          sendResponse(result);
          break;
          
        case 'stopScraping':
          const stopResult = await this.stopScraping();
          sendResponse(stopResult);
          break;
          
        case 'htmlScraped':
          await this.processScrapedHTML(message.data, sender.tab.id);
          sendResponse({ success: true });
          break;
          
        case 'actionCompleted':
          await this.handleActionCompleted(message.data, sender.tab.id);
          sendResponse({ success: true });
          break;
          
        case 'reinitializeAI':
          await this.setupAIModel();
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
      if (this.isScrapingActive) {
        return { success: false, error: 'Scraping already in progress' };
      }

      this.isScrapingActive = true;
      this.scrapingData = {
        vin: data.vin,
        partName: data.partName,
        aiModel: data.aiModel,
        tabId: data.tabId,
        currentStep: 0,
        maxSteps: 50,
        foundParts: [],
        startTime: Date.now()
      };

      // Store active state
      await chrome.storage.local.set({ 
        isScrapingActive: true,
        scrapingData: this.scrapingData 
      });

      // Start the scraping process
      this.broadcastLog('Starting AI-powered scraping session');
      this.broadcastLog(`VIN: ${data.vin}`);
      this.broadcastLog(`Part: ${data.partName || 'Any part'}`);
      
      // Inject content script and start scraping
      await this.initiateScraping(data.tabId);

      return { success: true };
    } catch (error) {
      this.isScrapingActive = false;
      await chrome.storage.local.set({ isScrapingActive: false });
      throw error;
    }
  }

  async stopScraping() {
    try {
      this.isScrapingActive = false;
      await chrome.storage.local.set({ isScrapingActive: false });
      
      this.broadcastLog('Scraping stopped by user');
      
      return { success: true };
    } catch (error) {
      console.error('Error stopping scraping:', error);
      return { success: false, error: error.message };
    }
  }

  async initiateScraping(tabId) {
    try {
      // Send message to content script to start scraping
      await chrome.tabs.sendMessage(tabId, {
        action: 'startScraping',
        data: this.scrapingData
      });
    } catch (error) {
      console.error('Error initiating scraping:', error);
      this.broadcastError('Failed to start scraping: ' + error.message);
    }
  }

  async processScrapedHTML(data, tabId) {
    try {
      if (!this.isScrapingActive) {
        return;
      }

      this.scrapingData.currentStep++;
      
      if (this.scrapingData.currentStep > this.scrapingData.maxSteps) {
        await this.completeScraping('Maximum steps reached');
        return;
      }

      this.broadcastLog(`Step ${this.scrapingData.currentStep}: Analyzing page...`);
      
      // Process HTML with AI
      const aiDecision = await this.analyzeHTMLWithAI(data.html, data.url);
      
      if (aiDecision.found) {
        this.scrapingData.foundParts.push(...aiDecision.parts);
        this.broadcastLog(`Found ${aiDecision.parts.length} parts on this page`);
      }

      if (aiDecision.completed) {
        await this.completeScraping('Search completed successfully');
        return;
      }

      // Execute AI decision
      if (aiDecision.action) {
        await this.executeAIAction(aiDecision, tabId);
      } else {
        await this.completeScraping('No further actions available');
      }
      
    } catch (error) {
      console.error('Error processing scraped HTML:', error);
      this.broadcastError('Error processing page: ' + error.message);
    }
  }

  async analyzeHTMLWithAI(html, url) {
    try {
      if (!this.aiModel || !this.aiModel.initialized) {
        throw new Error('AI model not initialized or API key not configured');
      }
      
      this.broadcastLog('Sending HTML to Gemini 2.0 Flash for analysis...');
      
      // Create a simplified version of the HTML for AI analysis
      const simplifiedHTML = this.simplifyHTML(html);
      
      // Call Gemini API for real AI decision making
      const decision = await this.callGeminiAPI(simplifiedHTML, url);
      
      this.broadcastLog(`AI Decision: ${decision.reasoning}`);
      
      return decision;
    } catch (error) {
      console.error('Error in AI analysis:', error);
      this.broadcastLog(`AI Error: ${error.message}`);
      return {
        action: null,
        completed: true,
        reasoning: 'AI analysis failed: ' + error.message
      };
    }
  }

  simplifyHTML(html) {
    // Remove scripts, styles, and keep only essential elements
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove unwanted elements
    const unwantedElements = doc.querySelectorAll('script, style, noscript');
    unwantedElements.forEach(el => el.remove());
    
    // Keep only forms, inputs, buttons, links, and text content
    const relevantElements = doc.querySelectorAll('form, input, button, a, h1, h2, h3, select, textarea');
    
    let simplified = '';
    relevantElements.forEach((el, index) => {
      const tagName = el.tagName.toLowerCase();
      const text = el.textContent?.trim().substring(0, 100) || '';
      const id = el.id || '';
      const className = el.className || '';
      const type = el.type || '';
      const href = el.href || '';
      const value = el.value || '';
      
      simplified += `[${index}] ${tagName}`;
      if (id) simplified += ` id="${id}"`;
      if (className) simplified += ` class="${className}"`;
      if (type) simplified += ` type="${type}"`;
      if (href) simplified += ` href="${href}"`;
      if (value) simplified += ` value="${value}"`;
      if (text) simplified += ` text="${text}"`;
      simplified += '\n';
    });
    
    return simplified;
  }

  async callGeminiAPI(simplifiedHTML, url) {
    try {
      const vin = this.scrapingData.vin;
      const partName = this.scrapingData.partName || 'any car part';
      
      const prompt = `You are an AI web scraping assistant helping to find car parts on partslink24.com.

Current page URL: ${url}
VIN number: ${vin}
Looking for: ${partName}

Here is the simplified HTML structure of the current page:
${simplifiedHTML.substring(0, 8000)} ${simplifiedHTML.length > 8000 ? '...[truncated]' : ''}

Your task is to analyze this page and decide what action to take next. You should respond with a JSON object containing:
- action: null or an object with type, target, and value
- reasoning: brief explanation of your decision  
- completed: boolean if search is done
- found: boolean if parts were found on this page
- parts: array of part objects if found

Action types you can use:
- "fill_form": Fill login form (target: selector, value: username, next_target: password field, next_value: password)
- "fill_input": Fill an input field (target: selector, value: text to enter)
- "click": Click an element (target: selector)
- "submit": Submit a form (target: form selector)

Examples:
Login form: {"action": {"type": "fill_form", "target": "input[name='username']", "value": "demo_user", "next_target": "input[type='password']", "next_value": "demo_password"}, "reasoning": "Found login form", "completed": false, "found": false}

VIN input: {"action": {"type": "fill_input", "target": "input[name='vin']", "value": "${vin}"}, "reasoning": "Found VIN input field", "completed": false, "found": false}

Found parts: {"action": null, "reasoning": "Found car parts on page", "completed": true, "found": true, "parts": [{"name": "Brake Pad", "price": "50€"}]}

Analyze the page and respond with appropriate JSON:`;

      const requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000
        }
      };

      const response = await fetch(`${this.aiModel.apiUrl}?key=${this.aiModel.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API');
      }

      const aiResponse = data.candidates[0].content.parts[0].text;
      
      // Parse JSON response from AI
      let decision;
      try {
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          decision = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch (parseError) {
        console.warn('Failed to parse AI JSON response:', aiResponse);
        // Fallback to simulate decision if JSON parsing fails
        decision = await this.simulateAIDecision(simplifiedHTML, url);
      }

      // Validate decision structure
      if (!decision.hasOwnProperty('completed')) {
        decision.completed = false;
      }
      if (!decision.hasOwnProperty('found')) {
        decision.found = false;
      }
      if (!decision.reasoning) {
        decision.reasoning = 'AI analysis completed';
      }

      return decision;
      
    } catch (error) {
      console.error('Gemini API call failed:', error);
      this.broadcastLog(`Gemini API Error: ${error.message}`);
      
      // Fallback to simulation if API fails
      this.broadcastLog('Falling back to simulated AI decision...');
      return await this.simulateAIDecision(simplifiedHTML, url);
    }
  }
  async simulateAIDecision(simplifiedHTML, url) {
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate AI processing time
    
    const vin = this.scrapingData.vin;
    const partName = this.scrapingData.partName;
    
    // Check if we're on a login page
    if (simplifiedHTML.includes('password') && simplifiedHTML.includes('login')) {
      return {
        action: {
          type: 'fill_form',
          target: 'input[type="text"], input[name="username"], input[name="email"]',
          value: 'demo_user', // This would be configured
          next_target: 'input[type="password"]',
          next_value: 'demo_password'
        },
        reasoning: 'Detected login form, attempting to log in',
        completed: false,
        found: false
      };
    }
    
    // Check if we can enter VIN
    if (simplifiedHTML.includes('vin') || simplifiedHTML.includes('chassis')) {
      return {
        action: {
          type: 'fill_input',
          target: 'input[placeholder*="VIN"], input[name*="vin"], input[id*="vin"]',
          value: vin
        },
        reasoning: 'Found VIN input field, entering VIN number',
        completed: false,
        found: false
      };
    }
    
    // Check for search functionality
    if (simplifiedHTML.includes('search') && partName) {
      return {
        action: {
          type: 'fill_input',
          target: 'input[type="search"], input[name*="search"], input[placeholder*="search"]',
          value: partName
        },
        reasoning: 'Found search field, searching for specified part',
        completed: false,
        found: false
      };
    }
    
    // Check for parts in the page
    if (simplifiedHTML.includes('part') || simplifiedHTML.includes('component')) {
      const parts = this.extractPartsFromHTML(simplifiedHTML);
      if (parts.length > 0) {
        return {
          action: null,
          reasoning: `Found ${parts.length} parts on this page`,
          completed: parts.length > 5, // Complete if we found enough parts
          found: true,
          parts: parts
        };
      }
    }
    
    // Check for navigation links
    const navigationLinks = this.findNavigationLinks(simplifiedHTML);
    if (navigationLinks.length > 0) {
      return {
        action: {
          type: 'click',
          target: navigationLinks[0].selector,
          value: navigationLinks[0].text
        },
        reasoning: `Navigating to: ${navigationLinks[0].text}`,
        completed: false,
        found: false
      };
    }
    
    // Default: complete if no actionable elements found
    return {
      action: null,
      reasoning: 'No actionable elements found, completing search',
      completed: true,
      found: false
    };
  }

  extractPartsFromHTML(html) {
    const parts = [];
    const lines = html.split('\n');
    
    lines.forEach(line => {
      if (line.includes('part') || line.includes('component')) {
        const match = line.match(/text="([^"]+)"/);
        if (match) {
          parts.push({
            name: match[1],
            source: 'AI_EXTRACTED'
          });
        }
      }
    });
    
    return parts;
  }

  findNavigationLinks(html) {
    const links = [];
    const lines = html.split('\n');
    
    lines.forEach(line => {
      if (line.includes('a ') && line.includes('href')) {
        const textMatch = line.match(/text="([^"]+)"/);
        const hrefMatch = line.match(/href="([^"]+)"/);
        const idMatch = line.match(/id="([^"]+)"/);
        
        if (textMatch && hrefMatch) {
          const text = textMatch[1].toLowerCase();
          if (text.includes('catalog') || text.includes('parts') || text.includes('search')) {
            links.push({
              text: textMatch[1],
              href: hrefMatch[1],
              selector: idMatch ? `#${idMatch[1]}` : `a[href="${hrefMatch[1]}"]`
            });
          }
        }
      }
    });
    
    return links;
  }

  async executeAIAction(decision, tabId) {
    try {
      this.broadcastLog(`Executing action: ${decision.action.type}`);
      
      // Send action to content script
      await chrome.tabs.sendMessage(tabId, {
        action: 'executeAction',
        data: decision.action
      });
      
    } catch (error) {
      console.error('Error executing AI action:', error);
      this.broadcastError('Failed to execute action: ' + error.message);
    }
  }

  async handleActionCompleted(data, tabId) {
    try {
      this.broadcastLog(`Action completed: ${data.action || 'unknown'}`);
      
      // Wait a moment for page to load, then continue scraping
      setTimeout(async () => {
        if (this.isScrapingActive) {
          await chrome.tabs.sendMessage(tabId, {
            action: 'continueScraping'
          });
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error handling action completion:', error);
    }
  }

  async completeScraping(reason) {
    try {
      this.isScrapingActive = false;
      await chrome.storage.local.set({ isScrapingActive: false });
      
      const duration = Date.now() - this.scrapingData.startTime;
      const durationStr = Math.round(duration / 1000) + 's';
      
      this.broadcastLog(`Scraping completed: ${reason}`);
      this.broadcastLog(`Duration: ${durationStr}, Steps: ${this.scrapingData.currentStep}`);
      this.broadcastLog(`Parts found: ${this.scrapingData.foundParts.length}`);
      
      // Broadcast completion
      chrome.runtime.sendMessage({
        action: 'scrapingComplete',
        data: {
          reason: reason,
          foundParts: this.scrapingData.foundParts,
          steps: this.scrapingData.currentStep,
          duration: durationStr
        }
      });
      
    } catch (error) {
      console.error('Error completing scraping:', error);
    }
  }

  broadcastLog(message) {
    console.log('[AI Scraper]', message);
    
    // Send to popup
    chrome.runtime.sendMessage({
      action: 'updateLog',
      data: message
    }).catch(() => {
      // Popup might be closed, ignore error
    });
  }

  broadcastError(message) {
    console.error('[AI Scraper]', message);
    
    // Send to popup
    chrome.runtime.sendMessage({
      action: 'scrapingError',
      data: message
    }).catch(() => {
      // Popup might be closed, ignore error
    });
  }
}

// Initialize the orchestrator
const orchestrator = new AIScrapingOrchestrator();

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('PartsLink AI Scraper service worker started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('PartsLink AI Scraper extension installed');
});