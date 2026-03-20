import json
import os
from PIL import Image as PILImage
from app.models import User, Tree, PictogramList, Folder, Image
from app import db
from tests.conftest import login, confirm_user

def logout(client):
    return client.get('/logout', follow_redirects=True)

def test_save_tree_unauthenticated(client):
    response = client.post('/api/tree/save', json={})
    assert response.status_code == 401 # Unauthorized

def test_save_tree_authenticated(client):
    # Register a user
    client.get('/register')
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    # Confirm user then login
    confirm_user(client, 'test@test.com')
    login(client, 'testuser', 'Password123')

    tree_data = {
        "name": "My Test Tree",
        "is_public": True,
        "root_id": 10,
        "root_url": "/test/url.png",
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
    assert tree.root_id == 10
    assert tree.root_url == "/test/url.png"
    saved_json_data = json.loads(tree.json_data)
    assert 'roots' in saved_json_data

def test_save_tree_missing_data(client):
    # Register a user
    client.get('/register')
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    # Confirm user then login
    confirm_user(client, 'test@test.com')
    login(client, 'testuser', 'Password123')

    response = client.post('/api/tree/save', json={'name': 'My Test Tree'})
    assert response.status_code == 400
    data = response.get_json()
    assert data['status'] == 'error'
    assert 'Missing required fields' in data['message']

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
    client.get('/register')
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    user = User.query.filter_by(username='testuser').first()
    confirm_user(client, 'test@test.com')
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
    assert len(data['public_trees']) >= 2
    public_tree_names = {t['name'] for t in data['public_trees']}
    assert "Anonymous Public Tree" in public_tree_names
    assert "User's Public Tree" in public_tree_names

def test_save_tree_with_duplicate_name_updates(client):
    # Register and login a user
    client.get('/register')
    client.post('/register', data={'username': 'testuser', 'email': 'test@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    confirm_user(client, 'test@test.com')
    login(client, 'testuser', 'Password123')

    # Save the first tree
    tree_data1 = {'roots': [{'id': 1, 'description': 'First version', 'children': []}]}
    response1 = client.post('/api/tree/save', json={
        'name': 'My Duplicate Test Tree',
        'is_public': False,
        'root_id': 1,
        'root_url': '/test/1.png',
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
        'root_id': 2,
        'root_url': '/test/2.png',
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
    assert updated_tree.root_id == 2
    assert updated_tree.root_url == '/test/2.png'
    saved_json_data = json.loads(updated_tree.json_data)
    assert saved_json_data['roots'][0]['description'] == 'Second version'

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
    client.get('/register')
    client.post('/register', data={'username': 'listuser', 'email': 'list@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    User.query.filter_by(username='listuser').first()
    confirm_user(client, 'list@test.com')
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
    client.get('/register')
    client.post('/register', data={'username': 'updateuser', 'email': 'update@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    confirm_user(client, 'update@test.com')
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
    client.get('/register')
    client.post('/register', data={'username': 'deleteuser', 'email': 'delete@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    confirm_user(client, 'delete@test.com')
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
    client.get('/register')
    client.post('/register', data={'username': 'owner', 'email': 'owner@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    confirm_user(client, 'owner@test.com')

    client.get('/register')
    client.post('/register', data={'username': 'hacker', 'email': 'hacker@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    confirm_user(client, 'hacker@test.com')

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

def test_save_list_with_duplicate_name_updates(client):
    # Register and login a user
    client.get('/register')
    client.post('/register', data={'username': 'listupdateuser', 'email': 'listupdate@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    confirm_user(client, 'listupdate@test.com')
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

def test_load_tree_data(client):
    """
    Tests the new /api/load_tree_data endpoint for both unauthenticated
    and authenticated users.
    """
    # 1. Setup the database with a public and a private folder structure
    # Register a user
    client.get('/register')
    client.post('/register', data={'username': 'treeuser', 'email': 'tree@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    user = User.query.filter_by(username='treeuser').first()
    assert user is not None

    # This will create the user's root folder automatically
    confirm_user(client, 'tree@test.com')

    # Manually create the public root folder for the test
    public_root = Folder(name='Public', user_id=None, parent_id=None, path='public')
    db.session.add(public_root)
    db.session.commit()

    # Fetch folders to build the structure
    public_root = Folder.query.filter_by(user_id=None, parent_id=None).first()
    user_root = Folder.query.filter_by(user_id=user.id, parent_id=None).first()
    assert public_root is not None
    assert user_root is not None

    # Add items to public folder
    public_img = Image(name='public_img.png', path='public/public_img.png', folder_id=public_root.id)
    public_subfolder = Folder(name='Public Sub', parent_id=public_root.id, path='public/sub')
    db.session.add_all([public_img, public_subfolder])
    db.session.commit()

    # Add items to user's private folder
    private_img = Image(name='private_img.png', path=f'{user.username}/private_img.png', user_id=user.id, folder_id=user_root.id)
    db.session.add(private_img)
    db.session.commit()

    # 2. Test Case 1: Unauthenticated user
    logout(client)
    response_unauth = client.get('/api/load_tree_data')
    assert response_unauth.status_code == 200
    data_unauth = response_unauth.get_json()

    assert len(data_unauth) == 1
    public_tree = data_unauth[0]
    assert public_tree['data']['name'] == 'Public'
    assert public_tree['type'] == 'folder'
    assert len(public_tree['children']) == 1

    child_names_unauth = {child['data']['name'] for child in public_tree['children']}
    assert 'Public Sub' in child_names_unauth

    # 3. Test Case 2: Authenticated user
    login(client, 'treeuser', 'Password123')
    response_auth = client.get('/api/load_tree_data')
    assert response_auth.status_code == 200
    data_auth = response_auth.get_json()

    assert len(data_auth) == 2

    # Find the public and user trees in the response
    public_tree_auth = next((item for item in data_auth if item['data']['name'] == 'Public'), None)
    user_tree_auth = next((item for item in data_auth if item['data']['name'] == 'treeuser'), None)

    assert public_tree_auth is not None
    assert user_tree_auth is not None

    # Check public tree for authenticated user
    assert len(public_tree_auth['children']) == 1

    # Check user tree
    assert user_tree_auth['type'] == 'folder'
    assert len(user_tree_auth['children']) == 0

def test_folder_images_endpoint(client):
    """
    Tests the lazy loading endpoint /api/folder_images/<folder_id>
    """
    client.get('/register')
    client.post('/register', data={'username': 'lazyuser', 'email': 'lazy@test.com', 'password': 'Password123', 'password2': 'Password123', 'accept_terms': 'y'})
    user = User.query.filter_by(username='lazyuser').first()
    confirm_user(client, 'lazy@test.com')

    public_root = Folder(name='PublicLazy', user_id=None, parent_id=None, path='public_lazy')
    db.session.add(public_root)
    db.session.commit()
    
    public_root = Folder.query.filter_by(name='PublicLazy', user_id=None, parent_id=None).first()
    user_root = Folder.query.filter_by(user_id=user.id, parent_id=None).first()

    public_img = Image(name='public_img_lazy.png', path='public_lazy/public_img.png', folder_id=public_root.id, is_public=True)
    private_img = Image(name='private_img_lazy.png', path=f'{user.username}/private_img.png', user_id=user.id, folder_id=user_root.id, is_public=False)
    db.session.add_all([public_img, private_img])
    db.session.commit()

    # 1. Unauthenticated reading public folder
    logout(client)
    res = client.get(f'/api/folder_images/{public_root.id}')
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) == 1
    assert data[0]['data']['name'] == 'public_img_lazy.png'

    # Unauthenticated reading private folder = Empty / Hidden
    res2 = client.get(f'/api/folder_images/{user_root.id}')
    assert res2.status_code == 403

    # 2. Authenticated reading private folder
    login(client, 'lazyuser', 'Password123')
    res3 = client.get(f'/api/folder_images/{user_root.id}')
    assert res3.status_code == 200
    data3 = res3.get_json()
    assert len(data3) == 1
    assert data3[0]['data']['name'] == 'private_img_lazy.png'
