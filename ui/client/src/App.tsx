import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square, Loader2, AlertCircle, Terminal, Trash2 } from "lucide-react";

interface Folder {
  name: string;
  path: string;
  port: number | null;
  type: string;
  isRunning: boolean;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  error?: string;
}

interface LogEntry {
  type: 'stdout' | 'stderr';
  message: string;
  timestamp: string;
  folder?: string;
}

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [runningFolder, setRunningFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch folders on component mount and set up polling
  useEffect(() => {
    fetchFolders();
    
    // Poll for folder changes every 2 seconds
    const interval = setInterval(() => {
      fetchFolders();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh logs for console
  useEffect(() => {
    if (consoleOpen) {
      fetchAllLogs();
      const interval = setInterval(() => {
        fetchAllLogs();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [consoleOpen]);

  const fetchFolders = async () => {
    try {
      const response = await fetch(`${API_BASE}/scan`);
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/logs`);
      if (response.ok) {
        const data = await response.json();
        setAllLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const toggleConsole = () => {
    setConsoleOpen(!consoleOpen);
    if (!consoleOpen) {
      fetchAllLogs();
    }
  };

  const handleStart = async (folderName: string) => {
    // Update UI immediately
    setFolders(prev => prev.map(folder => 
      folder.name === folderName 
        ? { ...folder, status: 'starting' }
        : folder
    ));

    try {
      const response = await fetch(`${API_BASE}/start/${folderName}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setRunningFolder(folderName);
        // Refresh folder status
        setTimeout(fetchFolders, 1000);
      } else {
        const error = await response.json();
        console.error('Failed to start:', error);
        // Reset status on error
        setFolders(prev => prev.map(folder => 
          folder.name === folderName 
            ? { ...folder, status: 'stopped' }
            : folder
        ));
      }
    } catch (error) {
      console.error('Failed to start folder:', error);
      setFolders(prev => prev.map(folder => 
        folder.name === folderName 
          ? { ...folder, status: 'stopped' }
          : folder
      ));
    }
  };

  const handleStop = async (folderName: string) => {
    setFolders(prev => prev.map(folder => 
      folder.name === folderName 
        ? { ...folder, status: 'stopping' }
        : folder
    ));

    try {
      const response = await fetch(`${API_BASE}/stop/${folderName}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        if (runningFolder === folderName) {
          setRunningFolder(null);
        }
        setTimeout(fetchFolders, 500);
      } else {
        const error = await response.json();
        console.error('Failed to stop:', error);
      }
    } catch (error) {
      console.error('Failed to stop folder:', error);
    }
  };

  const handleDelete = async (folderName: string) => {
    try {
      const response = await fetch(`${API_BASE}/delete/${folderName}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        if (runningFolder === folderName) {
          setRunningFolder(null);
        }
        if (selectedFolder === folderName) {
          setSelectedFolder(null);
        }
        setShowDeleteConfirm(false);
        setTimeout(fetchFolders, 500);
      } else {
        const error = await response.json();
        console.error('Failed to delete:', error);
        alert(`Failed to delete folder: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert('Failed to delete folder. Please try again.');
    }
  };

  const getButtonIcon = (folder: Folder) => {
    switch (folder.status) {
      case 'starting':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'stopping':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'running':
        return <Square className="w-3 h-3" />;
      case 'error':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Play className="w-3 h-3" />;
    }
  };

  const getButtonAction = (folder: Folder) => {
    if (folder.status === 'error') {
      return () => {}; // No action for error state
    } else if (folder.status === 'running') {
      return () => handleStop(folder.name);
    } else {
      return () => handleStart(folder.name);
    }
  };

  const isButtonDisabled = (folder: Folder) => {
    return folder.status === 'starting' || folder.status === 'stopping' || folder.status === 'error';
  };

  const runningFolderData = folders.find(f => f.name === runningFolder);
  const selectedFolderData = folders.find(f => f.name === selectedFolder);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel */}
      <div 
        className="w-64 border-r border-gray-200 p-3"
        onClick={(e) => {
          // If clicking on the panel background (not on a folder or button), unselect
          if (e.target === e.currentTarget) {
            setSelectedFolder(null);
            setShowDeleteConfirm(false);
          }
        }}
      >
        {/* Seamless Menu Bar */}
        <div className="flex justify-center gap-2 mb-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleConsole}
            className="h-6 w-6 p-0"
          >
            <Terminal className="w-4 h-4" />
          </Button>
          
          {/* Delete button with inline confirmation */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => selectedFolder && setShowDeleteConfirm(true)}
              disabled={!selectedFolder}
              className="h-6 w-6 p-0"
              title="Delete selected folder"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
            {showDeleteConfirm && (
              <div className="absolute top-7 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-white border border-gray-200 rounded-md p-1 shadow-sm z-10">
                <span className="text-xs text-red-600 whitespace-nowrap">Delete folder?</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => selectedFolder && handleDelete(selectedFolder)}
                  className="h-5 w-5 p-0 text-xs"
                  title="Confirm delete"
                >
                  ✓
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="h-5 w-5 p-0"
                  title="Cancel"
                >
                  ×
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Folder List */}
        <div className="space-y-0">
          {folders.length === 0 ? (
            <p className="text-gray-400 text-sm">No runnable folders found</p>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.name}
                className={`flex items-center justify-between py-0.5 px-1 cursor-pointer transition-colors rounded ${
                  selectedFolder === folder.name
                    ? 'bg-gray-100'
                    : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                  if (selectedFolder === folder.name) {
                    setSelectedFolder(null);
                  } else {
                    setSelectedFolder(folder.name);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{folder.name}</div>
                  {folder.status === 'error' && (
                    <div className="text-xs text-red-500" title={folder.error}>
                      Configuration error
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    getButtonAction(folder)();
                  }}
                  disabled={isButtonDisabled(folder)}
                  className={`h-6 w-6 p-0 ${folder.status === 'error' ? 'text-red-500' : ''}`}
                  title={folder.status === 'error' ? folder.error : ''}
                >
                  {getButtonIcon(folder)}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col">
        {/* Main Content Area */}
        <div className={`flex-1 ${consoleOpen ? 'h-3/5' : 'h-full'}`}>
          {selectedFolder && selectedFolderData?.status === 'running' ? (
            <iframe
              src={`http://localhost:${selectedFolderData.port}`}
              className="w-full h-full"
              title={selectedFolder}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">
                {selectedFolder 
                  ? selectedFolderData?.status === 'starting' 
                    ? 'Starting...'
                    : 'Click play to run this folder'
                  : 'Select a folder to view'
                }
              </p>
            </div>
          )}
        </div>

        {/* Console Panel */}
        {consoleOpen && (
          <div className="h-2/5 border-t border-gray-200 bg-white flex flex-col">
            <div className="px-3 py-2 border-b border-gray-200">
              <h3 className="text-xs font-medium">Console</h3>
            </div>
            <div className="flex-1 px-3 py-2 overflow-y-auto">
              <div className="font-mono text-xs leading-tight">
                {allLogs.length > 0 ? (
                  allLogs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`${log.type === 'stderr' ? 'text-red-600' : 'text-gray-700'}`}
                    >
                      {log.folder && <span className="text-blue-600">[{log.folder}]</span>} {log.message.trim()}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400">No logs available</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
