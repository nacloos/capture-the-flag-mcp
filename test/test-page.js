#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const kill = require('tree-kill');

// Get folder name from command line argument
const folderName = process.argv[2];
if (!folderName) {
  console.error('Usage: node test-page.js <folder-name>');
  process.exit(1);
}

// Read runners.json configuration
const runnersPath = path.join(process.cwd(), 'src/runners.json');
let runners;
try {
  runners = JSON.parse(fs.readFileSync(runnersPath, 'utf8'));
} catch (error) {
  console.error('Error reading runners.json:', error.message);
  process.exit(1);
}

const config = runners[folderName];
if (!config) {
  console.error(`No configuration found for "${folderName}" in runners.json`);
  process.exit(1);
}

console.log(`Testing web page: ${folderName}`);
console.log(`Command: ${config.command}`);
console.log(`Port: ${config.port}`);

async function testWebPage() {
  let serverProcess;
  let browser;
  let exitCode = 0;
  
  try {
    // Import playwright
    const { chromium } = require('playwright');
    
    // Start server process
    console.log('Starting server...');
    const folderPath = path.join(process.cwd(), 'src', folderName);
    const [command, ...args] = config.command.split(' ');
    
    serverProcess = spawn(command, args, {
      cwd: folderPath,
      stdio: 'pipe'
    });
    
    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);
      
      serverProcess.stdout.on('data', (data) => {
        console.log('Server:', data.toString().trim());
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.log('Server error:', data.toString().trim());
      });
      
      // Simple port check
      const checkPort = () => {
        const net = require('net');
        const socket = new net.Socket();
        
        socket.setTimeout(1000);
        socket.on('connect', () => {
          socket.destroy();
          clearTimeout(timeout);
          resolve();
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          setTimeout(checkPort, 500);
        });
        
        socket.on('error', () => {
          setTimeout(checkPort, 500);
        });
        
        socket.connect(config.port, 'localhost');
      };
      
      setTimeout(checkPort, 2000);
    });
    
    console.log('Server started successfully');
    
    // Launch browser
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Track console errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate to page
    const url = `http://localhost:${config.port}`;
    console.log(`Loading page: ${url}`);
    
    const startTime = Date.now();
    await page.goto(url, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    // Take screenshot
    const screenshotPath = path.join(process.cwd(), 'test', `${folderName}-screenshot.png`);
    await page.screenshot({ path: screenshotPath });
    
    // Wait a bit for any dynamic content
    await page.waitForTimeout(2000);
    
    // Results
    console.log('\nTest Results:');
    console.log(`Page loaded successfully`);
    console.log(`Screenshot saved: ${screenshotPath}`);
    console.log(`Load time: ${loadTime}ms`);
    
    if (consoleErrors.length > 0) {
      console.log('JavaScript errors found:');
      consoleErrors.forEach(error => console.log(`   - ${error}`));
      exitCode = 1;
    } else {
      console.log('No JavaScript errors');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    exitCode = 1;
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      kill(serverProcess.pid);
      // Wait a bit for the process to be killed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  process.exit(exitCode);
}

testWebPage();