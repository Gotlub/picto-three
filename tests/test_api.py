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
    assert isinstance(data, list)

def test_load_trees_authenticated(client):
    # Register and login user
    get_response = client.get('/register')
    csrf_token = get_csrf_token(get_response.data.decode())
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'password', 'password2': 'password', 'csrf_token': csrf_token})
    login(client, 'testuser', 'password')

    # Create a tree for the user
    tree_data = {
        "name": "My Test Tree",
        "is_public": False,
        "json_data": {"version": "1.0", "tree": {"nodes": {}, "roots": []}}
    }
    client.post('/api/tree/save', json=tree_data)

    # Create a public tree
    public_tree_data = {
        "name": "Public Tree",
        "is_public": True,
        "json_data": {"version": "1.0", "tree": {"nodes": {}, "roots": []}}
    }
    client.post('/api/tree/save', json=public_tree_data)

    response = client.get('/api/trees/load')
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2

def test_get_bulk_images(client):
    """Test the bulk image fetching endpoint."""
    from app.models import User, Image
    from app import db

    with client.application.app_context():
        user = User(username='bulkuser', email='bulkuser@test.com')
        user.set_password('password')
        other_user = User(username='otheruser', email='otheruser@test.com')
        other_user.set_password('password')
        db.session.add_all([user, other_user])
        db.session.commit()

        public_image = Image(name='public_image.png', path='static/images/public_image.png', is_public=True)
        private_image = Image(name='private_image.png', path='static/images/private_image.png', user_id=user.id, is_public=False)
        other_private_image = Image(name='other_private.png', path='static/images/other_private.png', user_id=other_user.id, is_public=False)
        db.session.add_all([public_image, private_image, other_private_image])
        db.session.commit()

        ids_to_fetch = [public_image.id, private_image.id, other_private_image.id]
        public_image_id = public_image.id
        private_image_id = private_image.id
        other_private_image_id = other_private_image.id

    # Anonymous user should only get the public image
    response = client.post('/api/images/bulk', json={'ids': ids_to_fetch})
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 1
    assert data[0]['id'] == public_image_id

    # Authenticated user should get public and their own private images
    login(client, 'bulkuser', 'password')
    response = client.post('/api/images/bulk', json={'ids': ids_to_fetch})
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2
    returned_ids = {img['id'] for img in data}
    assert public_image_id in returned_ids
    assert private_image_id in returned_ids
    assert other_private_image_id not in returned_ids
    logout(client)

def test_get_bulk_images_invalid_data(client):
    """Test bulk image endpoint with invalid data."""
    with client.application.app_context():
        user = User(username='testuser_invalid_bulk', email='invalid@test.com')
        user.set_password('password')
        db.session.add(user)
        db.session.commit()

    login(client, 'testuser_invalid_bulk', 'password')

    response = client.post('/api/images/bulk', json={})
    assert response.status_code == 400
    response = client.post('/api/images/bulk', json={'image_ids': [1, 2]})
    assert response.status_code == 400
    response = client.post('/api/images/bulk', json={'ids': 'not-a-list'})
    assert response.status_code == 400
