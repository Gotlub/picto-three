from pathlib import Path
from tests.conftest import create_user, confirm_user

def test_mobile_pictograms_auth(client, app):
    # Setup user
    user = create_user(client, 'android_tester', 'Password123')
    confirm_user(client, user.email)
    
    login_resp = client.post('/api/v1/mobile/login', json={'username': 'android_tester', 'password': 'Password123'})
    token = login_resp.get_json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    with app.app_context():
        # Setup files inside the specific temporary directory managed by conftest
        picto_dir = Path(app.config['PICTOGRAMS_PATH'])
        
        # 1. User's private folder
        user_dir = picto_dir / 'android_tester'
        user_dir.mkdir(parents=True, exist_ok=True)
        (user_dir / 'my_pic.png').write_text("fake image data")
        
        # 2. Public folder
        public_dir = picto_dir / 'public'
        public_dir.mkdir(parents=True, exist_ok=True)
        (public_dir / 'apple.png').write_text("fake public data")
        
        # 3. Other user's folder
        hacker_dir = picto_dir / 'other_user'
        hacker_dir.mkdir(parents=True, exist_ok=True)
        (hacker_dir / 'secret.png').write_text("secret data")
        
        # 4. Create prohibit file just in case it doesn't exist during test
        static_dir = Path(app.static_folder) / 'images'
        static_dir.mkdir(parents=True, exist_ok=True)
        (static_dir / 'prohibit-bold.png').write_text("prohibit image")

    # TEST: Access public image (should succeed even without auth, but we pass auth anyway)
    r1 = client.get('/api/v1/mobile/pictograms/public/apple.png', headers=headers)
    assert r1.status_code == 200
    assert r1.data == b"fake public data"
    
    # TEST: Access user's own private image
    r2 = client.get('/api/v1/mobile/pictograms/android_tester/my_pic.png', headers=headers)
    assert r2.status_code == 200
    assert r2.data == b"fake image data"
    
    # TEST: Try to access someone else's image (Forbidden bounds)
    r3 = client.get('/api/v1/mobile/pictograms/other_user/secret.png', headers=headers)
    assert r3.status_code == 403
    assert r3.data == b"prohibit image"
    
    # TEST: Path traversal attack (Secured via posix normalization on send_from_directory usually, but explicitly verified)
    r4 = client.get('/api/v1/mobile/pictograms/../config.py', headers=headers)
    assert r4.status_code in [400, 403, 404] 
