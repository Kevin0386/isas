"""
WebSocket Routes for Real-Time Updates
Ensures all backend activities are visible in the web interface
"""

import json
import logging
import os
import subprocess
import threading
import sys
import io
from datetime import datetime
from flask import request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import decode_token

# Initialize SocketIO
socketio = SocketIO(cors_allowed_origins="*", logger=False, engineio_logger=False)

# Store active connections
active_connections = {}

# Store log subscribers
log_subscribers = set()

# Store command sessions for real-time output streaming
command_sessions = {}

# Flag to prevent recursive logging
_broadcasting = False

# Terminal capture state
_terminal_capturing = False
_original_stdout = sys.stdout
_original_stderr = sys.stderr


class TeeOutput:
    """Dual output: sends to both original terminal AND WebSocket"""
    
    def __init__(self, original_stream, stream_type='stdout'):
        self.original_stream = original_stream
        self.stream_type = stream_type
    
    def write(self, text):
        if not text or text.strip() == '':
            return
        
        # Write to original terminal
        self.original_stream.write(text)
        self.original_stream.flush()
        
        # Send to WebSocket
        if _terminal_capturing:
            try:
                socketio.emit('terminal_output', {
                    'type': self.stream_type,
                    'data': text,
                    'timestamp': datetime.now().isoformat()
                }, namespace='/terminal', room='terminal_monitor')
            except Exception:
                pass
    
    def flush(self):
        self.original_stream.flush()


