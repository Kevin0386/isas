import multiprocessing
import os

# Server socket
bind = '127.0.0.1:5001'  # Use port 5001 for gunicorn (not conflicting with WebSocket)
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'eventlet'  # For WebSocket support
worker_connections = 1000
timeout = 120
keepalive = 5

# Logging
accesslog = '/var/log/isas/gunicorn_access.log'
errorlog = '/var/log/isas/gunicorn_error.log'
loglevel = 'info'

# Process naming
proc_name = 'isas'

# Server mechanics
daemon = False
pidfile = '/var/run/isas/gunicorn.pid'
umask = 0
user = 'isas'
group = 'isas'
tmp_upload_dir = '/tmp'

# SSL (if using HTTPS)
# keyfile = '/etc/ssl/private/isas.key'
# certfile = '/etc/ssl/certs/isas.crt'