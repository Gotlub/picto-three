import pytest

from app import db
from app.models import Folder, Image, User
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
        db.session.query(Folder).delete()
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

        # Create user1 root folder
        user1_root_folder = Folder(name='user1', path='user1', user_id=user1.id, parent_id=None)
        db.session.add(user1_root_folder)
        db.session.commit()

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



def test_search_local_images_unauthenticated(seeded_db):
    """Unauthenticated users should only find global and user-public images via search."""
    client = seeded_db
    response = client.get('/api/search_local_images?q=png')
    assert response.status_code == 200

    images = response.get_json()
    image_ids = {img['data']['id'] for img in images}

    # Should see: global (100), user1's public (102), user2's public (202)
    assert 100 in image_ids
    assert 102 in image_ids
    assert 202 in image_ids

    # Should NOT see: user1's private (101), user2's private (201)
    assert 101 not in image_ids
    assert 201 not in image_ids

def test_search_local_images_authenticated(seeded_db):
    """Authenticated users should find public images + all their own images."""
    client = seeded_db
    login(client, 'user1', 'password')

    response = client.get('/api/search_local_images?q=png')
    assert response.status_code == 200

    images = response.get_json()
    image_ids = {img['data']['id'] for img in images}

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

def test_mobile_pictogram_path_traversal(seeded_db):
    """Test that directory traversal using backslashes is blocked."""
    client = seeded_db

    # Log in to get a JWT token for mobile API tests
    login_response = client.post('/api/v1/mobile/login', json={
        'username': 'user1',
        'password': 'password'
    })
    assert login_response.status_code == 200
    token = login_response.get_json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    # Test path traversal in standard pictograms
    response = client.get('/api/v1/mobile/pictograms/user1\\..\\admin\\secret.png', headers=headers)
    assert response.status_code == 403

    # Test path traversal in mini pictograms
    response_min = client.get('/api/v1/mobile/pictogramsmin/user1\\..\\admin\\secret.png', headers=headers)
    assert response_min.status_code == 403


def test_create_folder_path_traversal_blocked(seeded_db):
    """Test that path traversal attempts in folder creation are strictly rejected."""
    client = seeded_db
    login(client, 'user1', 'password')

    with client.application.app_context():
        user1 = User.query.filter_by(username='user1').first()
        root_folder = Folder.query.filter_by(user_id=user1.id, parent_id=None).first()
        root_folder_id = root_folder.id

    # Test invalid folder names attempting traversal
    traversal_names = ['../escaped', '..\\escaped', 'sub/folder', 'sub\\folder', '.hidden', '..']
    for bad_name in traversal_names:
        response = client.post('/api/folder/create', json={
            'parent_id': root_folder_id,
            'name': bad_name
        })
        assert response.status_code == 400
        assert 'Invalid folder name' in response.get_json().get('message', '')


def test_registration_username_restrictions(client):
    """Test that username validation in RegistrationForm blocks special chars and reserved words."""
    from wtforms.validators import ValidationError

    from app.forms import RegistrationForm

    with client.application.test_request_context():
        # Valid username
        form = RegistrationForm(username='valid_user-123')
        form.validate_username(form.username)  # Should not raise

        # Invalid: reserved word
        with pytest.raises(ValidationError) as exc_info:
            form_reserved = RegistrationForm(username='admin')
            form_reserved.validate_username(form_reserved.username)
        assert 'reserved' in str(exc_info.value).lower()

        # Invalid: path traversal characters
        for bad in ['user/slash', 'user..dot', 'user\\back', 'a', 'ab']:
            with pytest.raises(ValidationError):
                f = RegistrationForm(username=bad)
                f.validate_username(f.username)


def test_security_headers_enforced(client):
    """Test that modern security headers (nosniff, frame options, CSP) are present on responses."""
    response = client.get('/')
    assert response.status_code == 200

    assert response.headers.get('X-Content-Type-Options') == 'nosniff'
    assert response.headers.get('X-Frame-Options') == 'SAMEORIGIN'
    assert response.headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin'
    assert 'geolocation=()' in response.headers.get('Permissions-Policy', '')

    csp = response.headers.get('Content-Security-Policy', '')
    assert "default-src 'self'" in csp
    assert "object-src 'none'" in csp