class OutputCaptureHandler(logging.Handler):
    """Capture all logging output and send to WebSocket"""
    
    def __init__(self):
        super().__init__()
        self.setLevel(logging.DEBUG)
        self.setFormatter(logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
    
    def emit(self, record):
        if _terminal_capturing:
            try:
                log_entry = self.format(record)
                socketio.emit('log_output', {
                    'level': record.levelname,
                    'message': log_entry,
                    'logger': record.name,
                    'timestamp': datetime.now().isoformat(),
                    'filename': record.filename,
                    'lineno': record.lineno
                }, namespace='/logs', room='admin_logs')
            except Exception:
                pass


def start_terminal_capture():
    """Start capturing all terminal output"""
    global _terminal_capturing, _original_stdout, _original_stderr
    
    if _terminal_capturing:
        return False
    
    _terminal_capturing = True
    
    # Redirect stdout and stderr
    sys.stdout = TeeOutput(_original_stdout, 'stdout')
    sys.stderr = TeeOutput(_original_stderr, 'stderr')
    
    # Add custom logging handler
    handler = OutputCaptureHandler()
    logging.getLogger().addHandler(handler)
    
    # Also capture werkzeug logs
    werkzeug_logger = logging.getLogger('werkzeug')
    werkzeug_logger.addHandler(handler)
    werkzeug_logger.setLevel(logging.DEBUG)
    
    # Capture SQLAlchemy logs
    sqlalchemy_logger = logging.getLogger('sqlalchemy')
    sqlalchemy_logger.addHandler(handler)
    sqlalchemy_logger.setLevel(logging.INFO)
    
    print("\n" + "="*60)
    print("🔴 TERMINAL CAPTURE ACTIVE - All output will be sent to Web UI")
    print("="*60 + "\n")
    
    return True


def stop_terminal_capture():
    """Stop capturing terminal output"""
    global _terminal_capturing
    
    if not _terminal_capturing:
        return False
    
    _terminal_capturing = False
    
    # Restore original stdout/stderr
    sys.stdout = _original_stdout
    sys.stderr = _original_stderr
    
    print("\n" + "="*60)
    print("🟢 TERMINAL CAPTURE STOPPED")
    print("="*60 + "\n")
    
    return True


def is_capturing():
    """Check if terminal capture is active"""
    return _terminal_capturing


def setup_socket_events():
    """Setup all Socket.IO event handlers"""
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        try:
            token = request.args.get('token')
            if token:
                decoded = decode_token(token)
                user_id = decoded['sub']
                user_role = decoded.get('role', 'unknown')
                user_name = decoded.get('name', 'Unknown')
                
                active_connections[request.sid] = {
                    'user_id': user_id,
                    'role': user_role,
                    'name': user_name,
                    'connected_at': datetime.now().isoformat()
                }
                
                join_room(f"user_{user_id}")
                join_room(f"role_{user_role}")
                
                # Admins automatically subscribe to logs
                if user_role == 'admin':
                    log_subscribers.add(request.sid)
                    join_room("admin_logs")
                    # Auto-start terminal capture for first admin
                    if not _terminal_capturing:
                        start_terminal_capture()
                
                emit('connected', {
                    'status': 'connected',
                    'user_id': user_id,
                    'role': user_role,
                    'name': user_name,
                    'message': f'Connected to ISAS real-time server',
                    'timestamp': datetime.now().isoformat()
                })
                
                _emit_activity_silent({
                    'type': 'connection',
                    'user_id': user_id,
                    'role': user_role,
                    'name': user_name,
                    'message': f'User {user_name} ({user_role}) connected',
                    'timestamp': datetime.now().isoformat()
                })
                
                # Use standard logging (won't broadcast because we check _broadcasting)
                logging.info(f"WebSocket connected: {user_name} ({user_role})")
            else:
                emit('error', {'message': 'Authentication token required'})
                return False
        except Exception as e:
            print(f"Socket connection error: {e}")
            emit('error', {'message': str(e)})
            return False
        return True
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        if request.sid in active_connections:
            user_info = active_connections.pop(request.sid)
            if request.sid in log_subscribers:
                log_subscribers.discard(request.sid)
            if request.sid in command_sessions:
                proc = command_sessions.pop(request.sid)
                try:
                    proc.terminate()
                except:
                    pass
            _emit_activity_silent({
                'type': 'disconnection',
                'user_id': user_info['user_id'],
                'role': user_info['role'],
                'name': user_info['name'],
                'message': f'User {user_info["name"]} ({user_info["role"]}) disconnected',
                'timestamp': datetime.now().isoformat()
            })
            # Use standard logging
            logging.info(f"WebSocket disconnected: {user_info['name']}")
    
    @socketio.on('subscribe')
    def handle_subscribe(data):
        """Subscribe to specific event channels"""
        channels = data.get('channels', [])
        user_info = active_connections.get(request.sid, {})
        
        for channel in channels:
            join_room(f"channel_{channel}")
            emit('subscribed', {
                'channel': channel,
                'status': 'subscribed',
                'timestamp': datetime.now().isoformat()
            })
    
    @socketio.on('unsubscribe')
    def handle_unsubscribe(data):
        """Unsubscribe from event channels"""
        channels = data.get('channels', [])
        for channel in channels:
            leave_room(f"channel_{channel}")
    
    @socketio.on('subscribe_logs')
    def handle_subscribe_logs():
        """Subscribe to server logs"""
        user_info = active_connections.get(request.sid, {})
        if user_info.get('role') == 'admin':
            log_subscribers.add(request.sid)
            join_room("admin_logs")
            emit('subscribed_logs', {
                'status': 'subscribed',
                'message': 'Subscribed to server logs',
                'timestamp': datetime.now().isoformat()
            })
    
    @socketio.on('unsubscribe_logs')
    def handle_unsubscribe_logs():
        """Unsubscribe from server logs"""
        if request.sid in log_subscribers:
            log_subscribers.discard(request.sid)
            leave_room("admin_logs")
            emit('unsubscribed_logs', {
                'status': 'unsubscribed',
                'timestamp': datetime.now().isoformat()
            })
    
    @socketio.on('get_server_logs')
    def handle_get_logs(data):
        """Get recent server logs"""
        lines = data.get('lines', 100)
        try:
            log_file = 'logs/app.log'
            if os.path.exists(log_file):
                with open(log_file, 'r') as f:
                    all_lines = f.readlines()
                    logs = all_lines[-lines:] if len(all_lines) > lines else all_lines
                    emit('server_logs', {
                        'logs': logs,
                        'count': len(logs),
                        'total_lines': len(all_lines),
                        'timestamp': datetime.now().isoformat()
                    })
            else:
                emit('server_logs', {
                    'logs': [],
                    'count': 0,
                    'total_lines': 0,
                    'timestamp': datetime.now().isoformat(),
                    'message': 'Log file not found'
                })
        except Exception as e:
            emit('error', {'message': f'Could not read logs: {str(e)}'})
    
    @socketio.on('clear_logs')
    def handle_clear_logs():
        """Clear server logs (admin only)"""
        user_info = active_connections.get(request.sid, {})
        if user_info.get('role') == 'admin':
            try:
                log_file = 'logs/app.log'
                if os.path.exists(log_file):
                    with open(log_file, 'w') as f:
                        f.write('')
                emit('logs_cleared', {
                    'status': 'cleared',
                    'timestamp': datetime.now().isoformat()
                })
                _emit_log_silent({
                    'level': 'INFO',
                    'message': f'Server logs cleared by admin {user_info.get("name")}',
                    'timestamp': datetime.now().isoformat()
                })
            except Exception as e:
                emit('error', {'message': f'Could not clear logs: {str(e)}'})
    
    @socketio.on('tail_logs')
    def handle_tail_logs(data):
        """Stream live logs (admin only)"""
        user_info = active_connections.get(request.sid, {})
        if user_info.get('role') != 'admin':
            emit('error', {'message': 'Unauthorized'})
            return
        
        lines = data.get('lines', 50)
        try:
            log_file = 'logs/app.log'
            if os.path.exists(log_file):
                def tail_logs():
                    try:
                        process = subprocess.Popen(
                            ['tail', '-f', '-n', str(lines), log_file],
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            text=True,
                            bufsize=1
                        )
                        command_sessions[request.sid] = process
                        
                        for line in iter(process.stdout.readline, ''):
                            if not line:
                                break
                            if request.sid in command_sessions:
                                socketio.emit('log_tail', {
                                    'line': line.strip(),
                                    'timestamp': datetime.now().isoformat()
                                }, room=request.sid)
                        process.wait()
                    except Exception as e:
                        print(f"Tail error: {e}")
                    finally:
                        if request.sid in command_sessions:
                            del command_sessions[request.sid]
                
                thread = threading.Thread(target=tail_logs)
                thread.daemon = True
                thread.start()
                emit('tail_started', {'message': 'Started log streaming'})
            else:
                emit('error', {'message': 'Log file not found'})
        except Exception as e:
            emit('error', {'message': str(e)})
    
    @socketio.on('stop_tail')
    def handle_stop_tail():
        """Stop tailing logs"""
        if request.sid in command_sessions:
            proc = command_sessions.pop(request.sid)
            try:
                proc.terminate()
            except:
                pass
            emit('tail_stopped', {'message': 'Stopped log streaming'})
    
    @socketio.on('execute_command')
    def handle_execute_command(data):
        """Execute a shell command and stream output (admin only)"""
        user_info = active_connections.get(request.sid, {})
        if user_info.get('role') != 'admin':
            emit('error', {'message': 'Unauthorized'})
            return
        
        command = data.get('command', '').strip()
        if not command:
            emit('error', {'message': 'No command provided'})
            return
        
        # Security: Only allow safe commands
        allowed_commands = [
            'ps aux', 'top -bn1', 'df -h', 'free -m', 
            'netstat -tulpn', 'systemctl status', 'docker ps',
            'python --version', 'flask --version', 'pip list', 'status'
        ]
        
        is_allowed = False
        for allowed in allowed_commands:
            if command.startswith(allowed):
                is_allowed = True
                break
        
        if command in ['status', 'health', 'version', 'uptime']:
            is_allowed = True
        
        if not is_allowed:
            emit('error', {'message': f'Command not allowed: {command}'})
            return
        
        try:
            def run_command():
                try:
                    process = subprocess.Popen(
                        command,
                        shell=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        bufsize=1
                    )
                    command_sessions[request.sid] = process
                    
                    for line in iter(process.stdout.readline, ''):
                        if not line:
                            break
                        if request.sid in command_sessions:
                            socketio.emit('command_output', {
                                'line': line.rstrip(),
                                'type': 'stdout',
                                'timestamp': datetime.now().isoformat()
                            }, room=request.sid)
                    
                    for line in iter(process.stderr.readline, ''):
                        if not line:
                            break
                        if request.sid in command_sessions:
                            socketio.emit('command_output', {
                                'line': line.rstrip(),
                                'type': 'stderr',
                                'timestamp': datetime.now().isoformat()
                            }, room=request.sid)
                    
                    process.wait()
                    socketio.emit('command_complete', {
                        'returncode': process.returncode,
                        'timestamp': datetime.now().isoformat()
                    }, room=request.sid)
                    
                except Exception as e:
                    socketio.emit('command_output', {
                        'line': f'Error: {str(e)}',
                        'type': 'error',
                        'timestamp': datetime.now().isoformat()
                    }, room=request.sid)
                finally:
                    if request.sid in command_sessions:
                        del command_sessions[request.sid]
            
            thread = threading.Thread(target=run_command)
            thread.daemon = True
            thread.start()
            emit('command_started', {'command': command})
            
        except Exception as e:
            emit('error', {'message': str(e)})
    
    @socketio.on('get_system_status')
    def handle_system_status():
        """Get current system status"""
        system_info = {
            'active_connections': len(active_connections),
            'connections_by_role': get_connections_by_role(),
            'connections_list': list(active_connections.values()),
            'terminal_capturing': _terminal_capturing,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            import psutil
            system_info['cpu_percent'] = psutil.cpu_percent(interval=0.5)
            system_info['memory_percent'] = psutil.virtual_memory().percent
            system_info['disk_usage'] = psutil.disk_usage('/').percent
        except ImportError:
            system_info['cpu_percent'] = 'N/A'
            system_info['memory_percent'] = 'N/A'
            system_info['disk_usage'] = 'N/A'
        
        emit('system_status', system_info)
    
    @socketio.on('ping')
    def handle_ping():
        """Health check ping"""
        emit('pong', {
            'timestamp': datetime.now().isoformat(),
            'server_time': datetime.now().isoformat()
        })
    
    @socketio.on('get_active_users')
    def handle_get_active_users():
        """Get list of active users"""
        users = []
        for sid, conn in active_connections.items():
            users.append({
                'sid': sid,
                'user_id': conn['user_id'],
                'role': conn['role'],
                'name': conn['name'],
                'connected_at': conn['connected_at']
            })
        emit('active_users', {'users': users, 'count': len(users)})
    
    @socketio.on('get_server_metrics')
    def handle_server_metrics():
        """Get detailed server metrics"""
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'connections': len(active_connections),
            'log_subscribers': len(log_subscribers),
            'command_sessions': len(command_sessions),
            'terminal_capturing': _terminal_capturing
        }
        
        try:
            import psutil
            metrics['cpu'] = {
                'percent': psutil.cpu_percent(interval=0.5),
                'cores': psutil.cpu_count(),
                'load_avg': psutil.getloadavg() if hasattr(psutil, 'getloadavg') else None
            }
            mem = psutil.virtual_memory()
            metrics['memory'] = {
                'total': mem.total,
                'available': mem.available,
                'percent': mem.percent,
                'used': mem.used,
                'free': mem.free
            }
            disk = psutil.disk_usage('/')
            metrics['disk'] = {
                'total': disk.total,
                'used': disk.used,
                'free': disk.free,
                'percent': disk.percent
            }
        except ImportError:
            metrics['psutil'] = 'not_installed'
        
        emit('server_metrics', metrics)
    
    # ==================== TERMINAL CAPTURE NAMESPACE ====================
    
    @socketio.on('connect', namespace='/terminal')
    def handle_terminal_connect():
        """Handle connection to terminal namespace"""
        try:
            token = request.args.get('token')
            if token:
                decoded = decode_token(token)
                user_role = decoded.get('role', 'unknown')
                
                # Only admins can view terminal output
                if user_role == 'admin':
                    join_room('terminal_monitor', namespace='/terminal')
                    emit('terminal_connected', {
                        'status': 'connected',
                        'capturing': _terminal_capturing,
                        'timestamp': datetime.now().isoformat()
                    }, namespace='/terminal')
                    logging.info(f"Admin connected to terminal monitor")
                else:
                    emit('error', {'message': 'Unauthorized'}, namespace='/terminal')
                    return False
            else:
                emit('error', {'message': 'Authentication required'}, namespace='/terminal')
                return False
        except Exception as e:
            logging.error(f"Terminal connection error: {e}")
            return False
        return True
    
    @socketio.on('start_capture', namespace='/terminal')
    def handle_start_capture():
        """Start capturing terminal output (admin only)"""
        token = request.args.get('token')
        if token:
            decoded = decode_token(token)
            if decoded.get('role') == 'admin':
                result = start_terminal_capture()
                emit('capture_started', {
                    'status': 'started' if result else 'already_running',
                    'timestamp': datetime.now().isoformat()
                }, namespace='/terminal')
                _emit_log_silent({
                    'level': 'INFO',
                    'message': 'Terminal capture started by admin',
                    'timestamp': datetime.now().isoformat()
                })
    
    @socketio.on('stop_capture', namespace='/terminal')
    def handle_stop_capture():
        """Stop capturing terminal output (admin only)"""
        token = request.args.get('token')
        if token:
            decoded = decode_token(token)
            if decoded.get('role') == 'admin':
                result = stop_terminal_capture()
                emit('capture_stopped', {
                    'status': 'stopped' if result else 'not_running',
                    'timestamp': datetime.now().isoformat()
                }, namespace='/terminal')
                _emit_log_silent({
                    'level': 'INFO',
                    'message': 'Terminal capture stopped by admin',
                    'timestamp': datetime.now().isoformat()
                })
    
    @socketio.on('get_capture_status', namespace='/terminal')
    def handle_get_capture_status():
        """Get current capture status"""
        emit('capture_status', {
            'capturing': _terminal_capturing,
            'timestamp': datetime.now().isoformat()
        }, namespace='/terminal')


def _emit_activity_silent(data):
    """Broadcast activity without generating log entries"""
    try:
        socketio.emit('activity', data)
    except Exception:
        pass


def _emit_log_silent(log_entry):
    """Broadcast log entry without generating recursive logs"""
    global _broadcasting
    if _broadcasting:
        return
    _broadcasting = True
    try:
        socketio.emit('log_entry', log_entry, room="admin_logs")
    except Exception:
        pass
    finally:
        _broadcasting = False


def broadcast_activity(data):
    """Broadcast activity to all connected clients"""
    _emit_activity_silent(data)


def broadcast_log_entry(log_entry):
    """Broadcast log entry to admin users"""
    _emit_log_silent(log_entry)


def notify_user(user_id, notification):
    """Send notification to specific user"""
    try:
        socketio.emit('notification', notification, room=f"user_{user_id}")
    except Exception as e:
        print(f"User notification error: {e}")


def notify_role(role, notification):
    """Send notification to all users with specific role"""
    try:
        socketio.emit('notification', notification, room=f"role_{role}")
    except Exception as e:
        print(f"Role notification error: {e}")


def broadcast_appointment_update(appointment_data):
    """Broadcast appointment updates to relevant users"""
    try:
        socketio.emit('appointment_update', appointment_data, room="role_head_nurse")
        
        if appointment_data.get('specialist_id'):
            socketio.emit('appointment_update', appointment_data, room=f"role_specialist")
        
        if appointment_data.get('patient_id'):
            socketio.emit('appointment_update', appointment_data, room=f"role_patient")
    except Exception as e:
        print(f"Appointment broadcast error: {e}")


def broadcast_referral_update(referral_data):
    """Broadcast referral updates to relevant users"""
    try:
        socketio.emit('referral_update', referral_data, room="role_head_nurse")
        
        if referral_data.get('specialist_id'):
            socketio.emit('referral_update', referral_data, room="role_specialist")
        
        if referral_data.get('patient_id'):
            socketio.emit('referral_update', referral_data, room="role_patient")
    except Exception as e:
        print(f"Referral broadcast error: {e}")


def get_connections_by_role():
    """Get count of active connections by role"""
    counts = {'patient': 0, 'head_nurse': 0, 'specialist': 0, 'admin': 0, 'unknown': 0}
    for conn in active_connections.values():
        role = conn.get('role', 'unknown')
        if role in counts:
            counts[role] += 1
        else:
            counts['unknown'] += 1
    return counts


class BroadcastLogHandler(logging.Handler):
    """Custom logging handler that broadcasts to WebSocket clients without recursion"""
    
    def __init__(self):
        super().__init__()
        self.setLevel(logging.INFO)
        self.setFormatter(logging.Formatter(
            '%(asctime)s [%(levelname)s] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
    
    def emit(self, record):
        # Skip if we're already broadcasting to prevent recursion
        if _broadcasting:
            return
        
        log_entry = self.format(record)
        # Only broadcast INFO and above, skip DEBUG to reduce noise
        if record.levelno >= logging.INFO:
            try:
                broadcast_log_entry({
                    'level': record.levelname,
                    'message': log_entry,
                    'timestamp': datetime.now().isoformat()
                })
            except Exception:
                pass