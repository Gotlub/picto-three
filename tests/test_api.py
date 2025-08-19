import json
import pytest
import os
from PIL import Image as PILImage
from app.models import User, Tree, PictogramList, Image
from app import db

import re

def get_csrf_token(html):
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

def logout(client):
    return client.get('/logout', follow_redirects=True)

def create_image(id, user_id=None, name='Test Image'):
    """Helper function to create an image in the database."""
    # is_public is derived from user_id for these tests
    image = Image(id=id, name=name, path=f'/fake/path/{id}', user_id=user_id, is_public=user_id is None)
    db.session.add(image)
    return image

def test_save_tree_unauthenticated(client):
    response = client.post('/api/tree/save', json={})
    assert response.status_code == 401 # Unauthorized

def test_save_tree_authenticated(client):
    # Register a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    # Login
    login(client, 'testuser', 'Password123')

    tree_data = {
        "name": "My Test Tree",
        "is_public": True,
        "json_data": {
            "roots": [
                {
                    "id": 1,
                    "children": []
                }
            ]
        }
    }
    response = client.post('/api/tree/save', json=tree_data)
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['message'] == 'Tree saved successfully'

    # Verify the tree was saved to the database
    tree = db.session.get(Tree, data['tree_id'])
    assert tree is not None
    assert tree.name == "My Test Tree"
    assert tree.is_public is True
    saved_json_data = json.loads(tree.json_data)
    assert 'roots' in saved_json_data

def test_save_tree_missing_data(client):
    # Register a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    # Login
    login(client, 'testuser', 'Password123')

    response = client.post('/api/tree/save', json={'name': 'My Test Tree'})
    assert response.status_code == 400
    data = response.get_json()
    assert data['status'] == 'error'
    assert data['message'] == 'Missing required fields'

def test_load_trees_unauthenticated(client):
    response = client.get('/api/trees/load')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, dict)
    assert 'public_trees' in data
    assert 'user_trees' in data
    assert isinstance(data['public_trees'], list)
    assert isinstance(data['user_trees'], list)
    assert len(data['user_trees']) == 0 # No user logged in

def test_load_trees_authenticated(client):
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    user = User.query.filter_by(username='testuser').first()
    login(client, 'testuser', 'Password123')

    # Create a private tree for the user
    private_tree = Tree(user_id=user.id, name="Private Tree", is_public=False, json_data='{}')
    db.session.add(private_tree)

    # Create a public tree by this user
    user_public_tree = Tree(user_id=user.id, name="User's Public Tree", is_public=True, json_data='{}')
    db.session.add(user_public_tree)

    # Create a public tree by another (or no) user
    anon_public_tree = Tree(user_id=None, name="Anonymous Public Tree", is_public=True, json_data='{}')
    db.session.add(anon_public_tree)
    db.session.commit()

    response = client.get('/api/trees/load')
    assert response.status_code == 200
    data = response.get_json()

    assert 'public_trees' in data
    assert 'user_trees' in data

    # User trees should only contain the user's private trees
    assert len(data['user_trees']) == 1
    user_tree_names = {t['name'] for t in data['user_trees']}
    assert "Private Tree" in user_tree_names
    assert "User's Public Tree" not in user_tree_names

    # Public trees should contain all public trees
    assert len(data['public_trees']) == 2
    public_tree_names = {t['name'] for t in data['public_trees']}
    assert "Anonymous Public Tree" in public_tree_names
    assert "User's Public Tree" in public_tree_names

def test_save_tree_with_duplicate_name_updates(client):
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    login(client, 'testuser', 'Password123')

    # Save the first tree
    tree_data1 = {'roots': [{'id': 1, 'description': 'First version', 'children': []}]}
    response1 = client.post('/api/tree/save', json={
        'name': 'My Duplicate Test Tree',
        'is_public': False,
        'json_data': tree_data1
    })
    assert response1.status_code == 200
    assert response1.json['status'] == 'success'
    assert response1.json['message'] == 'Tree saved successfully'
    tree_id = response1.json['tree_id']

    # Attempt to save a second tree with the same name (update)
    tree_data2 = {'roots': [{'id': 2, 'description': 'Second version', 'children': []}]}
    response2 = client.post('/api/tree/save', json={
        'name': 'My Duplicate Test Tree',
        'is_public': True, # Also testing update of is_public
        'json_data': tree_data2
    })
    assert response2.status_code == 200
    data = response2.get_json()
    assert data['status'] == 'success'
    assert data['message'] == 'Tree updated successfully'
    assert data['tree_id'] == tree_id # Should be the same tree

    # Verify the tree was updated in the database
    updated_tree = db.session.get(Tree, tree_id)
    assert updated_tree is not None
    assert updated_tree.is_public is True
    saved_json_data = json.loads(updated_tree.json_data)
    assert saved_json_data['roots'][0]['description'] == 'Second version'

    # Logout
    logout(client)

