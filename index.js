const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));


app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Screenshot service is running' });
});


app.get('/', (req, res) => {
  res.json({ 
    message: 'Screenshot API Service',
    endpoints: {
      'GET /health': 'Health check',
      'POST /api/screenshot': 'Take screenshot by URL',
      'POST /api/screenshot-current': 'Take screenshot of HTML content'
    }
  });
});


app.post('/api/screenshot', async (req, res) => {
  let browser;
  
  try {
    const { url, width = 1200, height = 800, fullPage = true } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL is required',
        message: 'Please provide a URL to capture screenshot'
      });
    }


    try {
      new URL(url);
    } catch (urlError) {
      return res.status(400).json({ 
        error: 'Invalid URL format',
        message: 'Please provide a valid URL'
      });
    }

    console.log(`Taking screenshot of: ${url}`);


    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    
 
    await page.setViewport({
      width: parseInt(width),
      height: parseInt(height),
      deviceScaleFactor: 1,
    });


    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    
    await page.goto(url, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 60000  
    });

    
    await page.waitForTimeout(2000);

    
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: fullPage,
      encoding: 'binary'  
    });

    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;

   
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': screenshot.length
    });

    
    res.send(screenshot);

    console.log(`Screenshot captured successfully: ${filename}`);

  } catch (error) {
    console.error('Screenshot error:', error);
    
    
    if (error.name === 'TimeoutError') {
      res.status(408).json({
        error: 'Request timeout',
        message: 'The page took too long to load'
      });
    } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      res.status(400).json({
        error: 'Invalid URL',
        message: 'Could not resolve the provided URL'
      });
    } else if (error.message.includes('Navigation failed because browser has disconnected')) {
      res.status(500).json({
        error: 'Browser disconnected',
        message: 'The browser instance disconnected unexpectedly'
      });
    } else {
      res.status(500).json({
        error: 'Screenshot failed',
        message: 'An error occurred while taking the screenshot',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } finally {
   
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
});


app.post('/api/screenshot-current', async (req, res) => {
  let browser;
  
  try {
    const { html, css, width = 1200, height = 800, fullPage = true } = req.body;
    
    if (!html) {
      return res.status(400).json({ 
        error: 'HTML content is required',
        message: 'Please provide HTML content to capture'
      });
    }

    console.log('Taking screenshot of provided HTML content');

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    
    await page.setViewport({
      width: parseInt(width),
      height: parseInt(height),
      deviceScaleFactor: 1,
    });

    
    let fullHtml = html;
    
   
    if (css) {
      if (fullHtml.includes('</head>')) {
        fullHtml = fullHtml.replace('</head>', `<style>${css}</style></head>`);
      } else if (fullHtml.includes('<head>')) {
        fullHtml = fullHtml.replace('<head>', `<head><style>${css}</style>`);
      } else {
        fullHtml = `<html><head><style>${css}</style></head><body>${fullHtml}</body></html>`;
      }
    }

    
    if (!fullHtml.includes('<html')) {
      fullHtml = `<html><head><meta charset="utf-8"></head><body>${fullHtml}</body></html>`;
    }

    await page.setContent(fullHtml, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });

    
    await page.waitForTimeout(1500);

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: fullPage,
      encoding: 'binary' 
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `infographic-screenshot-${timestamp}.png`;

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': screenshot.length
    });

    res.send(screenshot);

    console.log(`HTML screenshot captured successfully: ${filename}`);

  } catch (error) {
    console.error('HTML screenshot error:', error);
    res.status(500).json({
      error: 'Screenshot failed',
      message: 'An error occurred while taking the screenshot',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
});


app.listen(PORT, () => {
  console.log(`Screenshot service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});