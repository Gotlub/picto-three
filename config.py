import os
from pathlib import Path

# The base directory of the application
basedir = Path(__file__).parent.resolve()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    
    import hashlib
    # Derivation of a distinct token secret key to prevent exposing SECRET_KEY weaknesses
    TOKEN_SECRET_KEY = os.environ.get(
        'TOKEN_SECRET_KEY',
        hashlib.sha256((SECRET_KEY + 'tokens').encode()).hexdigest()
    )
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME') or 'you-will-never-guess'
    RECAPTCHA_PUBLIC_KEY = os.environ.get('RECAPTCHA_PUBLIC_KEY')
    RECAPTCHA_PRIVATE_KEY = os.environ.get('RECAPTCHA_PRIVATE_KEY')

    # Determine base data directory:
    # 1. Environment variable DATA_DIR if set (sanitizing legacy /data to /app/data in containers)
    # 2. Inside Docker container (/app), use /app/data
    # 3. Fallback to sibling basedir.parent / "data" (e.g. ../data in local dev)
    if os.environ.get('DATA_DIR'):
        raw_data_dir = Path(os.environ['DATA_DIR'])
        if str(raw_data_dir) == '/data' or str(raw_data_dir).startswith('/data/'):
            DATA_DIR = Path(str(raw_data_dir).replace('/data', '/app/data', 1))
        else:
            DATA_DIR = raw_data_dir
    elif basedir.parent == Path('/') or str(basedir) == '/app':
        DATA_DIR = basedir / "data"
    else:
        DATA_DIR = basedir.parent / "data"

    data_dir = DATA_DIR
    db_path = DATA_DIR / "app.db"

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        f'sqlite:///{db_path}'

    # Path for storing uploaded pictograms
    if os.environ.get('PICTOGRAMS_PATH'):
        p_path = Path(os.environ['PICTOGRAMS_PATH'])
        if str(p_path) == '/data/pictograms' or str(p_path).startswith('/data/'):
            p_path = Path(str(p_path).replace('/data', '/app/data', 1))
        PICTOGRAMS_PATH = p_path
    else:
        PICTOGRAMS_PATH = DATA_DIR / "pictograms"

    if os.environ.get('PICTOGRAMS_PATH_MIN'):
        p_path_min = Path(os.environ['PICTOGRAMS_PATH_MIN'])
        if str(p_path_min) == '/data/pictogramsmin' or str(p_path_min).startswith('/data/'):
            p_path_min = Path(str(p_path_min).replace('/data', '/app/data', 1))
        PICTOGRAMS_PATH_MIN = p_path_min
    else:
        PICTOGRAMS_PATH_MIN = DATA_DIR / "pictogramsmin"
    
    # Demo user for unauthenticated mode
    DEMO_USERNAME = os.environ.get('DEMO_USERNAME', 'demo')

    # Upload limits
    MAX_IMAGE_SIZE_KB = int(os.environ.get('MAX_IMAGE_SIZE_KB', '2048'))  # Default to 2MB
    MAX_ITEMS_LIMIT = int(os.environ.get('MAX_ITEMS_LIMIT', '5000'))  # Default to 5000 items

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    LANGUAGES = ('en', 'fr', 'es', 'de', 'it', 'nl', 'pl')

    # Email configuration
    MAIL_SERVER = 'smtp-relay.brevo.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') or 'you-will-never-guess'
    ADMIN_EMAIL = "contact@pictotree.eu"
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or 'contact@pictotree.eu'

    # JWT Configuration
    from datetime import timedelta
    JWT_SECRET_KEY = TOKEN_SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