def test_save_public_tree_with_private_image_fails(client):
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    user = User.query.filter_by(username='testuser').first()
    login(client, 'testuser', 'Password123')

    # Create a private image owned by the user
    private_image = create_image(id=100, user_id=user.id)
    db.session.commit()

    tree_data = {
        "name": "Public Tree with Private Image",
        "is_public": True,
        "json_data": { "roots": [{ "id": private_image.id, "children": [] }] }
    }
    response = client.post('/api/tree/save', json=tree_data)
    assert response.status_code == 400
    data = response.get_json()
    assert data['status'] == 'error'
    assert 'Public trees can only contain public' in data['message']

def test_save_public_tree_with_public_image_succeeds(client):
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser2', 'email': 'test2@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    login(client, 'testuser2', 'Password123')

    # Create a public image (user_id is None)
    public_image = create_image(id=101, user_id=None)
    db.session.commit()

    tree_data = {
        "name": "Public Tree with Public Image",
        "is_public": True,
        "json_data": { "roots": [{ "id": public_image.id, "children": [] }] }
    }
    response = client.post('/api/tree/save', json=tree_data)
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'

# --- Tests for PictogramList API Endpoints ---

def test_save_public_list_with_private_image_fails(client):
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser3', 'email': 'test3@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    user = User.query.filter_by(username='testuser3').first()
    login(client, 'testuser3', 'Password123')

    # Create a private image owned by the user
    private_image = create_image(id=102, user_id=user.id)
    db.session.commit()

    list_data = {
        "list_name": "Public List with Private Image",
        "is_public": True,
        "payload": [{ "image_id": private_image.id, "description": "private" }]
    }
    response = client.post('/api/lists', json=list_data)
    assert response.status_code == 400
    data = response.get_json()
    assert data['status'] == 'error'
    assert 'Public lists can only contain public' in data['message']

def test_save_public_list_with_public_image_succeeds(client):
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser4', 'email': 'test4@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    login(client, 'testuser4', 'Password123')

    # Create a public image (user_id is None)
    public_image = create_image(id=103, user_id=None)
    db.session.commit()

    list_data = {
        "list_name": "Public List with Public Image",
        "is_public": True,
        "payload": [{ "image_id": public_image.id, "description": "public" }]
    }
    response = client.post('/api/lists', json=list_data)
    assert response.status_code == 201
    data = response.get_json()
    assert data['status'] == 'success'

def test_save_list_unauthenticated(client):
    """Check that an unauthenticated user gets a 401 error."""
    response = client.post('/api/lists', json={})
    assert response.status_code == 401 # Unauthorized

def test_save_and_load_lists(client):
    """Test saving a list and then loading it."""
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'listuser', 'email': 'list@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    user = User.query.filter_by(username='listuser').first()
    login(client, 'listuser', 'Password123')

    # 1. Save a private list
    private_list_payload = [{"image_id": 1, "description": "Step 1"}]
    response_save_private = client.post('/api/lists', json={
        "list_name": "My Private List",
        "is_public": False,
        "payload": private_list_payload
    })
    assert response_save_private.status_code == 201
    private_list_data = response_save_private.get_json()['list']
    assert private_list_data['list_name'] == "My Private List"

    # 2. Save a public list
    public_list_payload = [{"image_id": 2, "description": "Public Step"}]
    response_save_public = client.post('/api/lists', json={
        "list_name": "My Public List",
        "is_public": True,
        "payload": public_list_payload
    })
    assert response_save_public.status_code == 201

    # 3. Load lists while authenticated
    response_load_auth = client.get('/api/lists')
    assert response_load_auth.status_code == 200
    loaded_data_auth = response_load_auth.get_json()

    assert len(loaded_data_auth['user_lists']) == 1
    assert loaded_data_auth['user_lists'][0]['list_name'] == "My Private List"

    assert len(loaded_data_auth['public_lists']) == 1
    assert loaded_data_auth['public_lists'][0]['list_name'] == "My Public List"

    # 4. Logout and load lists unauthenticated
    logout(client)
    response_load_unauth = client.get('/api/lists')
    assert response_load_unauth.status_code == 200
    loaded_data_unauth = response_load_unauth.get_json()

    assert len(loaded_data_unauth['user_lists']) == 0
    assert len(loaded_data_unauth['public_lists']) == 1
    assert loaded_data_unauth['public_lists'][0]['list_name'] == "My Public List"

def test_update_list(client):
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'updateuser', 'email': 'update@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    login(client, 'updateuser', 'Password123')

    # Create an initial list
    list_payload = [{"image_id": 1, "description": "Initial"}]
    save_response = client.post('/api/lists', json={
        "list_name": "Initial Name",
        "is_public": False,
        "payload": list_payload
    })
    list_id = save_response.get_json()['list']['id']

    # Update the list
    updated_payload = [{"image_id": 2, "description": "Updated"}]
    update_response = client.put(f'/api/lists/{list_id}', json={
        "list_name": "Updated Name",
        "is_public": True,
        "payload": updated_payload
    })
    assert update_response.status_code == 200
    updated_data = update_response.get_json()['list']
    assert updated_data['list_name'] == "Updated Name"
    assert updated_data['is_public'] is True
    assert json.loads(updated_data['payload'])[0]['description'] == "Updated"

