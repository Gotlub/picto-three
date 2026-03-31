import pytest
import json
from app import db
from app.models import Tree, User
from tests.conftest import create_user, confirm_user

def test_mobile_trees_pagination_and_search(client, app):
    # Setup users
    user1 = create_user(client, 'alice', 'Password123')
    confirm_user(client, user1.email)
    
    user2 = create_user(client, 'bob', 'Password123')
    confirm_user(client, user2.email)
    
    login_resp = client.post('/api/v1/mobile/login', json={'username': 'alice', 'password': 'Password123'})
    token_alice = login_resp.get_json()['access_token']
    headers_alice = {'Authorization': f'Bearer {token_alice}'}

    # Generate 15 trees for Alice (private) and 5 public trees for Bob
    with app.app_context():
        u1_id = User.query.filter_by(username='alice').first().id
        u2_id = User.query.filter_by(username='bob').first().id
        
        for i in range(15):
            t = Tree(user_id=u1_id, name=f"Alice Tree {i}", is_public=False, json_data="{}")
            db.session.add(t)
            
        for i in range(5):
            t = Tree(user_id=u2_id, name=f"Bob Public {i}", is_public=True, json_data="{}")
            db.session.add(t)
            
        db.session.commit()

    # TEST: Alice requests public trees (limit=3, page=1) -> Should get 3 of Bob's
    r = client.get('/api/v1/mobile/trees?is_public=true&limit=3&page=1', headers=headers_alice)
    assert r.status_code == 200
    data = r.get_json()
    assert len(data) == 3
    assert all(t['is_public'] for t in data)

    # TEST: Alice requests private trees (limit=10, page=1) -> Should get 10 of her trees
    r = client.get('/api/v1/mobile/trees?is_public=false&limit=10&page=1', headers=headers_alice)
    assert r.status_code == 200
    data = r.get_json()
    assert len(data) == 10
    assert all(not t['is_public'] for t in data)
    assert all(t['owner'] == 'alice' for t in data)
    
    # TEST: Alice requests private trees (limit=10, page=2) -> Should get remaining 5
    r = client.get('/api/v1/mobile/trees?is_public=false&limit=10&page=2', headers=headers_alice)
    assert len(r.get_json()) == 5

    # TEST: Alice searches 'Tree 1' in private -> Should match "Alice Tree 1", "10", "11", "12", "13", "14" (6 results)
    r = client.get('/api/v1/mobile/trees?is_public=false&search=Tree%201', headers=headers_alice)
    data = r.get_json()
    assert len(data) == 6
