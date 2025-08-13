import json
import pytest
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
    assert 'public_trees' in data
    assert 'user_trees' in data
    assert isinstance(data['public_trees'], list)
    assert isinstance(data['user_trees'], list)
    assert len(data['user_trees']) == 0 # No user logged in

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

def test_save_tree_with_duplicate_name_fails(client):
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    login(client, 'testuser', 'password')

    # Save the first tree
    tree_data1 = {'roots': [{'id': 1, 'children': []}]}
    response1 = client.post('/api/tree/save', json={
        'name': 'My Duplicate Test Tree',
        'is_public': False,
        'json_data': tree_data1
    })
    assert response1.status_code == 200
    assert response1.json['status'] == 'success'

    # Attempt to save a second tree with the same name
    tree_data2 = {'roots': [{'id': 2, 'children': []}]}
    response2 = client.post('/api/tree/save', json={
        'name': 'My Duplicate Test Tree',
        'is_public': False,
        'json_data': tree_data2
    })
    assert response2.status_code == 400
    data = response2.get_json()
    assert data['status'] == 'error'
    assert 'A tree with this name already exists' in data['message']

    # Logout
    logout(client)

# --- Tests for PictogramList API Endpoints ---

def test_save_list_unauthenticated(client):
    """Check that an unauthenticated user gets a 401 error."""
    response = client.post('/api/lists', json={})
    assert response.status_code == 401 # Unauthorized

def test_save_and_load_lists(client):
    """Test saving a list and then loading it."""
    # Register and login a user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'listuser', 'email': 'list@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    user = User.query.filter_by(username='listuser').first()
    login(client, 'listuser', 'password')

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
