from app.models import User

def test_register(client):
    response = client.post('/register', data={
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'password',
        'password2': 'password'
    })
    assert response.status_code == 302 # Should redirect to login
    user = User.query.filter_by(username='testuser').first()
    assert user is not None
    assert user.email == 'test@example.com'

    response = client.get(response.location) # Follow the redirect
    assert b'Congratulations, you are now a registered user!' in response.data

def test_login_logout(client):
    # Register a user first
    client.post('/register', data={
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'password',
        'password2': 'password'
    })

    # Login
    with client:
        response = client.post('/login', data={
            'username': 'testuser',
            'password': 'password'
        }, follow_redirects=True)
        assert response.status_code == 200
        assert b'Hi, testuser!' in response.data
        assert b'Logout' in response.data

        # Logout
        response = client.get('/logout', follow_redirects=True)
        assert response.status_code == 200
        assert b'Hi, testuser!' not in response.data
        assert b'Login' in response.data
