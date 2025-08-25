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
    assert response.status_code == 200
    assert b'Tree Builder' in response.data

import json
import re
from app.models import User, Image, db

def test_builder_page_loads_images(client):
    response = client.get('/builder')
    assert response.status_code == 200
    assert b'images-data' in response.data
    # Check for a specific image that should be public
    assert b'acorn-bold' in response.data

def get_images_from_response(response):
    """Extracts the images_json data from the HTML response."""
    html = response.data.decode()
    # Use a non-greedy match to find the content of the script tag
    match = re.search(r'<script id="images-data" type="application/json">(.*?)</script>', html, re.DOTALL)
    if not match:
        # Try finding the all_images_json for the list page
        match = re.search(r'<script id="all-images-data" type="application/json">(.*?)</script>', html, re.DOTALL)
        if not match:
            return []

    # The matched group contains the JSON string, which needs to be parsed
    return json.loads(match.group(1))

def login(client, username, password):
    get_response = client.get('/login')
    # A simple CSRF token extractor for tests
    csrf_token_match = re.search(r'name="csrf_token" type="hidden" value="([^"]+)"', get_response.data.decode())
    csrf_token = csrf_token_match.group(1) if csrf_token_match else ''
    return client.post('/login', data={'username': username, 'password': password, 'csrf_token': csrf_token}, follow_redirects=True)

def logout(client):
    return client.get('/logout', follow_redirects=True)

def test_image_loading_security(client, app):
    """
    Tests that the builder and list pages only load images that the current
    user is authorized to see.
    """
    with app.app_context():
        # Create users
        user1 = User(username='user1', email='u1@test.com')
        user1.set_password('p')
        user2 = User(username='user2', email='u2@test.com')
        user2.set_password('p')
        db.session.add_all([user1, user2])
        db.session.commit()

        # Create images
        img_global_public = Image(id=99991, name='global_public', user_id=None, is_public=True)
        img_user1_public = Image(id=99992, name='user1_public', user_id=user1.id, is_public=True)
        img_user1_private = Image(id=99993, name='user1_private', user_id=user1.id, is_public=False)
        img_user2_private = Image(id=99994, name='user2_private', user_id=user2.id, is_public=False)
        db.session.add_all([img_global_public, img_user1_public, img_user1_private, img_user2_private])
        db.session.commit()

    # --- Test for unauthenticated user ---
    for page in ['/builder', '/list']:
        res_unauth = client.get(page)
        images_unauth = get_images_from_response(res_unauth)
        image_names_unauth = {img['name'] for img in images_unauth}

        assert 'global_public' in image_names_unauth
        assert 'user1_public' in image_names_unauth
        assert 'user1_private' not in image_names_unauth
        assert 'user2_private' not in image_names_unauth

    # --- Test for user1 ---
    login(client, 'user1', 'p')
    for page in ['/builder', '/list']:
        res_user1 = client.get(page)
        images_user1 = get_images_from_response(res_user1)
        image_names_user1 = {img['name'] for img in images_user1}

        # User1 should see public images and their own private image
        assert 'global_public' in image_names_user1
        assert 'user1_public' in image_names_user1
        assert 'user1_private' in image_names_user1
        # User1 should NOT see user2's private image
        assert 'user2_private' not in image_names_user1

    # --- Test for user2 ---
    logout(client)
    login(client, 'user2', 'p')
    for page in ['/builder', '/list']:
        res_user2 = client.get(page)
        images_user2 = get_images_from_response(res_user2)
        image_names_user2 = {img['name'] for img in images_user2}

        # User2 should see public images and their own private image
        assert 'global_public' in image_names_user2
        assert 'user1_public' in image_names_user2
        assert 'user2_private' in image_names_user2
        # User2 should NOT see user1's private image
        assert 'user1_private' not in image_names_user2
