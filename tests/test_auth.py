from app.models import User
from app import db
import re

def get_csrf_token(html):
    # Utilise une regex pour extraire le CSRF token depuis l'input caché du formulaire
    match = re.search(r'name="csrf_token" type="hidden" value="([^"]+)"', html)
    return match.group(1) if match else None


def test_register(client):
    # 1. Récupère le formulaire de registre (GET)
    get_response = client.get('/register')
    html = get_response.data.decode()
     # 2. Extrait le CSRF token
    csrf_token = get_csrf_token(html)
    assert csrf_token is not None, "CSRF token not found in form"

    response = client.post('/register', data={
        'username': 'testuser',
        'csrf_token': csrf_token,
        'email': 'test@example.com',
        'password': 'password',
        'password2': 'password'
    }, follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Congratulations, you are now a registered user!' in response.data
    user = User.query.filter_by(username='testuser').first()
    assert user is not None
    assert user.email == 'test@example.com'
    if user:
        db.session.delete(user)
        db.session.commit()


def test_login_logout(client):
    # Register a user first
    get_response = client.get('/register')
    html = get_response.data.decode()
     # 2. Extrait le CSRF token
    csrf_token = get_csrf_token(html)
    assert csrf_token is not None, "CSRF token not found in form"

    client.post('/register', data={
        'username': 'testuser',
        'csrf_token': csrf_token,
        'email': 'test@example.com',
        'password': 'password',
        'password2': 'password'
    })

    # Login
    with client:
        response = client.post('/login', data={
            'username': 'testuser',
            'csrf_token': csrf_token,
            'password': 'password'
        }, follow_redirects=True)
        assert response.status_code == 200
        assert b'Hi, testuser!' in response.data
        user = User.query.filter_by(username='testuser').first()
        assert b'Logout' in response.data

        # Logout
        response = client.get('/logout', follow_redirects=True)
        assert response.status_code == 200
        assert b'Hi, testuser!' not in response.data
        assert b'Login' in response.data
        if user:
            db.session.delete(user)
            db.session.commit()
