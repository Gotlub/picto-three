import json
from urllib.request import urlopen

with urlopen('http://127.0.0.1:5000/api/trees/load', timeout=3) as response:
    data = json.load(response)
    if data['current_user_id'] is not None or not any(
        tree['username'] == 'e2e_demo' and tree['name'] == 'Seed tree'
        for tree in data['user_trees']
    ):
        raise RuntimeError('The seeded E2E database is not ready')
