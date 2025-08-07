import json
import pytest
from app.models import User, Tree
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
    tree = Tree.query.get(data['tree_id'])
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
