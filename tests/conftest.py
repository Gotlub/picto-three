import pytest
from app import create_app, db
import re
from pathlib import Path
import shutil
from app.utils import generate_confirmation_token
from app.models import User

@pytest.fixture
def app():
    # A temporary directory for test-generated pictograms
    test_pictos_path = Path(__file__).parent / 'test_pictos'
    if test_pictos_path.exists():
        shutil.rmtree(test_pictos_path)
    test_pictos_path.mkdir()

    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///test.db",
        "PICTOGRAMS_PATH": str(test_pictos_path) # Override the pictogram path for tests
    })

    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

    # Cleanup the test pictograms directory
    shutil.rmtree(test_pictos_path)

from app.models import Image

@pytest.fixture
def client(app):
    with app.app_context():
        # Add a test image
        image = Image(name='acorn-bold', path='public/bold/acorn-bold.png', is_public=True)
        db.session.add(image)
        db.session.commit()
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()

def get_csrf_token(html):
    # Utilise une regex pour extraire le CSRF token depuis l'input caché du formulaire
    match = re.search(r'name="csrf_token" type="hidden" value="([^"]+)"', html)
    return match.group(1) if match else None

def login(client, username, password):
    get_response = client.get('/login')
    csrf_token = get_csrf_token(get_response.data.decode())
    return client.post('/login', data=dict(
        username=username,
        password=password,
        csrf_token=csrf_token
    ), follow_redirects=True)

def confirm_user(client, email):
    """Helper function to confirm a user's email."""
    token = generate_confirmation_token(email)
    return client.get(f'/confirm/{token}', follow_redirects=True)

def create_user(client, username='testuser', password='Password123', email=None):
    """Helper function to create a test user."""
    if email is None:
        email = f'{username}@test.com'
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data=dict(
        username=username,
        email=email,
        password=password,
        password2=password,
        csrf_token=csrf_token
    ), follow_redirects=True)
    return User.query.filter_by(username=username).first()
