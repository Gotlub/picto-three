import pytest
from app.models import User
from app import db

def test_register(client):
    response = client.post('/register', data={
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'password',
        'password2': 'password'
    }, follow_redirects=True)
    assert response.status_code == 200
    assert b'Congratulations, you are now a registered user!' in response.data

    # Check that the user was actually created
    with client.application.app_context():
        user = User.query.filter_by(username='testuser').first()
        assert user is not None
        assert user.email == 'test@example.com'

def test_login_logout(client, app):
    # Create a user directly in the database
    with app.app_context():
        user = User(username='loginuser', email='login@example.com')
        user.set_password('password')
        db.session.add(user)
        db.session.commit()

    # Login
    with client:
        response = client.post('/login', data={
            'username': 'loginuser',
            'password': 'password'
        }, follow_redirects=True)
        assert response.status_code == 200
        assert b'Logout' in response.data
        assert b'Login' not in response.data

        # Logout
        response = client.get('/logout', follow_redirects=True)
        assert response.status_code == 200
        assert b'Login' in response.data
        assert b'Logout' not in response.data
