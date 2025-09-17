import os
import shutil
from io import BytesIO
from PIL import Image as PILImage
from pathlib import Path
import pytest
from app.models import Folder, Image
from app import db
from tests.conftest import create_user, login, confirm_user


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
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')
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
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')

    response = client.get('/api/pictograms')
    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == user.username
    assert data['type'] == 'folder'
    assert 'children' in data

# --- POST /api/folder/create ---

def test_create_folder_success(client, app):
    """Test successful folder creation."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')

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
    new_folder = db.session.get(Folder, data['folder']['id'])
    assert new_folder is not None
    assert new_folder.name == 'New Folder'
    # Verify physical directory was created
    physical_path = Path(app.config['PICTOGRAMS_PATH']) / new_folder.path
    assert physical_path.exists()

def test_create_folder_invalid_parent(client):
    """Test creating a folder with an invalid parent ID."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')

    response = client.post('/api/folder/create', json={
        'name': 'New Folder',
        'parent_id': 999
    })
    assert response.status_code == 404
    data = response.get_json()
    assert data['status'] == 'error'

def test_create_folder_missing_name(client):
    """Test creating a folder with no name."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    response = client.post('/api/folder/create', json={
        'name': '',
        'parent_id': root_folder.id
    })
    # This should be handled by client-side validation, but the API should be robust
    # Assuming the API rejects it, adjust if the backend logic is different.
    assert response.status_code == 400

# --- POST /api/image/upload ---

def test_upload_image_success(client, app):
    """Test successful image upload."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')
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
    image = db.session.get(Image, json_data['image']['id'])
    assert image is not None
    physical_path = Path(app.config['PICTOGRAMS_PATH']) / image.path
    assert physical_path.exists()

def test_upload_image_no_file(client):
    """Test uploading with no file part."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    response = client.post('/api/image/upload', data={'folder_id': root_folder.id}, content_type='multipart/form-data')
    assert response.status_code == 400

def test_upload_image_to_invalid_folder(client):
    """Test uploading an image to a non-existent folder."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')

    data = {
        'folder_id': 999,
        'file': (BytesIO(b"test_image_content"), 'test.jpg')
    }
    response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 404

# --- DELETE /api/item/delete ---

def test_delete_image_success(client, app):
    """Test successful deletion of an image."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    # First, upload an image
    img = PILImage.new('RGB', (10, 10))
    img_io = BytesIO()
    img.save(img_io, 'JPEG')
    img_io.seek(0)
    data = {'folder_id': root_folder.id, 'file': (img_io, 'delete_me.jpg')}
    upload_response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')
    image_id = upload_response.get_json()['image']['id']
    image = db.session.get(Image, image_id)
    physical_path = Path(app.config['PICTOGRAMS_PATH']) / image.path
    assert physical_path.exists()

    # Now, delete it
    delete_response = client.delete('/api/item/delete', json={'id': image_id, 'type': 'image'})
    assert delete_response.status_code == 200
    assert delete_response.get_json()['status'] == 'success'

    # Verify it's gone from DB and filesystem
    assert db.session.get(Image, image_id) is None
    assert not physical_path.exists()

def test_delete_folder_success(client, app):
    """Test successful deletion of a folder and its contents."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    # Create a subfolder
    create_response = client.post('/api/folder/create', json={'name': 'Subfolder', 'parent_id': root_folder.id})
    subfolder_id = create_response.get_json()['folder']['id']
    subfolder = db.session.get(Folder, subfolder_id)
    subfolder_path = Path(app.config['PICTOGRAMS_PATH']) / subfolder.path
    assert subfolder_path.exists()

    # Upload an image into the subfolder
    data = {'folder_id': subfolder_id, 'file': (BytesIO(b"content"), 'image_in_sub.jpg')}
    upload_response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')
    image_id = upload_response.get_json()['image']['id']
    image = db.session.get(Image, image_id)
    image_path = Path(app.config['PICTOGRAMS_PATH']) / image.path
    assert image_path.exists()

    # Now, delete the subfolder
    delete_response = client.delete('/api/item/delete', json={'id': subfolder_id, 'type': 'folder'})
    assert delete_response.status_code == 200
    assert delete_response.get_json()['status'] == 'success'

    # Verify folder and image are gone
    assert db.session.get(Folder, subfolder_id) is None
    assert db.session.get(Image, image_id) is None
    assert not subfolder_path.exists()
    assert not image_path.exists()

def test_delete_root_folder_fails(client):
    """Test that deleting the root folder is not allowed."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    delete_response = client.delete('/api/item/delete', json={'id': root_folder.id, 'type': 'folder'})
    assert delete_response.status_code == 400
    assert 'Cannot delete root folder' in delete_response.get_json()['message']

# --- PUT /api/image/<id> ---

def test_update_image_details_success(client):
    """Test that a user can update their own image's details."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')
    root_folder = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    # Upload an image to get an ID
    data = {'folder_id': root_folder.id, 'file': (BytesIO(b"content"), 'image_to_update.jpg')}
    upload_response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')
    image_id = upload_response.get_json()['image']['id']

    # Now, update its details
    update_payload = {
        'description': 'A new description',
        'is_public': True
    }
    update_response = client.put(f'/api/image/{image_id}', json=update_payload)

    assert update_response.status_code == 200
    json_data = update_response.get_json()
    assert json_data['status'] == 'success'
    assert json_data['image']['description'] == 'A new description'
    assert json_data['image']['is_public'] is True

    # Verify in the database
    updated_image = db.session.get(Image, image_id)
    assert updated_image.description == 'A new description'
    assert updated_image.is_public is True

def test_update_image_details_unauthorized(client):
    """Test that a user cannot update another user's image."""
    # Create owner and hacker
    owner = create_user(client, 'owner', 'Password123', 'owner@test.com')
    confirm_user(client, owner.email)
    hacker = create_user(client, 'hacker', 'Password123', 'hacker@test.com')
    confirm_user(client, hacker.email)

    # Owner logs in and uploads an image
    login(client, 'owner', 'Password123')
    root_folder_owner = Folder.query.filter_by(user_id=owner.id).first()
    data = {'folder_id': root_folder_owner.id, 'file': (BytesIO(b"content"), 'owned_image.jpg')}
    upload_response = client.post('/api/image/upload', data=data, content_type='multipart/form-data')
    image_id = upload_response.get_json()['image']['id']
    client.get('/logout') # Logout owner

    # Hacker logs in and attempts to update the image
    login(client, 'hacker', 'Password123')
    update_payload = {'description': 'hacked'}
    update_response = client.put(f'/api/image/{image_id}', json=update_payload)

    assert update_response.status_code == 403

def test_update_image_details_not_found(client):
    """Test updating a non-existent image."""
    user = create_user(client, 'testuser_pictogram', 'Password123')
    confirm_user(client, user.email)
    login(client, 'testuser_pictogram', 'Password123')

    update_response = client.put('/api/image/99999', json={'description': 'test'})
    assert update_response.status_code == 404

def test_update_image_details_unauthenticated(client):
    """Test that an unauthenticated user cannot update an image."""
    # No login
    update_response = client.put('/api/image/1', json={'description': 'test'})
    assert update_response.status_code == 401
