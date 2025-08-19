from app.models import User
from app import db
import re

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

def test_app_config(app):
    assert app.config["TESTING"] is True
    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///test.db"

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
        'password': 'Password123',
        'password2': 'Password123'
    }, follow_redirects=True)
    
    assert response.status_code == 200
    assert b'Congratulations, you are now a registered user!' in response.data
    user = User.query.filter_by(username='testuser').first()
    assert user is not None
    assert user.email == 'test@example.com'
    #if user:
        #db.session.delete(user)
        #db.session.commit()


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
        'password': 'Password123',
        'password2': 'Password123'
    })

    # Login
    with client:
        response = client.post('/login', data={
            'username': 'testuser',
            'csrf_token': csrf_token,
            'password': 'Password123'
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
        #if user:
        #    db.session.delete(user)
        #    db.session.commit()

def test_password_strength_and_account_deletion(client):
    # 1. Test registration with a weak password
    get_response = client.get('/register')
    html = get_response.data.decode()
    csrf_token = get_csrf_token(html)
    assert csrf_token is not None, "CSRF token not found in form"

    response = client.post('/register', data={
        'username': 'weakpassworduser',
        'csrf_token': csrf_token,
        'email': 'weak@example.com',
        'password': 'password',
        'password2': 'password'
    }, follow_redirects=True)

    assert b'Congratulations, you are now a registered user!' not in response.data
    assert b'Password must' in response.data
    user = User.query.filter_by(username='weakpassworduser').first()
    assert user is None

    # 2. Test registration with a strong password
    get_response = client.get('/register')
    html = get_response.data.decode()
    csrf_token = get_csrf_token(html)
    response = client.post('/register', data={
        'username': 'strongpassworduser',
        'csrf_token': csrf_token,
        'email': 'strong@example.com',
        'password': 'StrongPassword123',
        'password2': 'StrongPassword123'
    }, follow_redirects=True)

    assert b'Congratulations, you are now a registered user!' in response.data
    user = User.query.filter_by(username='strongpassworduser').first()
    assert user is not None

    # 3. Test account deletion
    with client:
        # Login as the new user
        login_response = login(client, 'strongpassworduser', 'StrongPassword123')
        assert b'Logout' in login_response.data

        # Get CSRF token from a form on a protected page (e.g., account page)
        account_page_response = client.get('/account')
        delete_csrf_token = get_csrf_token(account_page_response.data.decode())
        assert delete_csrf_token is not None

        # Post to delete account
        delete_response = client.post('/delete_account', data={
            'username_confirm': 'strongpassworduser',
            'csrf_token': delete_csrf_token
        }, follow_redirects=True)

        assert b'Your account has been successfully deleted.' in delete_response.data
        deleted_user = User.query.filter_by(username='strongpassworduser').first()
        assert deleted_user is None
