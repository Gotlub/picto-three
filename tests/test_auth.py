from app.models import User
from app import db
import pytest
from app import utils
from app.utils import generate_confirmation_token, generate_password_reset_token
from tests.conftest import get_csrf_token, login, confirm_user, create_user

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
        'password2': 'Password123',
        'accept_terms': 'y'
    }, follow_redirects=True)
    
    assert response.status_code == 200
    assert 'A confirmation email has been sent to your email address.' in response.data.decode('utf-8')
    user = User.query.filter_by(username='testuser').first()
    assert user is not None
    assert user.email == 'test@example.com'


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
        'password2': 'Password123',
        'accept_terms': 'y'
    })
    confirm_user(client, 'test@example.com')

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

def test_login_unconfirmed_user(client):
    # Register a user
    create_user(client, 'unconfirmedlogin', 'Password123', 'unconfirmedlogin@test.com')

    # Try to login
    get_response = client.get('/login')
    csrf_token = get_csrf_token(get_response.data.decode())
    response = client.post('/login', data={
        'username': 'unconfirmedlogin',
        'password': 'Password123',
        'csrf_token': csrf_token
    }, follow_redirects=True)

    assert response.status_code == 200
    assert 'Your account is not confirmed.' in response.data.decode('utf-8')
    assert b'Hi, unconfirmedlogin!' not in response.data

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
        'password2': 'password',
        'accept_terms': 'y'
    }, follow_redirects=True)

    assert 'A confirmation email has been sent to your email address.' not in response.data.decode('utf-8')
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
        'password2': 'StrongPassword123',
        'accept_terms': 'y'
    }, follow_redirects=True)

    assert 'A confirmation email has been sent to your email address.' in response.data.decode('utf-8')
    user = User.query.filter_by(username='strongpassworduser').first()
    assert user is not None

    # 3. Test account deletion
    with client:
        # Confirm the user
        confirm_user(client, 'strong@example.com')

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

def test_registration_sends_confirmation_email(client, monkeypatch):
    sent_emails = []
    def mock_send_email(to, subject, template, **kwargs):
        sent_emails.append({'to': to, 'subject': subject, 'template': template, 'kwargs': kwargs})

    monkeypatch.setattr('app.routes.auth.send_email', mock_send_email)

    get_response = client.get('/register')
    html = get_response.data.decode()
    csrf_token = get_csrf_token(html)

    client.post('/register', data={
        'username': 'confirmuser',
        'csrf_token': csrf_token,
        'email': 'confirm@example.com',
        'password': 'Password123',
        'password2': 'Password123',
        'accept_terms': 'y'
    }, follow_redirects=True)

    user = User.query.filter_by(username='confirmuser').first()
    assert user is not None
    assert not user.confirmed
    assert len(sent_emails) == 1
    assert sent_emails[0]['to'] == 'confirm@example.com'
    assert 'Confirm Your Account' in sent_emails[0]['subject']

def test_email_confirmation(client):
    # Register user first (without mocking email)
    get_response = client.get('/register')
    html = get_response.data.decode()
    csrf_token = get_csrf_token(html)
    client.post('/register', data={
        'username': 'confirmuser2',
        'csrf_token': csrf_token,
        'email': 'confirm2@example.com',
        'password': 'Password123',
        'password2': 'Password123',
        'accept_terms': 'y'
    })
    user = User.query.filter_by(email='confirm2@example.com').first()
    assert user is not None
    assert not user.confirmed

    # Generate a token and confirm
    response = confirm_user(client, user.email)

    assert 'Your account has been confirmed successfully!' in response.data.decode('utf-8')
    db.session.refresh(user)
    assert user.confirmed

def test_password_reset_flow(client, monkeypatch):
    # 1. Register a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={
        'username': 'resetuser',
        'csrf_token': csrf_token,
        'email': 'reset@example.com',
        'password': 'OldPassword123',
        'password2': 'OldPassword123',
        'accept_terms': 'y'
    })
    user = User.query.filter_by(email='reset@example.com').first()
    assert user is not None

    # 2. Request a password reset
    sent_emails = []
    def mock_send_email(to, subject, template, **kwargs):
        sent_emails.append({'to': to, 'subject': subject, 'template': template, 'kwargs': kwargs})
    monkeypatch.setattr('app.routes.auth.send_email', mock_send_email)

    get_response = client.get('/forgot_password')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/forgot_password', data={
        'email': 'reset@example.com',
        'csrf_token': csrf_token
    }, follow_redirects=True)

    assert len(sent_emails) == 1
    assert 'Reset Your Password' in sent_emails[0]['subject']

    # 3. Use the token to reset the password
    token = generate_password_reset_token(user.email)
    get_response = client.get(f'/reset/{token}')
    csrf_token = get_csrf_token(get_response.data.decode())

    response = client.post(f'/reset/{token}', data={
        'password': 'NewPassword123',
        'password2': 'NewPassword123',
        'csrf_token': csrf_token
    }, follow_redirects=True)

    assert 'Your password has been reset successfully.' in response.data.decode('utf-8')
    db.session.refresh(user)
    assert user.check_password('NewPassword123')
    assert not user.check_password('OldPassword123')

def test_resend_confirmation_request(client, monkeypatch):
    # 1. Register a user
    create_user(client, 'resendrequest', 'Password123', 'resendrequest@test.com')

    # 2. Mock email sending
    sent_emails = []
    def mock_send_email(to, subject, template, **kwargs):
        sent_emails.append({'to': to, 'subject': subject, 'template': template, 'kwargs': kwargs})
    monkeypatch.setattr('app.routes.auth.send_email', mock_send_email)

    # 3. Request resend
    get_response = client.get('/resend_confirmation_request')
    csrf_token = get_csrf_token(get_response.data.decode())
    response = client.post('/resend_confirmation_request', data={
        'email': 'resendrequest@test.com',
        'csrf_token': csrf_token
    }, follow_redirects=True)

    # 4. Verify email was sent and user was redirected
    assert response.status_code == 200
    assert len(sent_emails) == 1
    assert sent_emails[0]['to'] == 'resendrequest@test.com'
    assert 'A new confirmation email has been sent.' in response.data.decode('utf-8')
