import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

class SocketService {
    constructor() {
        this.socket = null;
        this.terminalSocket = null;
        this.listeners = new Map();
        this.isConnectedFlag = false;
        this.isTerminalConnectedFlag = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.logSubscribed = false;
        this.commandSessions = new Map();
        
        // Use environment variable for WebSocket URL
        this.WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';
    }

    connect(token) {
        if (this.socket && this.socket.connected) {
            console.log('WebSocket already connected');
            return;
        }

        console.log('Connecting to WebSocket at:', this.WS_URL);
        
        this.socket = io(this.WS_URL, {
            query: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            path: '/socket.io'
        });

        this.setupEventListeners();
        this.connectTerminalNamespace(token);
    }

    connectTerminalNamespace(token) {
        console.log('Connecting to terminal namespace...');
        
        this.terminalSocket = io(`${this.WS_URL}/terminal`, {
            query: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            path: '/socket.io'
        });

        this.terminalSocket.on('connect', () => {
            console.log('Terminal namespace connected');
            this.isTerminalConnectedFlag = true;
            // Request actual capture status from server instead of assuming false
            // This ensures remounting TerminalMonitor restores the correct state
            setTimeout(() => {
                this.terminalSocket.emit('get_capture_status');
            }, 300);
            this.trigger('terminal_connected', { status: 'connected', capturing: false });
        });

        this.terminalSocket.on('disconnect', () => {
            console.log('Terminal namespace disconnected');
            this.isTerminalConnectedFlag = false;
            this.trigger('terminal_disconnected', { status: 'disconnected' });
        });

        this.terminalSocket.on('terminal_output', (data) => {
            console.log('Terminal output:', data);
            this.trigger('terminal_output', data);
        });

        this.terminalSocket.on('log_output', (data) => {
            console.log('Log output:', data);
            this.trigger('log_output', data);
        });

        this.terminalSocket.on('terminal_connected', (data) => {
            console.log('Terminal connected response:', data);
            this.trigger('terminal_connected', data);
        });

        this.terminalSocket.on('capture_started', (data) => {
            console.log('Capture started:', data);
            this.trigger('capture_started', data);
        });

        this.terminalSocket.on('capture_stopped', (data) => {
            console.log('Capture stopped:', data);
            this.trigger('capture_stopped', data);
        });

        this.terminalSocket.on('capture_status', (data) => {
            console.log('Capture status:', data);
            this.trigger('capture_status', data);
        });

        this.terminalSocket.on('error', (data) => {
            console.error('Terminal socket error:', data);
            this.trigger('terminal_error', data);
        });
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('WebSocket connected');
            this.isConnectedFlag = true;
            this.reconnectAttempts = 0;
            this.trigger('connected', { 
                status: 'connected',
                timestamp: new Date().toISOString()
            });
            this.showToast('success', 'Connected to real-time server');
            
            // Auto-subscribe to logs if admin
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user?.role === 'admin' && !this.logSubscribed) {
                setTimeout(() => this.subscribeToLogs(), 1000);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            this.isConnectedFlag = false;
            this.logSubscribed = false;
            this.trigger('disconnected', { 
                status: 'disconnected',
                reason: reason,
                timestamp: new Date().toISOString()
            });
            if (reason !== 'io client disconnect') {
                this.showToast('warning', 'Disconnected from real-time server. Reconnecting...');
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.reconnectAttempts++;
            this.trigger('error', { 
                message: 'Connection error',
                error: error.message
            });
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.showToast('error', 'Unable to connect to real-time server. Please refresh the page.');
            }
        });

        this.socket.on('activity', (data) => {
            console.log('Activity:', data);
            this.trigger('activity', data);
        });

        this.socket.on('notification', (data) => {
            console.log('Notification:', data);
            this.trigger('notification', data);
            this.showToast('info', data.title || data.message);
        });

        this.socket.on('appointment_update', (data) => {
            console.log('Appointment update:', data);
            this.trigger('appointment_update', data);
            this.showToast('info', `📅 Appointment: ${data.message || 'Status changed'}`);
        });

        this.socket.on('referral_update', (data) => {
            console.log('Referral update:', data);
            this.trigger('referral_update', data);
            this.showToast('info', `📋 Referral: ${data.message || 'Status changed'}`);
        });

        this.socket.on('log_entry', (data) => {
            console.log('Server log:', data);
            this.trigger('log_entry', data);
        });

        this.socket.on('server_logs', (data) => {
            console.log(`Received ${data.count} log entries`);
            this.trigger('server_logs', data);
        });

        this.socket.on('system_status', (data) => {
            console.log('System status:', data);
            this.trigger('system_status', data);
        });

        this.socket.on('active_users', (data) => {
            console.log(`Active users: ${data.count}`);
            this.trigger('active_users', data);
        });

        this.socket.on('subscribed', (data) => {
            console.log(`Subscribed to channel: ${data.channel}`);
            this.trigger('subscribed', data);
        });

        this.socket.on('subscribed_logs', (data) => {
            console.log('Subscribed to server logs:', data);
            this.logSubscribed = true;
            this.trigger('subscribed_logs', data);
        });

        this.socket.on('unsubscribed_logs', (data) => {
            console.log('Unsubscribed from server logs:', data);
            this.logSubscribed = false;
            this.trigger('unsubscribed_logs', data);
        });

        this.socket.on('logs_cleared', (data) => {
            console.log('Logs cleared:', data);
            this.trigger('logs_cleared', data);
            this.showToast('success', 'Server logs cleared');
        });

        this.socket.on('log_tail', (data) => {
            this.trigger('log_tail', data);
        });

        this.socket.on('tail_started', (data) => {
            console.log('Tail started:', data);
            this.trigger('tail_started', data);
            this.showToast('info', 'Started live log streaming');
        });

        this.socket.on('tail_stopped', (data) => {
            console.log('Tail stopped:', data);
            this.trigger('tail_stopped', data);
            this.showToast('info', 'Stopped log streaming');
        });

        this.socket.on('command_output', (data) => {
            this.trigger('command_output', data);
        });

        this.socket.on('command_started', (data) => {
            console.log('Command started:', data);
            this.trigger('command_started', data);
        });

        this.socket.on('command_complete', (data) => {
            console.log('Command complete:', data);
            this.trigger('command_complete', data);
            if (data.returncode === 0) {
                this.showToast('success', 'Command completed successfully');
            } else {
                this.showToast('error', `Command failed with exit code ${data.returncode}`);
            }
        });

        this.socket.on('server_metrics', (data) => {
            this.trigger('server_metrics', data);
        });

        this.socket.on('pong', (data) => {
            console.log('Pong received:', data);
            this.trigger('pong', data);
        });

        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
            this.trigger('error', data);
            this.showToast('error', data.message || 'WebSocket error');
        });
    }

    disconnect() {
        if (this.socket) {
            if (this.logSubscribed) {
                this.unsubscribeFromLogs();
            }
            this.socket.disconnect();
            this.socket = null;
            this.isConnectedFlag = false;
            this.logSubscribed = false;
            this.commandSessions.clear();
        }
        if (this.terminalSocket) {
            this.terminalSocket.disconnect();
            this.terminalSocket = null;
            this.isTerminalConnectedFlag = false;
        }
    }

    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
            return true;
        } else {
            console.warn('Socket not connected, cannot emit:', event);
            return false;
        }
    }

    emitTerminal(event, data) {
        if (this.terminalSocket && this.terminalSocket.connected) {
            this.terminalSocket.emit(event, data);
            return true;
        } else {
            console.warn('Terminal socket not connected, cannot emit:', event);
            return false;
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
            if (callbacks.length === 0) {
                this.listeners.delete(event);
            }
        }
    }

    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    trigger(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error in ${event} callback:`, e);
                }
            });
        }
    }

    showToast(type, message) {
        const toastMap = {
            success: toast.success,
            error: toast.error,
            warning: toast.custom,
            info: toast.custom
        };
        
        const toastFn = toastMap[type] || toast.info;
        
        try {
            if (type === 'warning') {
                toastFn(message, {
                    icon: '⚠️',
                    duration: 4000,
                    position: 'top-right',
                });
            } else if (type === 'info') {
                toastFn(message, {
                    icon: 'ℹ️',
                    duration: 4000,
                    position: 'top-right',
                });
            } else {
                toastFn(message, {
                    duration: 4000,
                    position: 'top-right',
                });
            }
        } catch (e) {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // ==================== CHANNEL SUBSCRIPTIONS ====================
    
    subscribe(channels) {
        return this.emit('subscribe', { channels });
    }

    unsubscribe(channels) {
        return this.emit('unsubscribe', { channels });
    }

    // ==================== LOG MANAGEMENT ====================
    
    subscribeToLogs() {
        if (this.isConnectedFlag) {
            this.emit('subscribe_logs');
            return true;
        }
        return false;
    }

    unsubscribeFromLogs() {
        if (this.isConnectedFlag) {
            this.emit('unsubscribe_logs');
            return true;
        }
        return false;
    }

    getServerLogs(lines = 100) {
        return this.emit('get_server_logs', { lines });
    }

    clearServerLogs() {
        if (window.confirm('Are you sure you want to clear all server logs? This action cannot be undone.')) {
            return this.emit('clear_logs');
        }
        return false;
    }

    tailLogs(lines = 50) {
        return this.emit('tail_logs', { lines });
    }

    stopTail() {
        return this.emit('stop_tail');
    }

    // ==================== TERMINAL CAPTURE ====================
    
    startTerminalCapture() {
        return this.emitTerminal('start_capture');
    }

    stopTerminalCapture() {
        return this.emitTerminal('stop_capture');
    }

    getTerminalCaptureStatus() {
        return this.emitTerminal('get_capture_status');
    }

    // ==================== COMMAND EXECUTION ====================
    
    executeCommand(command) {
        return this.emit('execute_command', { command });
    }

    // ==================== SYSTEM MONITORING ====================
    
    getSystemStatus() {
        return this.emit('get_system_status');
    }

    getActiveUsers() {
        return this.emit('get_active_users');
    }

    getServerMetrics() {
        return this.emit('get_server_metrics');
    }

    ping() {
        return this.emit('ping');
    }

    // ==================== CONNECTION STATUS ====================
    
    isConnected() {
        return this.isConnectedFlag && this.socket && this.socket.connected;
    }

    isTerminalConnected() {
        return this.isTerminalConnectedFlag && this.terminalSocket && this.terminalSocket.connected;
    }

    isLogSubscribed() {
        return this.logSubscribed;
    }

    getSocketId() {
        return this.socket?.id || null;
    }

    getTerminalSocketId() {
        return this.terminalSocket?.id || null;
    }

    // ==================== RECONNECTION ====================
    
    reconnect() {
        if (this.socket) {
            this.socket.connect();
        }
        if (this.terminalSocket) {
            this.terminalSocket.connect();
        }
    }

    // ==================== EVENT HANDLER HELPERS ====================
    
    waitForConnection(timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (this.isConnected()) {
                resolve();
                return;
            }
            
            const timeoutId = setTimeout(() => {
                this.off('connected', onConnect);
                reject(new Error('Connection timeout'));
            }, timeout);
            
            const onConnect = () => {
                clearTimeout(timeoutId);
                this.off('connected', onConnect);
                resolve();
            };
            
            this.once('connected', onConnect);
        });
    }
}

// Create and export a single instance
const socketService = new SocketService();
export default socketService;