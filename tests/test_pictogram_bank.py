import os
import re
import shutil
from io import BytesIO

import pytest
from app.models import User, Folder, Image
from app import db

# Helper function to extract CSRF token
def get_csrf_token(html):
    match = re.search(r'name="csrf_token" type="hidden" value="([^"]+)"', html)
    return match.group(1) if match else None

# Helper function for user login
def login(client, username, password):
    get_response = client.get('/login')
    csrf_token = get_csrf_token(get_response.data.decode())
    return client.post('/login', data=dict(
        username=username,
        password=password,
        csrf_token=csrf_token
    ), follow_redirects=True)

# Helper function to create a test user
def create_user(client, username='testuser', password='password'):
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data=dict(
        username=username,
        email=f'{username}@test.com',
        password=password,
        password2=password,
        csrf_token=csrf_token
    ), follow_redirects=True)
    return User.query.filter_by(username=username).first()

@pytest.fixture(autouse=True)
def cleanup_files():
    """Ensure the user's test directory is cleaned up before and after tests."""
    # Run before the test
    user_path = os.path.join('app', 'static', 'images', 'pictograms', 'testuser_pictogram')
    if os.path.exists(user_path):
        shutil.rmtree(user_path)

    yield # This is where the test runs

    # Run after the test
    if os.path.exists(user_path):
        shutil.rmtree(user_path)

# -----------------------------------------------------------------------------
# Tests for the main /pictogram-bank page
# -----------------------------------------------------------------------------

def test_pictogram_bank_unauthenticated(client):
    """Test that an unauthenticated user is redirected to the login page."""
    response = client.get('/pictogram-bank')
    assert response.status_code == 302 # Redirect
    assert '/login' in response.location

def test_pictogram_bank_authenticated(client):
    """Test that an authenticated user can access the pictogram bank."""
    create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')
    response = client.get('/pictogram-bank')
    assert response.status_code == 200
    assert b'My Pictograms' in response.data

# -----------------------------------------------------------------------------
# Tests for API endpoints
# -----------------------------------------------------------------------------

# --- GET /api/pictograms ---

def test_get_pictograms_unauthenticated(client):
    """Test that an unauthenticated user cannot access pictograms."""
    response = client.get('/api/pictograms')
    assert response.status_code == 401 # Unauthorized

def test_get_pictograms_authenticated(client):
    """Test that an authenticated user can fetch their pictogram structure."""
    user = create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')

    response = client.get('/api/pictograms')
    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == user.username
    assert data['type'] == 'folder'
    assert 'children' in data

# --- POST /api/folder/create ---

def test_create_folder_success(client):
    """Test successful folder creation."""
    user = create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')

    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()
    assert root_folder is not None

    response = client.post('/api/folder/create', json={
        'name': 'New Folder',
        'parent_id': root_folder.id
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['folder']['name'] == 'New Folder'
    assert data['folder']['parent_id'] == root_folder.id

    # Verify the folder was created in the database
    new_folder = Folder.query.get(data['folder']['id'])
    assert new_folder is not None
    assert new_folder.name == 'New Folder'
    # Verify physical directory was created
    assert os.path.exists(new_folder.path)

def test_create_folder_invalid_parent(client):
    """Test creating a folder with an invalid parent ID."""
    create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')

    response = client.post('/api/folder/create', json={
        'name': 'New Folder',
        'parent_id': 999
    })
    assert response.status_code == 404
    data = response.get_json()
    assert data['status'] == 'error'

def test_create_folder_missing_name(client):
    """Test creating a folder with no name."""
    user = create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    response = client.post('/api/folder/create', json={
        'name': '',
        'parent_id': root_folder.id
    })
    # This should be handled by client-side validation, but the API should be robust
    # Assuming the API rejects it, adjust if the backend logic is different.
    assert response.status_code == 400

# --- POST /api/image/upload ---

def test_upload_image_success(client):
    """Test successful image upload."""
    user = create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    data = {
        'folder_id': root_folder.id,
        'file': (BytesIO(b"test_image_content"), 'test.jpg')
    }
    response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')

    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data['status'] == 'success'
    assert json_data['image']['name'] == 'test.jpg'

    # Verify image in DB and file system
    image = Image.query.get(json_data['image']['id'])
    assert image is not None
    assert os.path.exists(image.path)

def test_upload_image_no_file(client):
    """Test uploading with no file part."""
    user = create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    response = client.post('/api/image/upload', data={'folder_id': root_folder.id}, content_type='multipart/form-data')
    assert response.status_code == 400

def test_upload_image_to_invalid_folder(client):
    """Test uploading an image to a non-existent folder."""
    create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')

    data = {
        'folder_id': 999,
        'file': (BytesIO(b"test_image_content"), 'test.jpg')
    }
    response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 404

# --- DELETE /api/item/delete ---

def test_delete_image_success(client):
    """Test successful deletion of an image."""
    user = create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    # First, upload an image
    data = {'folder_id': root_folder.id, 'file': (BytesIO(b"content"), 'delete_me.jpg')}
    upload_response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')
    image_id = upload_response.get_json()['image']['id']
    image_path = Image.query.get(image_id).path
    assert os.path.exists(image_path)

    # Now, delete it
    delete_response = client.delete('/api/item/delete', json={'id': image_id, 'type': 'image'})
    assert delete_response.status_code == 200
    assert delete_response.get_json()['status'] == 'success'

    # Verify it's gone from DB and filesystem
    assert Image.query.get(image_id) is None
    assert not os.path.exists(image_path)

def test_delete_folder_success(client):
    """Test successful deletion of a folder and its contents."""
    user = create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    # Create a subfolder
    create_response = client.post('/api/folder/create', json={'name': 'Subfolder', 'parent_id': root_folder.id})
    subfolder_id = create_response.get_json()['folder']['id']
    subfolder_path = Folder.query.get(subfolder_id).path
    assert os.path.exists(subfolder_path)

    # Upload an image into the subfolder
    data = {'folder_id': subfolder_id, 'file': (BytesIO(b"content"), 'image_in_sub.jpg')}
    upload_response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')
    image_id = upload_response.get_json()['image']['id']
    image_path = Image.query.get(image_id).path
    assert os.path.exists(image_path)

    # Now, delete the subfolder
    delete_response = client.delete('/api/item/delete', json={'id': subfolder_id, 'type': 'folder'})
    assert delete_response.status_code == 200
    assert delete_response.get_json()['status'] == 'success'

    # Verify folder and image are gone
    assert Folder.query.get(subfolder_id) is None
    assert Image.query.get(image_id) is None
    assert not os.path.exists(subfolder_path)
    assert not os.path.exists(image_path)

def test_delete_root_folder_fails(client):
    """Test that deleting the root folder is not allowed."""
    user = create_user(client, 'testuser_pictogram', 'password')
    login(client, 'testuser_pictogram', 'password')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    delete_response = client.delete('/api/item/delete', json={'id': root_folder.id, 'type': 'folder'})
    assert delete_response.status_code == 400
    assert 'Cannot delete root folder' in delete_response.get_json()['message']
