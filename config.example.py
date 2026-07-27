import os
from pathlib import Path

# The base directory of the application
basedir = Path(__file__).parent.resolve()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'
    RECAPTCHA_PUBLIC_KEY = os.environ.get('RECAPTCHA_PUBLIC_KEY') or 'your-recaptcha-public-key'
    RECAPTCHA_PRIVATE_KEY = os.environ.get('RECAPTCHA_PRIVATE_KEY') or 'your-recaptcha-private-key'

    # Data directory (can be overridden via DATA_DIR env var, e.g. /app/data in Docker)
    DATA_DIR = Path(os.environ.get('DATA_DIR')) if os.environ.get('DATA_DIR') else (basedir.parent / "data")
    data_dir = DATA_DIR
    db_path = DATA_DIR / "app.db"

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        f'sqlite:///{db_path}'

    # Path for storing uploaded pictograms
    PICTOGRAMS_PATH = Path(os.environ.get('PICTOGRAMS_PATH')) if os.environ.get('PICTOGRAMS_PATH') else (DATA_DIR / "pictograms")
    PICTOGRAMS_PATH_MIN = Path(os.environ.get('PICTOGRAMS_PATH_MIN')) if os.environ.get('PICTOGRAMS_PATH_MIN') else (DATA_DIR / "pictogramsmin")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'nl', 'pl']

    # Email configuration
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = "your-email@gmail.com"
    MAIL_PASSWORD = "your-gmail-app-password"
    ADMIN_EMAIL = "admin@example.com"
    MAIL_DEFAULT_SENDER = ('Pictogram-Tree Builder', os.environ.get('MAIL_USERNAME'))
