const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const kill = require('tree-kill');
const killPort = require('kill-port');

const app = express();
const PORT = 3001;

// Store running processes and their logs
const runningProcesses = new Map();
const processLogs = new Map(); // Persistent logs even after process ends
const gameEvents = new Map(); // Structured game events

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
const LOG_DIR = path.join(__dirname, '../../../logs');

// Ensure log directory exists for a folder
function ensureLogDir(folderName) {
  const folderLogDir = path.join(LOG_DIR, folderName);
  if (!fs.existsSync(folderLogDir)) {
    fs.mkdirSync(folderLogDir, { recursive: true });
  }
  return folderLogDir;
}

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

// Execute setup commands sequentially
async function executeSetupCommands(commands, cwd, env) {
  for (let i = 0; i < commands.length - 1; i++) {
    const { command, args } = parseCommand(commands[i]);
    
    const result = await new Promise((resolve, reject) => {
      const process = spawn(command, args, { cwd, env });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Setup command "${commands[i]}" failed with code ${code}`));
        }
      });
      
      process.on('error', reject);
    });
  }
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
  
  // Handle both string and array commands
  const commands = Array.isArray(config.command) ? config.command : [config.command];
  const mainCommand = commands[commands.length - 1];
  const { command, args } = parseCommand(mainCommand);
  
  return {
    commands,
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
app.post('/api/start/:name', async (req, res) => {
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
    
    // Free the port if it's already in use
    await killPort(runConfig.port).catch(() => {}); // Ignore errors
    
    // Run setup commands if there are multiple commands
    if (runConfig.commands.length > 1) {
      await executeSetupCommands(runConfig.commands, runConfig.cwd, env);
    }
    
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
      
      // Parse game events
      if (log.includes('[GAME_EVENT]')) {
        try {
          const eventJson = log.split('[GAME_EVENT]')[1].trim();
          const event = JSON.parse(eventJson);
          
          if (!gameEvents.has(name)) {
            gameEvents.set(name, []);
          }
          const events = gameEvents.get(name);
          events.push(event);
          
          // Keep only last 100 events
          if (events.length > 100) {
            gameEvents.set(name, events.slice(-100));
          }
          
          // Write to file
          const logDir = ensureLogDir(name);
          const logFile = path.join(logDir, 'game-events.jsonl');
          const logEntry = JSON.stringify({
            timestamp: new Date().toISOString(),
            folder: name,
            event: event
          }) + '\n';
          fs.appendFileSync(logFile, logEntry);
        } catch (error) {
          console.error('Failed to parse game event:', error);
        }
      }
      
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
    kill(processInfo.process.pid);
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

// POST /api/game-event - Receive game event from browser
app.post('/api/game-event', (req, res) => {
  try {
    const { folder, event } = req.body;
    const folderName = folder || 'browser-game';
    
    // Store in memory
    if (!gameEvents.has(folderName)) {
      gameEvents.set(folderName, []);
    }
    
    const events = gameEvents.get(folderName);
    events.push(event);
    
    // Keep only last 100 events
    if (events.length > 100) {
      gameEvents.set(folderName, events.slice(-100));
    }
    
    // Save to file
    const logDir = ensureLogDir(folderName);
    const logFile = path.join(logDir, 'game-events.jsonl');
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      folder: folderName,
      event: event
    }) + '\n';
    fs.appendFileSync(logFile, logEntry);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to store game event:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events - Get all game events from all processes
app.get('/api/events', (req, res) => {
  const allEvents = [];
  
  // Collect events from all processes
  for (const [folderName, events] of gameEvents.entries()) {
    for (const event of events) {
      allEvents.push({
        ...event,
        folder: folderName
      });
    }
  }
  
  // Sort by timestamp
  allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  res.json({ events: allEvents });
});

// DELETE /api/delete/:name - Delete a folder and update runners.json
app.delete('/api/delete/:name', (req, res) => {
  const { name } = req.params;
  
  const folderPath = path.join(SRC_PATH, name);
  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  
  try {
    // Stop process if it's running
    const processInfo = runningProcesses.get(name);
    if (processInfo) {
      kill(processInfo.process.pid);
      runningProcesses.delete(name);
    }
    
    // Remove folder from filesystem
    fs.rmSync(folderPath, { recursive: true, force: true });
    
    // Update runners.json
    const runnersConfig = loadRunnersConfig();
    if (runnersConfig[name]) {
      delete runnersConfig[name];
      fs.writeFileSync(RUNNERS_CONFIG_PATH, JSON.stringify(runnersConfig, null, 2));
    }
    
    // Clean up logs
    processLogs.delete(name);
    
    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  
  watcher.on('unlinkDir', (folderPath) => {
    console.log('Folder removed:', folderPath);
    const folderName = path.basename(folderPath);
    // Stop process if it was running
    const processInfo = runningProcesses.get(folderName);
    if (processInfo) {
      kill(processInfo.process.pid);
      runningProcesses.delete(folderName);
    }
  });
}

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Stopping all running processes...');
  for (const [name, processInfo] of runningProcesses) {
    kill(processInfo.process.pid);
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Watching for folders in: ${SRC_PATH}`);
});