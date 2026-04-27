"""
Complete Terminal Output Capture for Real-Time Web Display
Captures ALL console output including prints, errors, and system logs
"""

import sys
import logging
import threading
import queue
from datetime import datetime

# Global variables
_original_stdout = sys.stdout
_original_stderr = sys.stderr
_capturing = False
_socketio_instance = None
_capture_thread = None


class TeeOutput:
    """Dual output: sends to both original terminal AND WebSocket"""
    
    def __init__(self, original_stream, stream_type='stdout'):
        self.original_stream = original_stream
        self.stream_type = stream_type
    
    def write(self, text):
        if not text:
            return
        
        # Write to original terminal
        self.original_stream.write(text)
        self.original_stream.flush()
        
        # Send to WebSocket if capturing
        if _capturing and _socketio_instance:
            try:
                _socketio_instance.emit('terminal_output', {
                    'type': self.stream_type,
                    'data': text,
                    'timestamp': datetime.now().isoformat()
                }, namespace='/terminal', room='terminal_monitor')
            except Exception:
                pass
    
    def flush(self):
        self.original_stream.flush()


class BroadcastLogHandler(logging.Handler):
    """Custom logging handler that broadcasts to WebSocket clients"""
    
    def __init__(self):
        super().__init__()
        self.setLevel(logging.DEBUG)
        self.setFormatter(logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
    
    def emit(self, record):
        if _capturing and _socketio_instance:
            try:
                log_entry = self.format(record)
                # Emit on /terminal namespace (frontend listens here)
                # Also emit as log_entry on default namespace for ServerLogs tab
                payload = {
                    'level': record.levelname,
                    'message': log_entry,
                    'logger': record.name,
                    'timestamp': datetime.now().isoformat(),
                    'filename': record.filename,
                    'lineno': record.lineno
                }
                _socketio_instance.emit('log_output', payload,
                                        namespace='/terminal',
                                        room='terminal_monitor')
                _socketio_instance.emit('log_entry', payload)
            except Exception:
                pass


def _broadcast_worker():
    """Worker thread to broadcast queued output"""
    global _capturing
    while _capturing:
        try:
            data = _output_queue.get(timeout=0.5)
            if _socketio_instance:
                _socketio_instance.emit('terminal_output', data, namespace='/terminal', room='terminal_monitor')
        except queue.Empty:
            continue
        except Exception as e:
            print(f"Broadcast worker error: {e}")


def start_terminal_capture(socketio_instance=None):
    """Start capturing all terminal output"""
    global _capturing, _socketio_instance, _capture_thread, _original_stdout, _original_stderr
    
    if _capturing:
        print("Terminal capture is already active")
        return False
    
    _socketio_instance = socketio_instance
    _capturing = True
    
    # Redirect stdout and stderr
    sys.stdout = TeeOutput(_original_stdout, 'stdout')
    sys.stderr = TeeOutput(_original_stderr, 'stderr')
    
    # Add custom logging handler to capture all logs
    handler = BroadcastLogHandler()
    
    # Remove existing handlers to avoid duplicates
    root_logger = logging.getLogger()
    for h in root_logger.handlers[:]:
        if isinstance(h, BroadcastLogHandler):
            root_logger.removeHandler(h)
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.DEBUG)
    
    # Also capture specific loggers
    loggers_to_capture = [
        'werkzeug',
        'sqlalchemy',
        'sqlalchemy.engine',
        'sqlalchemy.pool',
        'isas',
        'flask_cors',
        'flask_jwt_extended'
    ]
    
    for logger_name in loggers_to_capture:
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.DEBUG)
        logger.addHandler(handler)
    
    # Print capture start message
    print("\n" + "="*70)
    print("🔴 TERMINAL CAPTURE STARTED - All output will be sent to Web UI")
    print("="*70 + "\n")
    
    return True


def stop_terminal_capture():
    """Stop capturing terminal output"""
    global _capturing, _socketio_instance, _capture_thread
    
    if not _capturing:
        print("Terminal capture is not active")
        return False
    
    _capturing = False
    _socketio_instance = None
    
    # Restore original stdout/stderr
    sys.stdout = _original_stdout
    sys.stderr = _original_stderr
    
    # Remove logging handler
    root_logger = logging.getLogger()
    for h in root_logger.handlers[:]:
        if isinstance(h, BroadcastLogHandler):
            root_logger.removeHandler(h)
    
    print("\n" + "="*70)
    print("🟢 TERMINAL CAPTURE STOPPED")
    print("="*70 + "\n")
    
    return True


def is_capturing():
    """Check if terminal capture is active"""
    return _capturing


def get_capture_status():
    """Get detailed capture status"""
    return {
        'capturing': _capturing,
        'socket_connected': _socketio_instance is not None,
        'timestamp': datetime.now().isoformat()
    }


class TerminalMonitor:
    """Monitor and broadcast terminal activity"""
    
    def __init__(self, socketio_instance):
        self.socketio = socketio_instance
        self.active = False
    
    def start(self):
        self.active = True
        return start_terminal_capture(self.socketio)
    
    def stop(self):
        self.active = False
        return stop_terminal_capture()
    
    def get_status(self):
        return get_capture_status()