import json
import pytest
from app import db
from app.models import User, Image, Tree, PictogramList
from tests.conftest import login

@pytest.fixture
def seeded_db(client):
    """
    Fixture to seed the database with a standard set of users and images
    for security-related tests. This ensures a consistent state for each test.
    """
    with client.application.app_context():
        # It's good practice to start with a clean slate, though the app
        # fixture's teardown should handle this.
        db.session.query(Image).delete()
        db.session.query(User).delete()
        db.session.commit()

        # --- Create Users ---
        # We create users directly in the DB for test efficiency.
        user1 = User(username='user1', email='user1@test.com', confirmed=True)
        user1.set_password('password')

        user2 = User(username='user2', email='user2@test.com', confirmed=True)
        user2.set_password('password')

        db.session.add_all([user1, user2])
        db.session.commit() # Commit to assign IDs to user1 and user2

        # --- Create Images ---
        # We can now use the generated user IDs.
        global_img = Image(id=100, name='global_public.png', path='/path/to/global_public.png', user_id=None, is_public=True)
        user1_private_img = Image(id=101, name='user1_private.png', path='/path/to/user1_private.png', user_id=user1.id, is_public=False)
        user1_public_img = Image(id=102, name='user1_public.png', path='/path/to/user1_public.png', user_id=user1.id, is_public=True)
        user2_private_img = Image(id=201, name='user2_private.png', path='/path/to/user2_private.png', user_id=user2.id, is_public=False)
        user2_public_img = Image(id=202, name='user2_public.png', path='/path/to/user2_public.png', user_id=user2.id, is_public=True)

        db.session.add_all([global_img, user1_private_img, user1_public_img, user2_private_img, user2_public_img])
        db.session.commit()

    # Yielding the client allows the test to run within the app context.
    yield client


def test_save_public_tree_with_user_image_fails(seeded_db):
    """A public tree cannot contain images owned by a user."""
    client = seeded_db
    login(client, 'user1', 'password')

    user1 = User.query.filter_by(username='user1').one()

    # Tree data contains an image owned by user1
    tree_data = {
        "name": "Invalid Public Tree",
        "is_public": True,
        "json_data": { "roots": [{ "id": 101, "children": [] }] } # Image 101 is user1's
    }

    response = client.post('/api/tree/save', json=tree_data)
    assert response.status_code == 400
    data = response.get_json()
    assert data['status'] == 'error'
    assert "Public trees can only contain global public images" in data['message']

def test_save_public_tree_with_global_image_succeeds(seeded_db):
    """A public tree can contain global (non-user-owned) images."""
    client = seeded_db
    login(client, 'user1', 'password')

    # Tree data contains a global public image (ID 100)
    tree_data = {
        "name": "Valid Public Tree",
        "is_public": True,
        "json_data": { "roots": [{ "id": 100, "children": [] }] }
    }

    response = client.post('/api/tree/save', json=tree_data)
    assert response.status_code == 200
    assert response.get_json()['status'] == 'success'

def test_save_public_list_with_user_image_fails(seeded_db):
    """A public list cannot contain images owned by a user."""
    client = seeded_db
    login(client, 'user1', 'password')

    # List payload contains a user-owned image (ID 101)
    list_payload = [{"image_id": 101, "description": "Invalid"}]

    response = client.post('/api/lists', json={
        "list_name": "Invalid Public List",
        "is_public": True,
        "payload": list_payload
    })

    assert response.status_code == 400
    data = response.get_json()
    assert data['status'] == 'error'
    assert "Public lists can only contain global public images" in data['message']

def test_save_public_list_with_global_image_succeeds(seeded_db):
    """A public list can contain global (non-user-owned) images."""
    client = seeded_db
    login(client, 'user1', 'password')

    # List payload contains a global public image (ID 100)
    list_payload = [{"image_id": 100, "description": "Valid"}]

    response = client.post('/api/lists', json={
        "list_name": "Valid Public List",
        "is_public": True,
        "payload": list_payload
    })

    assert response.status_code == 201 # 201 Created
    assert response.get_json()['status'] == 'success'

def test_builder_image_loading_unauthenticated(seeded_db):
    """Unauthenticated users should only see global and user-public images."""
    client = seeded_db
    response = client.get('/builder')
    assert response.status_code == 200

    html_content = response.data.decode()
    start_str = '<script id="images-data" type="application/json">'
    end_str = '</script>'
    start_idx = html_content.find(start_str) + len(start_str)
    end_idx = html_content.find(end_str, start_idx)
    json_str = html_content[start_idx:end_idx]

    images = json.loads(json_str)
    image_ids = {img['id'] for img in images}

    # Should see: global (100), user1's public (102), user2's public (202)
    assert 100 in image_ids
    assert 102 in image_ids
    assert 202 in image_ids

    # Should NOT see: user1's private (101), user2's private (201)
    assert 101 not in image_ids
    assert 201 not in image_ids

def test_builder_image_loading_authenticated(seeded_db):
    """Authenticated users should see public images + all their own images."""
    client = seeded_db
    login(client, 'user1', 'password')

    response = client.get('/builder')
    assert response.status_code == 200

    html_content = response.data.decode()
    start_str = '<script id="images-data" type="application/json">'
    end_str = '</script>'
    start_idx = html_content.find(start_str) + len(start_str)
    end_idx = html_content.find(end_str, start_idx)
    json_str = html_content[start_idx:end_idx]

    images = json.loads(json_str)
    image_ids = {img['id'] for img in images}

    # User 1 should see:
    # - Global public (100)
    # - Their own private (101)
    # - Their own public (102)
    # - Other user's public (202)
    assert 100 in image_ids
    assert 101 in image_ids
    assert 102 in image_ids
    assert 202 in image_ids

    # User 1 should NOT see:
    # - Other user's private (201)
    assert 201 not in image_ids
