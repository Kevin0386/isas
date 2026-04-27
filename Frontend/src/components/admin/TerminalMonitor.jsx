import React, { useState, useEffect, useRef } from 'react';
import socketService from '../../socket';

export default function TerminalMonitor() {
  const [output, setOutput] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const outputRef = useRef(null);
  let nextId = 0;

  const generateId = () => {
    return Date.now() * 1000 + (nextId++ % 1000);
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (user?.role !== 'admin') {
      console.log('Not admin, skipping terminal monitor');
      return;
    }

    const token = localStorage.getItem('token');
    if (!socketService.isConnected()) {
      socketService.connect(token);
    }

    const handleTerminalOutput = (data) => {
      const lines = data.data.split('\n');
      const newEntries = [];
      
      for (const line of lines) {
        if (line && line.trim()) {
          newEntries.push({
            id: generateId(),
            timestamp: new Date().toISOString(),
            type: data.type,
            content: line
          });
        }
      }
      
      if (newEntries.length > 0) {
        setOutput(prev => {
          const updated = [...prev, ...newEntries];
          return updated.slice(-2000);
        });
      }
    };

    const handleLogOutput = (data) => {
      const levelIcons = {
        'ERROR': '🔴',
        'WARNING': '🟡',
        'INFO': '🟢',
        'DEBUG': '🔵'
      };
      const icon = levelIcons[data.level] || '⚪';
      const line = `${icon} [${data.level}] ${data.logger}: ${data.message}`;
      
      setOutput(prev => {
        const updated = [...prev, {
          id: generateId(),
          timestamp: data.timestamp,
          type: 'log',
          level: data.level,
          content: line
        }];
        return updated.slice(-2000);
      });
    };

    const handleTerminalConnected = (data) => {
      setIsConnected(true);
      // Don't trust data.capturing here — request authoritative status from server
      // socket.jsx now emits get_capture_status on connect, which triggers capture_status event
      console.log('Terminal connected, requesting capture status...');
      setOutput(prev => [...prev, {
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: 'system',
        content: `✅ Connected to terminal monitor. Checking capture status...`
      }]);
    };

    const handleCaptureStarted = () => {
      console.log('Capture started event received');
      setIsCapturing(true);
      setOutput(prev => [...prev, {
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: 'system',
        content: '🔴 Terminal capture started - All output will be displayed here'
      }]);
    };

    const handleCaptureStopped = () => {
      console.log('Capture stopped event received');
      setIsCapturing(false);
      setOutput(prev => [...prev, {
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: 'system',
        content: '🟢 Terminal capture stopped'
      }]);
    };

    const handleCaptureStatus = (data) => {
      console.log('Capture status received:', data);
      setIsCapturing(data.capturing);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setOutput(prev => [...prev, {
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: 'system',
        content: '❌ Disconnected from terminal monitor'
      }]);
    };

    socketService.on('terminal_output', handleTerminalOutput);
    socketService.on('log_output', handleLogOutput);
    socketService.on('terminal_connected', handleTerminalConnected);
    socketService.on('capture_started', handleCaptureStarted);
    socketService.on('capture_stopped', handleCaptureStopped);
    socketService.on('capture_status', handleCaptureStatus);
    socketService.on('terminal_disconnected', handleDisconnected);

    // Request initial status — retry until terminal socket is connected
    const requestStatus = (attempts = 0) => {
      if (socketService.isTerminalConnected()) {
        socketService.getTerminalCaptureStatus();
      } else if (attempts < 10) {
        setTimeout(() => requestStatus(attempts + 1), 500);
      }
    };
    requestStatus();

    return () => {
      socketService.off('terminal_output', handleTerminalOutput);
      socketService.off('log_output', handleLogOutput);
      socketService.off('terminal_connected', handleTerminalConnected);
      socketService.off('capture_started', handleCaptureStarted);
      socketService.off('capture_stopped', handleCaptureStopped);
      socketService.off('capture_status', handleCaptureStatus);
      socketService.off('terminal_disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  const clearOutput = () => {
    setOutput([]);
  };

  const startCapture = () => {
    console.log('Starting terminal capture...');
    socketService.startTerminalCapture();
    // Optimistically update UI
    setIsCapturing(true);
  };

  const stopCapture = () => {
    console.log('Stopping terminal capture...');
    socketService.stopTerminalCapture();
    // Optimistically update UI
    setIsCapturing(false);
  };

  const getOutputColor = (item) => {
    if (item.type === 'stderr') return 'text-red-400';
    if (item.type === 'system') return 'text-blue-400';
    if (item.type === 'log') {
      if (item.level === 'ERROR') return 'text-red-400';
      if (item.level === 'WARNING') return 'text-yellow-400';
      if (item.level === 'INFO') return 'text-green-400';
    }
    return 'text-gray-300';
  };

  const getOutputPrefix = (item) => {
    if (item.type === 'stdout') return '📝';
    if (item.type === 'stderr') return '⚠️';
    if (item.type === 'system') return '🔧';
    if (item.type === 'log') return '📋';
    return '•';
  };

  const filteredOutput = output.filter(item => {
    if (filter !== 'ALL' && item.type !== filter) return false;
    if (searchTerm && !item.content.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: filteredOutput.length,
    stdout: filteredOutput.filter(o => o.type === 'stdout').length,
    stderr: filteredOutput.filter(o => o.type === 'stderr').length,
    system: filteredOutput.filter(o => o.type === 'system').length,
    logs: filteredOutput.filter(o => o.type === 'log').length
  };

  return (
    <div className="space-y-4">
      {/* Header with always visible Start/Stop buttons */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-mono text-sm font-bold">Terminal Monitor</span>
            {isCapturing && (
              <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded text-xs font-mono animate-pulse">
                🔴 CAPTURING
              </span>
            )}
            {!isCapturing && isConnected && (
              <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded text-xs font-mono">
                ⚪ IDLE
              </span>
            )}
          </div>
          
          {/* ALWAYS VISIBLE BUTTONS */}
          <div className="flex gap-2">
            {!isCapturing ? (
              <button 
                onClick={startCapture} 
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <i className="fas fa-play mr-2"></i>
                Start Capture
              </button>
            ) : (
              <button 
                onClick={stopCapture} 
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <i className="fas fa-stop mr-2"></i>
                Stop Capture
              </button>
            )}
            <button 
              onClick={clearOutput} 
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <i className="fas fa-trash-alt mr-2"></i>
              Clear
            </button>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex gap-4 mt-3 text-xs text-gray-400 flex-wrap">
          <span>📊 Total: {stats.total}</span>
          <span className="text-green-400">📝 stdout: {stats.stdout}</span>
          <span className="text-red-400">⚠️ stderr: {stats.stderr}</span>
          <span className="text-blue-400">🔧 system: {stats.system}</span>
          <span className="text-purple-400">📋 logs: {stats.logs}</span>
          <span className={isCapturing ? 'text-green-400' : 'text-gray-500'}>
            {isCapturing ? '● LIVE CAPTURE ACTIVE' : '○ CAPTURE IDLE'}
          </span>
          <span className="text-gray-500">
            🔌 {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => setFilter('ALL')} className={`text-xs px-2 py-1 rounded ${filter === 'ALL' ? 'bg-primary text-white' : 'bg-gray-800 text-gray-400'}`}>
            ALL ({stats.total})
          </button>
          <button onClick={() => setFilter('stdout')} className={`text-xs px-2 py-1 rounded ${filter === 'stdout' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            stdout ({stats.stdout})
          </button>
          <button onClick={() => setFilter('stderr')} className={`text-xs px-2 py-1 rounded ${filter === 'stderr' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            stderr ({stats.stderr})
          </button>
          <button onClick={() => setFilter('system')} className={`text-xs px-2 py-1 rounded ${filter === 'system' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            system ({stats.system})
          </button>
          <button onClick={() => setFilter('log')} className={`text-xs px-2 py-1 rounded ${filter === 'log' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            logs ({stats.logs})
          </button>
          
          <div className="flex-1" />
          
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white w-40"
          />
          <button onClick={() => setAutoScroll(!autoScroll)} className={`text-xs px-2 py-1 rounded ${autoScroll ? 'bg-blue-600' : 'bg-gray-700'}`}>
            {autoScroll ? '📌 Auto-scroll ON' : 'Auto-scroll OFF'}
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={outputRef}
        className="bg-black rounded-lg border border-gray-700 h-96 overflow-y-auto font-mono text-sm"
        style={{ fontFamily: 'Consolas, "Courier New", monospace' }}
      >
        {filteredOutput.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <i className="fas fa-terminal text-4xl mb-2 opacity-50 block"></i>
            <p>No terminal output yet</p>
            <p className="text-xs mt-2">Click <span className="text-green-500 font-bold">"Start Capture"</span> to begin capturing terminal output</p>
            <p className="text-xs text-gray-600 mt-4">When capture is active, everything that appears in your backend terminal will appear here in real-time</p>
          </div>
        ) : (
          filteredOutput.map((item) => (
            <div key={item.id} className="border-b border-gray-800 hover:bg-gray-900 px-3 py-1">
              <span className="text-gray-600 text-xs mr-2">
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-gray-500 text-xs mr-1">
                {getOutputPrefix(item)}
              </span>
              <span className={`text-xs ${getOutputColor(item)} whitespace-pre-wrap break-all`}>
                {item.content}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-3">
        <p className="text-xs text-gray-500">
          💡 <span className="text-yellow-400">How to use:</span>
        </p>
        <div className="text-xs text-gray-500 mt-1">
          <span>• Click <span className="text-green-500 font-bold">"Start Capture"</span> to begin capturing terminal output</span><br />
          <span>• Click <span className="text-red-500 font-bold">"Stop Capture"</span> to stop capturing</span><br />
          <span>• Everything that appears in your backend terminal will appear here in real-time</span>
        </div>
      </div>
    </div>
  );
}