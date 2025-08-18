import json
import pytest
import os
from PIL import Image as PILImage
from app.models import User, Tree, PictogramList
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

def test_save_tree_unauthenticated(client):
    response = client.post('/api/tree/save', json={})
    assert response.status_code == 401 # Unauthorized

def test_save_tree_authenticated(client):
    # Register a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    # Login
    login(client, 'testuser', 'password')

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
    assert response.status_code == 201
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
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    # Login
    login(client, 'testuser', 'password')

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
    assert 'public_saves' in data
    assert 'user_saves' in data
    assert isinstance(data['public_saves'], list)
    assert isinstance(data['user_saves'], list)
    assert len(data['user_saves']) == 0 # No user logged in

def test_load_trees_authenticated(client):
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    user = User.query.filter_by(username='testuser').first()
    login(client, 'testuser', 'password')

    # Create a private tree for the user
    private_tree = Tree(user_id=user.id, name="Private Tree", is_public=False, json_data='{}')
    db.session.add(private_tree)

    # Create a public tree by this user
    user_public_tree = Tree(user_id=user.id, name="User's Public Tree", is_public=True, json_data='{}')
    db.session.add(user_public_tree)

    # Create a public tree by another user
    other_user = User(username='otheruser', email='other@user.com')
    db.session.add(other_user)
    db.session.commit()
    other_public_tree = Tree(user_id=other_user.id, name="Other User Public Tree", is_public=True, json_data='{}')
    db.session.add(other_public_tree)
    db.session.commit()


    response = client.get('/api/trees/load')
    assert response.status_code == 200
    data = response.get_json()

    assert 'public_saves' in data
    assert 'user_saves' in data

    # user_saves should contain all trees for the logged-in user
    assert len(data['user_saves']) == 2
    user_save_names = {t['name'] for t in data['user_saves']}
    assert "Private Tree" in user_save_names
    assert "User's Public Tree" in user_save_names

    # public_saves should only contain public trees from other users
    assert len(data['public_saves']) == 1
    public_save_names = {t['name'] for t in data['public_saves']}
    assert "Other User Public Tree" in public_save_names
    assert "User's Public Tree" not in public_save_names

def test_save_tree_conflict_and_force(client):
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    login(client, 'testuser', 'password')

    # 1. Save the first tree
    tree_data1 = {'roots': [{'id': 1, 'description': 'First version'}]}
    response1 = client.post('/api/tree/save', json={
        'name': 'My Conflict Test Tree',
        'is_public': False,
        'json_data': tree_data1
    })
    assert response1.status_code == 201
    assert response1.json['status'] == 'success'
    tree_id = response1.json['tree_id']

    # 2. Attempt to save a second tree with the same name, expecting a conflict
    tree_data2 = {'roots': [{'id': 2, 'description': 'Second version'}]}
    response2 = client.post('/api/tree/save', json={
        'name': 'My Conflict Test Tree',
        'is_public': False,
        'json_data': tree_data2
    })
    assert response2.status_code == 409
    assert response2.json['status'] == 'conflict'

    # 3. Save again, but with force=true
    response3 = client.post('/api/tree/save', json={
        'name': 'My Conflict Test Tree',
        'is_public': True, # Also update metadata
        'json_data': tree_data2,
        'force': True
    })
    assert response3.status_code == 200
    assert response3.json['status'] == 'success'
    assert response3.json['message'] == 'Tree updated successfully'

    # 4. Verify the tree was updated
    updated_tree = db.session.get(Tree, tree_id)
    assert updated_tree.is_public is True
    saved_json = json.loads(updated_tree.json_data)
    assert saved_json['roots'][0]['description'] == 'Second version'

# --- Tests for PictogramList API Endpoints ---

def test_save_list_unauthenticated(client):
    """Check that an unauthenticated user gets a 401 error."""
    response = client.post('/api/lists', json={})
    assert response.status_code == 401 # Unauthorized

def test_save_and_load_lists(client):
    """Test saving a list and then loading it."""
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'listuser', 'email': 'list@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    user = User.query.filter_by(username='listuser').first()
    login(client, 'listuser', 'password')

    # 1. Save a private list for the current user
    private_list_payload = [{"image_id": 1, "description": "Step 1"}]
    client.post('/api/lists', json={"list_name": "My Private List", "is_public": False, "payload": private_list_payload})

    # 2. Save a public list for the current user
    public_list_payload = [{"image_id": 2, "description": "Public Step"}]
    client.post('/api/lists', json={"list_name": "My Public List", "is_public": True, "payload": public_list_payload})

    # 3. Save a public list for another user
    other_user = User(username='otherlistuser', email='otherlist@user.com')
    db.session.add(other_user)
    db.session.commit()
    other_public_list = PictogramList(user_id=other_user.id, list_name="Other User Public List", is_public=True, payload='[]')
    db.session.add(other_public_list)
    db.session.commit()

    # 4. Load lists while authenticated
    response_load_auth = client.get('/api/lists')
    assert response_load_auth.status_code == 200
    loaded_data_auth = response_load_auth.get_json()

    # user_saves should contain both of the user's lists
    assert len(loaded_data_auth['user_saves']) == 2
    user_save_names = {l['list_name'] for l in loaded_data_auth['user_saves']}
    assert "My Private List" in user_save_names
    assert "My Public List" in user_save_names

    # public_saves should only contain the other user's public list
    assert len(loaded_data_auth['public_saves']) == 1
    assert loaded_data_auth['public_saves'][0]['list_name'] == "Other User Public List"

    # 5. Logout and load lists unauthenticated
    logout(client)
    response_load_unauth = client.get('/api/lists')
    assert response_load_unauth.status_code == 200
    loaded_data_unauth = response_load_unauth.get_json()

    # Should see both public lists
    assert len(loaded_data_unauth['user_saves']) == 0
    assert len(loaded_data_unauth['public_saves']) == 2

def test_update_list(client):
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'updateuser', 'email': 'update@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    login(client, 'updateuser', 'password')

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
    client.post('/register', data={'username': 'deleteuser', 'email': 'delete@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    login(client, 'deleteuser', 'password')

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
    client.post('/register', data={'username': 'owner', 'email': 'owner@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})

    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'hacker', 'email': 'hacker@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})

    # Owner logs in and creates a list
    login(client, 'owner', 'password')
    list_payload = [{"image_id": 1, "description": "Owned"}]
    save_response = client.post('/api/lists', json={"list_name": "Owned List", "payload": list_payload})
    list_id = save_response.get_json()['list']['id']
    logout(client)

    # Hacker logs in and tries to modify it
    login(client, 'hacker', 'password')
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
