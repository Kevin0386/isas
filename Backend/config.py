import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    # ==================== DATABASE ====================
    # Render provides DATABASE_URL automatically
    # For local development, uses PostgreSQL default
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/isas_db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 5,  # Reduced for Render free tier
        'pool_recycle': 300,
        'pool_pre_ping': True,
    }
    
    # ==================== JWT AUTHENTICATION ====================
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)  # 8 hours instead of seconds
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # ==================== FLASK ====================
    SECRET_KEY = os.getenv('SECRET_KEY', 'flask-secret-key')
    # DEBUG is False in production (Render), True in local development
    DEBUG = os.getenv('FLASK_ENV', 'development') == 'development'
    
    # ==================== EMAIL CONFIGURATION ====================
    MAIL_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('SMTP_PORT', 587))
    MAIL_USERNAME = os.getenv('EMAIL_ADDRESS')
    MAIL_PASSWORD = os.getenv('EMAIL_PASSWORD')
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_DEFAULT_SENDER = os.getenv('EMAIL_ADDRESS', 'noreply@isas.gov.bw')
    
    # ==================== FILE UPLOAD ====================
    # Render uses /tmp for writable storage
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', '/tmp/uploads' if os.getenv('RENDER') else 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'gif'}
    
    # ==================== CORS SETTINGS ====================
    # Allow both local development and Render frontend
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000,https://isas-frontend.onrender.com').split(',')
    CORS_SUPPORTS_CREDENTIALS = True
    
    # ==================== RENDER SPECIFIC ====================
    # Detect if running on Render
    IS_RENDER = os.getenv('RENDER', 'false').lower() == 'true'
    
    # ==================== SECURITY ====================
    # Session settings
    SESSION_COOKIE_SECURE = True if os.getenv('FLASK_ENV') == 'production' else False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Rate limiting (optional)
    RATELIMIT_DEFAULT = "100 per hour"
    RATELIMIT_STORAGE_URL = "memory://"
    
    # ==================== LOGGING ====================
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', '/tmp/isas.log' if os.getenv('RENDER') else 'logs/app.log')


class DevelopmentConfig(Config):
    """Development configuration - used when FLASK_ENV=development"""
    DEBUG = True
    ENV = 'development'
    SQLALCHEMY_ECHO = True  # Log SQL queries for debugging


class ProductionConfig(Config):
    """Production configuration - used when FLASK_ENV=production (Render)"""
    DEBUG = False
    ENV = 'production'
    SQLALCHEMY_ECHO = False
    
    # Stronger security in production
    @classmethod
    def init_app(cls, app):
        Config.init_app(app)
        
        # Log to stderr for Render log collection
        import logging
        from logging import StreamHandler
        stream_handler = StreamHandler()
        stream_handler.setLevel(logging.INFO)
        app.logger.addHandler(stream_handler)


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True
    ENV = 'testing'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False


# Configuration dictionary for easy selection
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


# Helper function to get current config
def get_config():
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, DevelopmentConfig)