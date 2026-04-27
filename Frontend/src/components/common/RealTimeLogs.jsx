import React, { useState, useEffect, useRef } from 'react';
import socketService from '../../socket';

const RealTimeLogs = ({ isAdmin = false, minimal = false }) => {
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [expanded, setExpanded] = useState(!minimal);
    const [activeUsers, setActiveUsers] = useState([]);
    const [systemStatus, setSystemStatus] = useState(null);
    const logContainerRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !socketService.isConnected()) {
            socketService.connect(token);
        }

        // Set up event listeners
        socketService.on('connected', handleConnected);
        socketService.on('disconnected', handleDisconnected);
        socketService.on('log_entry', handleLogEntry);
        socketService.on('activity', handleActivity);
        socketService.on('system_status', handleSystemStatus);
        socketService.on('active_users', handleActiveUsers);

        // Request initial data if admin
        if (isAdmin) {
            socketService.getServerLogs(100);
            socketService.getSystemStatus();
            socketService.getActiveUsers();
        }

        // Ping interval to keep connection alive
        const pingInterval = setInterval(() => {
            if (socketService.isConnected()) {
                socketService.ping();
            }
        }, 30000);

        return () => {
            clearInterval(pingInterval);
            socketService.off('connected', handleConnected);
            socketService.off('disconnected', handleDisconnected);
            socketService.off('log_entry', handleLogEntry);
            socketService.off('activity', handleActivity);
            socketService.off('system_status', handleSystemStatus);
            socketService.off('active_users', handleActiveUsers);
        };
    }, [isAdmin]);

    useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleConnected = () => {
        setIsConnected(true);
        addLog({
            timestamp: new Date().toISOString(),
            level: 'SUCCESS',
            message: 'Connected to real-time server'
        });
    };

    const handleDisconnected = () => {
        setIsConnected(false);
        addLog({
            timestamp: new Date().toISOString(),
            level: 'WARNING',
            message: 'Disconnected from real-time server'
        });
    };

    const handleLogEntry = (data) => {
        addLog({
            timestamp: data.timestamp || new Date().toISOString(),
            level: data.level || 'INFO',
            message: data.message
        });
    };

    const handleActivity = (data) => {
        const typeMap = {
            'connection': '🔌',
            'disconnection': '🔌',
            'user_login': '🔐',
            'user_logout': '🚪',
            'appointment_created': '📅',
            'appointment_updated': '📅',
            'referral_created': '📋',
            'referral_updated': '📋',
            'email_sent': '📧',
            'sms_sent': '📱',
            'notification_created': '🔔'
        };
        const icon = typeMap[data.type] || '📌';
        
        addLog({
            timestamp: data.timestamp || new Date().toISOString(),
            level: 'ACTIVITY',
            message: `${icon} ${data.type}: ${data.message || JSON.stringify(data)}`
        });
    };

    const handleSystemStatus = (data) => {
        setSystemStatus(data);
        addLog({
            timestamp: data.timestamp,
            level: 'STATUS',
            message: `System: ${data.active_connections} active connections`
        });
    };

    const handleActiveUsers = (data) => {
        setActiveUsers(data.users || []);
    };

    const addLog = (log) => {
        setLogs(prev => [...prev, log].slice(-500));
    };

    const clearLogs = () => {
        setLogs([]);
    };

    const getLevelColor = (level) => {
        const colors = {
            'ERROR': '#f44336',
            'WARNING': '#ff9800',
            'SUCCESS': '#4caf50',
            'ACTIVITY': '#2196f3',
            'STATUS': '#9c27b0',
            'INFO': '#607d8b'
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
            'INFO': 'ℹ️'
        };
        return icons[level] || '📝';
    };

    const filteredLogs = filter === 'ALL' 
        ? logs 
        : logs.filter(log => log.level === filter);

    if (minimal && !expanded) {
        return (
            <div 
                className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white rounded-lg shadow-lg cursor-pointer"
                onClick={() => setExpanded(true)}
                style={{ padding: '8px 12px' }}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-sm">Live Logs</span>
                    <span className="text-xs text-gray-400">({logs.length})</span>
                </div>
            </div>
        );
    }

    if (minimal && expanded) {
        return (
            <div className="fixed bottom-4 right-4 z-50 w-96 bg-gray-900 rounded-lg shadow-xl border border-gray-700">
                <div className="flex justify-between items-center p-3 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <h3 className="text-white font-semibold">Live Activity</h3>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setExpanded(false)}
                            className="text-gray-400 hover:text-white text-sm"
                        >
                            Minimize
                        </button>
                        <button
                            onClick={clearLogs}
                            className="text-gray-400 hover:text-white text-sm"
                        >
                            Clear
                        </button>
                    </div>
                </div>
                <div 
                    ref={logContainerRef}
                    className="h-64 overflow-y-auto p-2 font-mono text-xs"
                >
                    {filteredLogs.slice(-30).map((log, index) => (
                        <div key={index} className="mb-1 hover:bg-gray-800 p-1 rounded">
                            <span className="text-gray-500">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span 
                                className="ml-2"
                                style={{ color: getLevelColor(log.level) }}
                            >
                                {getLevelIcon(log.level)} {log.level}
                            </span>
                            <span className="ml-2 text-gray-300">{log.message}</span>
                        </div>
                    ))}
                    {filteredLogs.length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                            No activity yet...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Full admin log viewer
    return (
        <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-700">
            <div className="bg-gray-800 px-4 py-3 rounded-t-lg flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-mono font-semibold">📋 Server Logs</h3>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-xs text-gray-400">
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <select 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
                    >
                        <option value="ALL">All Levels</option>
                        <option value="ERROR">❌ Errors</option>
                        <option value="WARNING">⚠️ Warnings</option>
                        <option value="SUCCESS">✅ Success</option>
                        <option value="ACTIVITY">🔄 Activity</option>
                        <option value="STATUS">📊 Status</option>
                        <option value="INFO">ℹ️ Info</option>
                    </select>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`text-xs px-2 py-1 rounded ${autoScroll ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                        {autoScroll ? '📌 Auto-scroll ON' : 'Auto-scroll OFF'}
                    </button>
                    <button
                        onClick={clearLogs}
                        className="bg-gray-700 text-white text-xs px-2 py-1 rounded hover:bg-gray-600"
                    >
                        🗑️ Clear
                    </button>
                    <button
                        onClick={() => socketService.getServerLogs(100)}
                        className="bg-gray-700 text-white text-xs px-2 py-1 rounded hover:bg-gray-600"
                    >
                        🔄 Refresh
                    </button>
                    <button
                        onClick={() => socketService.getSystemStatus()}
                        className="bg-gray-700 text-white text-xs px-2 py-1 rounded hover:bg-gray-600"
                    >
                        📊 Status
                    </button>
                </div>
            </div>
            
            {/* System Status Bar */}
            {systemStatus && (
                <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 text-xs text-gray-400 flex gap-4">
                    <span>🟢 Active: {systemStatus.active_connections}</span>
                    <span>👤 Patients: {systemStatus.connections_by_role?.patient || 0}</span>
                    <span>👩‍⚕️ Nurses: {systemStatus.connections_by_role?.head_nurse || 0}</span>
                    <span>👨‍⚕️ Specialists: {systemStatus.connections_by_role?.specialist || 0}</span>
                    <span>🔧 Admins: {systemStatus.connections_by_role?.admin || 0}</span>
                </div>
            )}
            
            {/* Logs Container */}
            <div 
                ref={logContainerRef}
                className="h-96 overflow-y-auto p-3 font-mono text-sm"
                style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
            >
                {filteredLogs.map((log, index) => (
                    <div key={index} className="mb-1 hover:bg-gray-800 p-1 rounded">
                        <span className="text-gray-500">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        <span 
                            className="ml-2 font-bold"
                            style={{ color: getLevelColor(log.level) }}
                        >
                            {getLevelIcon(log.level)} [{log.level}]
                        </span>
                        <span className="ml-2 text-gray-300">{log.message}</span>
                    </div>
                ))}
                {filteredLogs.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        No logs available. Waiting for server activity...
                    </div>
                )}
            </div>
            
            {/* Footer */}
            <div className="bg-gray-800 px-4 py-2 rounded-b-lg text-xs text-gray-400 flex justify-between">
                <span>Total logs: {filteredLogs.length}</span>
                <span>Filter: {filter === 'ALL' ? 'all levels' : filter}</span>
                <span>Memory: {Math.round(JSON.stringify(logs).length / 1024)} KB</span>
            </div>
        </div>
    );
};

export default RealTimeLogs;