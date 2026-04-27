import React, { useState, useEffect, useRef } from 'react';
import socketService from '../../socket';

export default function ServerLogs() {
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isTailing, setIsTailing] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [serverMetrics, setServerMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState('logs');
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandOutput, setCommandOutput] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const logContainerRef = useRef(null);
  const commandOutputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !socketService.isConnected()) {
      socketService.connect(token);
    }

    // Set up event listeners
    socketService.on('connected', handleConnected);
    socketService.on('disconnected', handleDisconnected);
    socketService.on('log_entry', handleLogEntry);
    socketService.on('server_logs', handleServerLogs);
    socketService.on('subscribed_logs', handleSubscribed);
    socketService.on('unsubscribed_logs', handleUnsubscribed);
    socketService.on('logs_cleared', () => {
      setLogs([]);
      addLog('INFO', 'Logs cleared by administrator');
    });
    socketService.on('log_tail', handleLogTail);
    socketService.on('tail_started', () => setIsTailing(true));
    socketService.on('tail_stopped', () => setIsTailing(false));
    socketService.on('command_output', handleCommandOutput);
    socketService.on('command_started', () => setIsExecuting(true));
    socketService.on('command_complete', () => setIsExecuting(false));
    socketService.on('system_status', handleSystemStatus);
    socketService.on('server_metrics', handleServerMetrics);
    socketService.on('error', (data) => addLog('ERROR', data.message));

    // Subscribe to logs
    if (!isSubscribed) {
      socketService.subscribeToLogs();
    }

    // Request initial data
    socketService.getServerLogs(100);
    socketService.getSystemStatus();
    socketService.getServerMetrics();

    // Auto-refresh metrics every 30 seconds
    const metricsInterval = setInterval(() => {
      if (isConnected) {
        socketService.getServerMetrics();
      }
    }, 30000);

    return () => {
      clearInterval(metricsInterval);
      if (isTailing) {
        socketService.stopTail();
      }
      socketService.off('connected', handleConnected);
      socketService.off('disconnected', handleDisconnected);
      socketService.off('log_entry', handleLogEntry);
      socketService.off('server_logs', handleServerLogs);
      socketService.off('subscribed_logs', handleSubscribed);
      socketService.off('unsubscribed_logs', handleUnsubscribed);
      socketService.off('logs_cleared');
      socketService.off('log_tail', handleLogTail);
      socketService.off('tail_started');
      socketService.off('tail_stopped');
      socketService.off('command_output', handleCommandOutput);
      socketService.off('command_started');
      socketService.off('command_complete');
      socketService.off('system_status', handleSystemStatus);
      socketService.off('server_metrics', handleServerMetrics);
      socketService.unsubscribeFromLogs();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logContainerRef.current && activeTab === 'logs') {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
    if (autoScroll && commandOutputRef.current && activeTab === 'commands') {
      commandOutputRef.current.scrollTop = commandOutputRef.current.scrollHeight;
    }
  }, [logs, commandOutput, autoScroll, activeTab]);

  const handleConnected = () => {
    setIsConnected(true);
    addLog('INFO', 'Connected to real-time server');
    socketService.subscribeToLogs();
  };

  const handleDisconnected = () => {
    setIsConnected(false);
    setIsSubscribed(false);
    addLog('WARNING', 'Disconnected from real-time server');
  };

  const handleLogEntry = (data) => {
    addLog(data.level, data.message, data.timestamp);
  };

  const handleServerLogs = (data) => {
    const parsedLogs = data.logs.map(line => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s+(.+)$/);
      if (match) {
        return { timestamp: match[1], level: match[2], message: match[3] };
      }
      return { timestamp: new Date().toISOString(), level: 'INFO', message: line };
    });
    setLogs(parsedLogs);
  };

  const handleLogTail = (data) => {
    addLog('TAIL', data.line);
  };

  const handleSubscribed = () => {
    setIsSubscribed(true);
    addLog('SUCCESS', 'Subscribed to server logs');
  };

  const handleUnsubscribed = () => {
    setIsSubscribed(false);
    addLog('INFO', 'Unsubscribed from server logs');
  };

  const handleSystemStatus = (data) => {
    setSystemStatus(data);
  };

  const handleServerMetrics = (data) => {
    setServerMetrics(data);
  };

  const handleCommandOutput = (data) => {
    setCommandOutput(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type: data.type,
      line: data.line
    }]);
  };

  const addLog = (level, message, timestamp = null) => {
    const newLog = {
      timestamp: timestamp || new Date().toISOString(),
      level: level,
      message: message
    };
    setLogs(prev => [...prev, newLog].slice(-1000));
  };

  const clearLogs = () => {
    if (window.confirm('Are you sure you want to clear all server logs?')) {
      socketService.clearServerLogs();
    }
  };

  const startTail = () => {
    if (!isTailing) {
      socketService.tailLogs(50);
    }
  };

  const stopTail = () => {
    if (isTailing) {
      socketService.stopTail();
    }
  };

  const executeCommand = (e) => {
    e.preventDefault();
    if (!currentCommand.trim()) return;

    const cmd = currentCommand.trim();
    setCommandHistory(prev => [...prev, cmd]);
    setCommandOutput(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type: 'command',
      line: `$ ${cmd}`
    }]);
    socketService.executeCommand(cmd);
    setCurrentCommand('');
  };

  const refreshLogs = () => {
    socketService.getServerLogs(100);
  };

  const getLevelColor = (level) => {
    const colors = {
      'ERROR': '#f44336',
      'WARNING': '#ff9800',
      'SUCCESS': '#4caf50',
      'ACTIVITY': '#2196f3',
      'STATUS': '#9c27b0',
      'INFO': '#607d8b',
      'DEBUG': '#888888',
      'TAIL': '#00bcd4'
    };
    return colors[level] || '#757575';
  };

  const getLevelIcon = (level) => {
    const icons = {
      'ERROR': '❌',
      'WARNING': '⚠️',
      'SUCCESS': '✅',
      'ACTIVITY': '🔄',
      'STATUS': '📊',
      'INFO': 'ℹ️',
      'TAIL': '📡'
    };
    return icons[level] || '📝';
  };

  const filteredLogs = logs.filter(log => {
    if (filter !== 'ALL' && log.level !== filter) return false;
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getFilterCount = (level) => {
    if (level === 'ALL') return logs.length;
    return logs.filter(log => log.level === level).length;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Connection Status Bar */}
      <div className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm font-mono">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {isSubscribed && (
            <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full">
              🟢 Live Feed Active
            </span>
          )}
          {isTailing && (
            <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-1 rounded-full">
              📡 Tailing Logs
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshLogs}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
          >
            🔄 Refresh
          </button>
          <button
            onClick={clearLogs}
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* System Status Cards */}
      {systemStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400">Active Connections</p>
            <p className="text-xl font-bold text-primary">{systemStatus.active_connections}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400">CPU Usage</p>
            <p className="text-xl font-bold text-primary">{systemStatus.cpu_percent}%</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400">Memory Usage</p>
            <p className="text-xl font-bold text-primary">{systemStatus.memory_percent}%</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400">Disk Usage</p>
            <p className="text-xl font-bold text-primary">{systemStatus.disk_usage}%</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📋 Live Logs
          </button>
          <button
            onClick={() => setActiveTab('commands')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'commands'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            💻 Command Console
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'metrics'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📊 System Metrics
          </button>
        </nav>
      </div>

      {/* Live Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          {/* Filter Bar */}
          <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex flex-wrap gap-2 items-center">
            <div className="flex gap-1">
              {['ALL', 'ERROR', 'WARNING', 'SUCCESS', 'ACTIVITY', 'INFO'].map(level => (
                <button
                  key={level}
                  onClick={() => setFilter(level)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    filter === level 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {level} ({getFilterCount(level)})
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white w-48"
            />
            <button
              onClick={autoScroll ? stopTail : startTail}
              className={`text-xs px-2 py-1 rounded ${
                isTailing ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {isTailing ? '⏹️ Stop Tail' : '▶️ Tail Logs'}
            </button>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-xs px-2 py-1 rounded ${
                autoScroll ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {autoScroll ? '📌 Auto-scroll ON' : 'Auto-scroll OFF'}
            </button>
          </div>

          {/* Logs Container */}
          <div 
            ref={logContainerRef}
            className="h-96 overflow-y-auto p-3 font-mono text-sm bg-black/50"
            style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
          >
            {filteredLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <i className="fas fa-terminal text-4xl mb-2 opacity-50"></i>
                <p>No logs available. Waiting for server activity...</p>
                <p className="text-xs mt-2">Server logs will appear here in real-time</p>
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} className="mb-0.5 hover:bg-gray-800 p-1 rounded font-mono text-xs">
                  <span className="text-gray-500">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span 
                    className="ml-2 font-bold"
                    style={{ color: getLevelColor(log.level) }}
                  >
                    {getLevelIcon(log.level)} [{log.level}]
                  </span>
                  <span className="ml-2 text-gray-300 break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-800 px-4 py-2 text-xs text-gray-400 flex justify-between">
            <span>Total logs: {filteredLogs.length}</span>
            <span>Filter: {filter === 'ALL' ? 'all levels' : filter}</span>
            {searchTerm && <span>Search: "{searchTerm}"</span>}
            <span>{isSubscribed ? '🟢 Live mode' : '⚫ Offline mode'}</span>
          </div>
        </div>
      )}

      {/* Command Console Tab */}
      {activeTab === 'commands' && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          {/* Command Input */}
          <form onSubmit={executeCommand} className="bg-gray-800 p-3 border-b border-gray-700">
            <div className="flex gap-2">
              <span className="text-green-500 font-mono">$</span>
              <input
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                placeholder="Enter command (e.g., status, ps aux, df -h)"
                className="flex-1 bg-transparent border-none text-white font-mono text-sm focus:outline-none"
                disabled={isExecuting}
              />
              <button
                type="submit"
                disabled={isExecuting || !currentCommand.trim()}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                {isExecuting ? 'Running...' : 'Execute'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Allowed commands: status, ps aux, top -bn1, df -h, free -m, netstat -tulpn, python --version, pip list
            </p>
          </form>

          {/* Command Output */}
          <div 
            ref={commandOutputRef}
            className="h-96 overflow-y-auto p-3 font-mono text-sm bg-black/50"
            style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
          >
            {commandOutput.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <i className="fas fa-terminal text-4xl mb-2 opacity-50"></i>
                <p>No commands executed yet</p>
                <p className="text-xs mt-2">Enter a command above to see output</p>
              </div>
            ) : (
              commandOutput.map((out, index) => (
                <div key={index} className="mb-0.5 font-mono text-xs">
                  {out.type === 'command' ? (
                    <span className="text-green-500">{out.line}</span>
                  ) : out.type === 'stderr' ? (
                    <span className="text-red-400">{out.line}</span>
                  ) : out.type === 'error' ? (
                    <span className="text-red-500 font-bold">{out.line}</span>
                  ) : (
                    <span className="text-gray-300">{out.line}</span>
                  )}
                </div>
              ))
            )}
            {isExecuting && (
              <div className="text-gray-500 mt-2">
                <i className="fas fa-spinner fa-spin mr-2"></i>Command executing...
              </div>
            )}
          </div>

          {/* Command History */}
          {commandHistory.length > 0 && (
            <div className="bg-gray-800 px-3 py-2 border-t border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Command History:</p>
              <div className="flex gap-2 flex-wrap">
                {commandHistory.slice(-5).map((cmd, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentCommand(cmd)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-0.5 rounded font-mono"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* System Metrics Tab */}
      {activeTab === 'metrics' && serverMetrics && (
        <div className="space-y-4">
          {/* CPU Metrics */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-primary mb-3">CPU</h3>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Usage</span>
                  <span>{serverMetrics.cpu?.percent || 'N/A'}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${serverMetrics.cpu?.percent || 0}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">Cores: {serverMetrics.cpu?.cores || 'N/A'}</p>
              {serverMetrics.cpu?.load_avg && (
                <p className="text-xs text-gray-400">Load Avg: {serverMetrics.cpu.load_avg.join(', ')}</p>
              )}
            </div>
          </div>

          {/* Memory Metrics */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-primary mb-3">Memory</h3>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Usage</span>
                  <span>{serverMetrics.memory?.percent || 0}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${serverMetrics.memory?.percent || 0}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className="text-gray-400">Total: {formatBytes(serverMetrics.memory?.total || 0)}</p>
                <p className="text-gray-400">Used: {formatBytes(serverMetrics.memory?.used || 0)}</p>
                <p className="text-gray-400">Free: {formatBytes(serverMetrics.memory?.free || 0)}</p>
                <p className="text-gray-400">Available: {formatBytes(serverMetrics.memory?.available || 0)}</p>
              </div>
            </div>
          </div>

          {/* Disk Metrics */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-primary mb-3">Disk</h3>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Usage</span>
                  <span>{serverMetrics.disk?.percent || 0}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all"
                    style={{ width: `${serverMetrics.disk?.percent || 0}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className="text-gray-400">Total: {formatBytes(serverMetrics.disk?.total || 0)}</p>
                <p className="text-gray-400">Used: {formatBytes(serverMetrics.disk?.used || 0)}</p>
                <p className="text-gray-400">Free: {formatBytes(serverMetrics.disk?.free || 0)}</p>
              </div>
            </div>
          </div>

          {/* Connection Metrics */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-primary mb-3">Connections</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{systemStatus?.active_connections || 0}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{systemStatus?.connections_by_role?.admin || 0}</p>
                <p className="text-xs text-gray-400">Admins</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{systemStatus?.connections_by_role?.head_nurse || 0}</p>
                <p className="text-xs text-gray-400">Nurses</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">{systemStatus?.connections_by_role?.specialist || 0}</p>
                <p className="text-xs text-gray-400">Specialists</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{systemStatus?.connections_by_role?.patient || 0}</p>
                <p className="text-xs text-gray-400">Patients</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}