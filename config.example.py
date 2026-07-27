import os
from pathlib import Path

# The base directory of the application
basedir = Path(__file__).parent.resolve()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'
    RECAPTCHA_PUBLIC_KEY = os.environ.get('RECAPTCHA_PUBLIC_KEY') or 'your-recaptcha-public-key'
    RECAPTCHA_PRIVATE_KEY = os.environ.get('RECAPTCHA_PRIVATE_KEY') or 'your-recaptcha-private-key'

    # Determine base data directory:
    # 1. Environment variable DATA_DIR if set
    # 2. Local basedir / "data" if it exists (e.g. /app/data inside Docker container)
    # 3. Fallback to sibling basedir.parent / "data" (e.g. ../data in local dev)
    if os.environ.get('DATA_DIR'):
        DATA_DIR = Path(os.environ['DATA_DIR'])
    elif (basedir / "data").exists():
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
        if str(p_path) == '/data/pictograms' and not p_path.parent.exists() and (basedir / "data").exists():
            p_path = basedir / "data" / "pictograms"
        PICTOGRAMS_PATH = p_path
    else:
        PICTOGRAMS_PATH = DATA_DIR / "pictograms"

    if os.environ.get('PICTOGRAMS_PATH_MIN'):
        p_path_min = Path(os.environ['PICTOGRAMS_PATH_MIN'])
        if str(p_path_min) == '/data/pictogramsmin' and not p_path_min.parent.exists() and (basedir / "data").exists():
            p_path_min = basedir / "data" / "pictogramsmin"
        PICTOGRAMS_PATH_MIN = p_path_min
    else:
        PICTOGRAMS_PATH_MIN = DATA_DIR / "pictogramsmin"
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
