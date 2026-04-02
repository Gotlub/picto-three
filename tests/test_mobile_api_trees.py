import json
from app import db
from app.models import Tree, User
from tests.conftest import create_user, confirm_user

def test_mobile_trees_api(client, app):
    # 1. Setup User and Auth
    user = create_user(client, 'android_tester', 'Password123')
    confirm_user(client, user.email)
    
    # Login via Mobile API to get JWT
    login_resp = client.post('/api/v1/mobile/login', json={
        'username': 'android_tester',
        'password': 'Password123'
    })
    assert login_resp.status_code == 200
    token = login_resp.get_json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    # 2. Insert dummy tree into DB
    with app.app_context():
        user_db = User.query.filter_by(username='android_tester').first()
        test_json_data = {
            "name": "Arbre Test",
            "roots": [
                {
                    "id": "root_1",
                    "text": "Je veux",
                    "image": "/images/android_tester/want.png",
                    "children": [
                        {
                            "id": "child_1",
                            "text": "Manger",
                            "image": "/images/android_tester/eat.png",
                            "children": []
                        }
                    ]
                }
            ]
        }
        tree = Tree(
            user_id=user_db.id,
            name="Arbre Test",
            is_public=True,
            root_id=-1,
            root_url="/images/want.png",
            json_data=json.dumps(test_json_data)
        )
        db.session.add(tree)
        db.session.commit()
        tree_id = tree.id

    # 3. Test GET /api/v1/mobile/trees
    trees_resp = client.get('/api/v1/mobile/trees', headers=headers)
    assert trees_resp.status_code == 200
    trees_data = trees_resp.get_json()
    assert len(trees_data) >= 1
    
    # Find our tree
    our_tree = next(t for t in trees_data if t['id'] == tree_id)
    assert our_tree['name'] == 'Arbre Test'
    assert our_tree['owner'] == 'android_tester'
    assert 'http' in our_tree['root_image_url']  # Host url should be appended
    assert our_tree['root_image_url'].endswith('/images/want.png')

    # 4. Test GET /api/v1/mobile/trees/<id>
    tree_resp = client.get(f'/api/v1/mobile/trees/{tree_id}', headers=headers)
    assert tree_resp.status_code == 200
    tree_data = tree_resp.get_json()
    
    assert tree_data['tree_id'] == tree_id
    assert tree_data['name'] == 'Arbre Test'
    
    root_node = tree_data['root_node']
    assert root_node is not None
    assert root_node['node_id'] == 'root_1'
    assert root_node['label'] == 'Je veux'
    assert 'http' in root_node['image_url']
    
    # Check children recursion
    children = root_node['children']
    assert len(children) == 1
    assert children[0]['node_id'] == 'child_1'
    assert children[0]['label'] == 'Manger'
    assert children[0]['children'] == []
