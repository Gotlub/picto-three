"""Fail closed before importing the application's factory or configuration."""

import os
from pathlib import Path

DATA = Path('/e2e-data')

if os.environ.get('PICTOTREE_E2E') != '1' or not Path('/.dockerenv').exists():
    raise RuntimeError('The E2E application must run in its dedicated Docker stack')
if not DATA.is_mount() or DATA.resolve() != DATA:
    raise RuntimeError('/e2e-data must be a dedicated mount, not a code directory')
if Path('/app/.env').exists():
    raise RuntimeError('Refusing an E2E image containing the application .env')

CONFIG = {
    'TESTING': True,
    'DATA_DIR': DATA,
    'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg2://e2e:e2e-only-password@db-e2e:5432/pictotree_e2e',
    'PICTOGRAMS_PATH': DATA / 'pictograms',
    'PICTOGRAMS_PATH_MIN': DATA / 'pictogramsmin',
    'SECRET_KEY': 'e2e-only-session-key-not-for-deployment',
    'TOKEN_SECRET_KEY': 'e2e-only-confirmation-key-not-for-deployment',
    'JWT_SECRET_KEY': 'e2e-only-jwt-key-not-for-deployment',
    'WTF_CSRF_ENABLED': True,
    'MAIL_SUPPRESS_SEND': True,
    'MAIL_SERVER': 'localhost',
    'MAIL_USERNAME': None,
    'MAIL_PASSWORD': None,
    'MAIL_DEFAULT_SENDER': 'e2e@example.test',
    'RECAPTCHA_PUBLIC_KEY': None,
    'RECAPTCHA_PRIVATE_KEY': None,
    'DEMO_USERNAME': 'e2e_demo',
    'MAX_ITEMS_LIMIT': 100,
    'MAX_IMAGE_SIZE_KB': 2048,
}

# Config computes derived paths at import time. Reject inherited real targets too.
for key, expected in {
    'DATABASE_URL': CONFIG['SQLALCHEMY_DATABASE_URI'],
    'DATA_DIR': str(DATA),
    'PICTOGRAMS_PATH': str(CONFIG['PICTOGRAMS_PATH']),
    'PICTOGRAMS_PATH_MIN': str(CONFIG['PICTOGRAMS_PATH_MIN']),
}.items():
    if key in os.environ and os.environ[key] != expected:
        raise RuntimeError(f'Refusing inherited {key} outside E2E configuration')
    os.environ[key] = expected