def test_delete_list(client):
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'deleteuser', 'email': 'delete@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    login(client, 'deleteuser', 'Password123')

    # Create a list
    list_payload = [{"image_id": 1, "description": "To be deleted"}]
    save_response = client.post('/api/lists', json={
        "list_name": "To Delete",
        "payload": list_payload
    })
    list_id = save_response.get_json()['list']['id']

    # Delete the list
    delete_response = client.delete(f'/api/lists/{list_id}')
    assert delete_response.status_code == 200
    assert delete_response.get_json()['status'] == 'success'

    # Verify it's gone
    assert db.session.get(PictogramList, list_id) is None

def test_update_delete_unauthorized(client):
    # Register two users
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'owner', 'email': 'owner@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})

    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'hacker', 'email': 'hacker@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})

    # Owner logs in and creates a list
    login(client, 'owner', 'Password123')
    list_payload = [{"image_id": 1, "description": "Owned"}]
    save_response = client.post('/api/lists', json={"list_name": "Owned List", "payload": list_payload})
    list_id = save_response.get_json()['list']['id']
    logout(client)

    # Hacker logs in and tries to modify it
    login(client, 'hacker', 'Password123')
    update_response = client.put(f'/api/lists/{list_id}', json={"list_name": "Hacked"})
    assert update_response.status_code == 403 # Forbidden

    delete_response = client.delete(f'/api/lists/{list_id}')
    assert delete_response.status_code == 403 # Forbidden


def create_dummy_image(path, size=(100, 100), color='red'):
    """Helper function to create a dummy image file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = PILImage.new('RGB', size, color=color)
    img.save(path, 'PNG')

def test_export_pdf(client):
    """Test the PDF export functionality."""
    # Create dummy images for the test
    dummy_img1_path = 'app/static/images/test_img1.png'
    dummy_img2_path = 'app/static/images/test_img2.png'
    create_dummy_image(dummy_img1_path, color='blue')
    create_dummy_image(dummy_img2_path, color='green')

    image_data = [
        {'path': dummy_img1_path, 'description': 'Blue Square'},
        {'path': dummy_img2_path, 'description': 'Green Square'}
    ]

    # Test with valid data in 'chain' mode
    payload_chain = {
        'image_data': image_data,
        'image_size': 120,
        'layout_mode': 'chain'
    }
    response_chain = client.post('/api/export_pdf', json=payload_chain)
    assert response_chain.status_code == 200
    assert response_chain.mimetype == 'application/pdf'
    assert response_chain.data.startswith(b'%PDF-')

    # Test with valid data in 'grid' mode
    payload_grid = {
        'image_data': image_data,
        'image_size': 80,
        'layout_mode': 'grid'
    }
    response_grid = client.post('/api/export_pdf', json=payload_grid)
    assert response_grid.status_code == 200
    assert response_grid.mimetype == 'application/pdf'
    assert response_grid.data.startswith(b'%PDF-')

    # Test with no images
    response_no_images = client.post('/api/export_pdf', json={'image_data': []})
    assert response_no_images.status_code == 400
    json_response = response_no_images.get_json()
    assert json_response['status'] == 'error'
    assert 'No images to export' in json_response['message']

    # Test with missing image path
    payload_missing_img = {
        'image_data': [{'path': 'non/existent/path.png'}],
        'image_size': 100,
        'layout_mode': 'chain'
    }
    response_missing_img = client.post('/api/export_pdf', json=payload_missing_img)
    assert response_missing_img.status_code == 200
    assert response_missing_img.mimetype == 'application/pdf'

    # Clean up dummy images
    os.remove(dummy_img1_path)
    os.remove(dummy_img2_path)

def test_save_list_with_duplicate_name_updates(client):
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'listupdateuser', 'email': 'listupdate@test.com', 'password': 'Password123', 'password2': 'Password123', 'csrf_token': csrf_token})
    login(client, 'listupdateuser', 'Password123')

    # Create an initial list
    list_payload1 = [{"image_id": 1, "description": "Initial"}]
    save_response1 = client.post('/api/lists', json={
        "list_name": "My Duplicate List",
        "is_public": False,
        "payload": list_payload1
    })
    assert save_response1.status_code == 201
    list_id = save_response1.get_json()['list']['id']

    # Update the list by saving with the same name
    list_payload2 = [{"image_id": 2, "description": "Updated"}]
    save_response2 = client.post('/api/lists', json={
        "list_name": "My Duplicate List",
        "is_public": True,
        "payload": list_payload2
    })
    assert save_response2.status_code == 201
    updated_data = save_response2.get_json()
    assert updated_data['list']['id'] == list_id
    assert updated_data['list']['list_name'] == "My Duplicate List"
    assert updated_data['list']['is_public'] is True
    assert json.loads(updated_data['list']['payload'])[0]['description'] == "Updated"

    # Verify in DB
    updated_list = db.session.get(PictogramList, list_id)
    assert updated_list.is_public is True
    assert json.loads(updated_list.payload)[0]['description'] == "Updated"

    logout(client)
