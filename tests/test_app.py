def test_index(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'Welcome to Pictogram-Tree Builder' in response.data

def test_login_page(client):
    response = client.get('/login')
    assert response.status_code == 200
    assert b'Sign In' in response.data

def test_register_page(client):
    response = client.get('/register')
    assert response.status_code == 200
    assert b'Register' in response.data

def test_builder_page_unauthenticated(client):
    response = client.get('/builder')
    assert response.status_code == 302 # Redirect to login
    assert b'Redirecting...' in response.data
    assert b'/login' in response.data
