import pytest
import re
from app.models import User

def get_csrf_token(html):
    """Extracts CSRF token from HTML."""
    match = re.search(r'name="csrf_token" type="hidden" value="([^"]+)"', html)
    return match.group(1) if match else None

def login(client, username, password):
    """Helper function to log in a user, handling CSRF token."""
    get_response = client.get('/login')
    csrf_token = get_csrf_token(get_response.data.decode())
    return client.post('/login', data=dict(
        username=username,
        password=password,
        csrf_token=csrf_token
    ), follow_redirects=True)

def register_and_login(client, username, password):
    """Helper function to register and then log in a user, handling CSRF."""
    # Get registration page to extract CSRF token
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())

    # Register the user
    client.post('/register', data=dict(
        username=username,
        email=f'{username}@test.com',
        password=password,
        password2=password,
        csrf_token=csrf_token
    ), follow_redirects=True)

    # Login the user
    return login(client, username, password)

def test_list_page_loads_for_unauthenticated_user(client):
    """
    GIVEN a Flask application configured for testing
    WHEN the '/list' page is requested by an unauthenticated user
    THEN check that the page loads successfully
    """
    response = client.get('/list')
    assert response.status_code == 200
    assert b'Chained List Builder' in response.data
    assert b'Select from Tree' in response.data

def test_list_page_loads_for_authenticated_user(client):
    """
    GIVEN a Flask application configured for testing
    WHEN a logged-in user requests the '/list' page
    THEN check that the page loads successfully
    """
    register_and_login(client, 'testuser', 'password')
    response = client.get('/list')
    assert response.status_code == 200
    assert b'Chained List Builder' in response.data
    assert b'Select from Tree' in response.data

def test_list_page_context_data_for_unauthenticated_user(client):
    """
    GIVEN a Flask application
    WHEN the '/list' page is loaded by an unauthenticated user
    THEN check that the initial data for the frontend is present
    """
    response = client.get('/list')
    assert response.status_code == 200

    # Check for the presence of the script tags containing the JSON data
    response_data = response.data.decode('utf-8')
    assert '<script id="initial-tree-data" type="application/json">' in response_data
    assert '<script id="images-data" type="application/json">' in response_data

    # Check that the content of the scripts looks like JSON
    import re
    tree_data_match = re.search(r'<script id="initial-tree-data"[^>]*>([\s\S]*?)</script>', response_data)
    images_data_match = re.search(r'<script id="images-data"[^>]*>([\s\S]*?)</script>', response_data)

    assert tree_data_match is not None
    # The data should be a list (even if empty)
    assert tree_data_match.group(1).strip().startswith('[')

    assert images_data_match is not None
    # The page should load all images for the list builder to use
    assert '"id":' in images_data_match.group(1)
    assert '"name":' in images_data_match.group(1)
