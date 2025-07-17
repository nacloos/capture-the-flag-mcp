const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const chokidar = require('chokidar');

const app = express();
const PORT = 3001;

// Store running processes and their logs
const runningProcesses = new Map();
const processLogs = new Map(); // Persistent logs even after process ends

app.use(cors());
app.use(express.json());

// Handle root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'UI Server API',
    endpoints: {
      'GET /api/scan': 'List all runnable folders',
      'POST /api/start/:name': 'Start a folder\'s server',
      'POST /api/stop/:name': 'Stop a folder\'s server',
      'GET /api/status/:name': 'Check folder status',
      'GET /api/logs/:name': 'Get folder logs'
    }
  });
});

// Handle favicon requests
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Path to the src directory containing runnable folders
const SRC_PATH = path.resolve(__dirname, '../../../src');
const RUNNERS_CONFIG_PATH = path.join(SRC_PATH, 'runners.json');

// Load runners configuration
function loadRunnersConfig() {
  try {
    if (fs.existsSync(RUNNERS_CONFIG_PATH)) {
      const configData = fs.readFileSync(RUNNERS_CONFIG_PATH, 'utf8');
      return JSON.parse(configData);
    }
    return {};
  } catch (error) {
    console.error('Error loading runners.json:', error);
    return {};
  }
}

// Parse command string into command and args
function parseCommand(commandString) {
  const parts = commandString.trim().split(/\s+/);
  return {
    command: parts[0],
    args: parts.slice(1)
  };
}

// Get run configuration for a folder
function getRunConfig(folderName, folderPath) {
  const runnersConfig = loadRunnersConfig();
  const config = runnersConfig[folderName];
  
  if (!config) {
    return {
      error: `No configuration found for "${folderName}" in runners.json`
    };
  }
  
  if (!config.command) {
    return {
      error: `No command specified for "${folderName}" in runners.json`
    };
  }
  
  if (!config.port) {
    return {
      error: `No port specified for "${folderName}" in runners.json`
    };
  }
  
  const { command, args } = parseCommand(config.command);
  
  return {
    command,
    args,
    cwd: folderPath,
    port: config.port,
    env: config.env || {},
    type: 'configured'
  };
}

// Scan for runnable folders
function scanFolders() {
  if (!fs.existsSync(SRC_PATH)) {
    return [];
  }
  
  const folders = [];
  const items = fs.readdirSync(SRC_PATH);
  
  for (const item of items) {
    // Skip the runners.json file itself
    if (item === 'runners.json') continue;
    
    const itemPath = path.join(SRC_PATH, item);
    if (fs.statSync(itemPath).isDirectory()) {
      const runConfig = getRunConfig(item, itemPath);
      const isRunning = runningProcesses.has(item);
      
      if (runConfig.error) {
        // Folder exists but has no valid config
        folders.push({
          name: item,
          path: itemPath,
          port: null,
          type: 'error',
          error: runConfig.error,
          isRunning: false,
          status: 'error'
        });
      } else {
        // Valid configuration found
        folders.push({
          name: item,
          path: itemPath,
          port: runConfig.port,
          type: runConfig.type,
          command: runConfig.command,
          args: runConfig.args,
          env: runConfig.env,
          isRunning,
          status: isRunning ? 'running' : 'stopped'
        });
      }
    }
  }
  
  return folders;
}

// API Endpoints

