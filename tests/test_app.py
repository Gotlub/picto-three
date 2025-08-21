from tests.conftest import get_csrf_token, login, confirm_user

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
    assert response.status_code == 302
    assert '/login' in response.location

def test_builder_page_loads_images(client):
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    login(client, 'testuser', 'Password123')
    confirm_user(client, 'test@test.com')

    response = client.get('/builder')
    assert response.status_code == 200
    assert b'images-data' in response.data
    # Check for a specific image that should be public
    assert b'acorn-bold' in response.data
