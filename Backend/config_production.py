import os
from dotenv import load_dotenv

load_dotenv()

class ProductionConfig:
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://isas_user:strong_password@localhost:5432/isas_prod')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 20,
        'pool_recycle': 300,
        'pool_pre_ping': True,
    }
    
    # JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'CHANGE_THIS_TO_RANDOM_STRING')
    JWT_ACCESS_TOKEN_EXPIRES = 28800  # 8 hours
    
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'CHANGE_THIS_TO_RANDOM_STRING')
    DEBUG = False
    TESTING = False
    
    # Email Configuration
    MAIL_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('SMTP_PORT', 587))
    MAIL_USERNAME = os.getenv('EMAIL_ADDRESS')
    MAIL_PASSWORD = os.getenv('EMAIL_PASSWORD')
    MAIL_USE_TLS = True
    MAIL_DEFAULT_SENDER = os.getenv('EMAIL_ADDRESS', 'noreply@isas.gov.bw')
    
    # File Upload
    UPLOAD_FOLDER = '/var/www/isas/uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'gif'}
    
    # CORS - Production
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'https://your-domain.com').split(',')
    CORS_SUPPORTS_CREDENTIALS = True
    
    # Session
    SESSION_TYPE = 'redis'
    SESSION_REDIS = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours
    
    # Logging
    LOG_LEVEL = 'INFO'
    LOG_FILE = '/var/log/isas/app.log'