// GET /api/scan - List all runnable folders
app.get('/api/scan', (req, res) => {
  try {
    const folders = scanFolders();
    res.json({ folders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/start/:name - Start a folder's server
app.post('/api/start/:name', (req, res) => {
  const { name } = req.params;
  
  if (runningProcesses.has(name)) {
    return res.status(400).json({ error: 'Already running' });
  }
  
  const folderPath = path.join(SRC_PATH, name);
  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  
  const runConfig = getRunConfig(name, folderPath);
  if (runConfig.error) {
    return res.status(400).json({ error: runConfig.error });
  }
  
  try {
    // Merge environment variables
    const env = { ...process.env, ...runConfig.env };
    
    const childProcess = spawn(runConfig.command, runConfig.args, {
      cwd: runConfig.cwd,
      env: env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Initialize persistent logs for this process
    if (!processLogs.has(name)) {
      processLogs.set(name, []);
    }
    
    // Store process info
    runningProcesses.set(name, {
      process: childProcess,
      port: runConfig.port,
      startTime: new Date()
    });
    
    // Handle process output
    childProcess.stdout.on('data', (data) => {
      const log = data.toString();
      const logs = processLogs.get(name);
      if (logs) {
        logs.push({ type: 'stdout', message: log, timestamp: new Date() });
        // Keep only last 100 logs
        if (logs.length > 100) {
          processLogs.set(name, logs.slice(-100));
        }
      }
    });
    
    childProcess.stderr.on('data', (data) => {
      const log = data.toString();
      const logs = processLogs.get(name);
      if (logs) {
        logs.push({ type: 'stderr', message: log, timestamp: new Date() });
        // Keep only last 100 logs
        if (logs.length > 100) {
          processLogs.set(name, logs.slice(-100));
        }
      }
    });
    
    childProcess.on('close', (code) => {
      console.log(`Process ${name} exited with code ${code}`);
      const logs = processLogs.get(name);
      if (logs) {
        // Add exit message to persistent logs
        logs.push({ 
          type: code === 0 ? 'stdout' : 'stderr', 
          message: `Process exited with code ${code}`, 
          timestamp: new Date() 
        });
        if (logs.length > 100) {
          processLogs.set(name, logs.slice(-100));
        }
      }
      runningProcesses.delete(name);
    });
    
    childProcess.on('error', (error) => {
      console.error(`Process ${name} error:`, error);
      const logs = processLogs.get(name);
      if (logs) {
        // Add error message to persistent logs
        logs.push({ 
          type: 'stderr', 
          message: `Process error: ${error.message}`, 
          timestamp: new Date() 
        });
        if (logs.length > 100) {
          processLogs.set(name, logs.slice(-100));
        }
      }
      runningProcesses.delete(name);
    });
    
    res.json({ 
      message: 'Started successfully', 
      port: runConfig.port,
      pid: childProcess.pid 
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stop/:name - Stop a folder's server
app.post('/api/stop/:name', (req, res) => {
  const { name } = req.params;
  
  const processInfo = runningProcesses.get(name);
  if (!processInfo) {
    return res.status(404).json({ error: 'Process not found or not running' });
  }
  
  try {
    processInfo.process.kill('SIGTERM');
    runningProcesses.delete(name);
    res.json({ message: 'Stopped successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/status/:name - Check if folder is running
app.get('/api/status/:name', (req, res) => {
  const { name } = req.params;
  const processInfo = runningProcesses.get(name);
  
  if (processInfo) {
    res.json({
      status: 'running',
      port: processInfo.port,
      pid: processInfo.process.pid,
      startTime: processInfo.startTime,
      logs: processInfo.logs.slice(-10) // Last 10 logs
    });
  } else {
    res.json({ status: 'stopped' });
  }
});

// GET /api/logs/:name - Get logs for a process (running or stopped)
app.get('/api/logs/:name', (req, res) => {
  const { name } = req.params;
  const logs = processLogs.get(name);
  
  if (logs) {
    res.json({ logs });
  } else {
    res.json({ logs: [] }); // Return empty array instead of error
  }
});

// GET /api/logs - Get all logs from all processes
app.get('/api/logs', (req, res) => {
  const allLogs = [];
  
  // Collect logs from all processes
  for (const [folderName, logs] of processLogs.entries()) {
    for (const log of logs) {
      allLogs.push({
        ...log,
        folder: folderName
      });
    }
  }
  
  // Sort by timestamp
  allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  res.json({ logs: allLogs });
});

// Watch for file system changes
if (fs.existsSync(SRC_PATH)) {
  const watcher = chokidar.watch(SRC_PATH, {
    ignored: /node_modules/,
    ignoreInitial: true,
    depth: 1
  });
  
  watcher.on('addDir', (path) => {
    console.log('New folder detected:', path);
  });
  
  watcher.on('unlinkDir', (path) => {
    console.log('Folder removed:', path);
    const folderName = path.basename(path);
    // Stop process if it was running
    const processInfo = runningProcesses.get(folderName);
    if (processInfo) {
      processInfo.process.kill('SIGTERM');
      runningProcesses.delete(folderName);
    }
  });
}

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Stopping all running processes...');
  for (const [name, processInfo] of runningProcesses) {
    processInfo.process.kill('SIGTERM');
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Watching for folders in: ${SRC_PATH}`);
});