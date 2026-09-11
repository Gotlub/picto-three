"""Create a small, disposable dataset. Never reset an existing database."""

import hashlib
import json
from datetime import UTC, datetime

from flask_migrate import upgrade
from PIL import Image as PILImage
from PIL import ImageDraw
from settings import CONFIG, DATA
from sqlalchemy import inspect
from sqlalchemy.engine import make_url

from app import create_app, db
from app.models import Folder, Image, PictogramList, Tree, User

if any(DATA.iterdir()):
    raise RuntimeError('E2E assets already exist; recreate the E2E stack')

app = create_app(CONFIG)
with app.app_context():
    if db.engine.url != make_url(CONFIG['SQLALCHEMY_DATABASE_URI']):
        raise RuntimeError('Unexpected effective E2E PostgreSQL target')
    if inspect(db.engine).get_table_names():
        raise RuntimeError('E2E schema already exists; recreate the E2E stack')
    upgrade(directory='/app/migrations', revision='head')
    public = Folder(name='E2E public', path='public', user_id=None)
    db.session.add(public)
    db.session.flush()
    images = []
    for color in ('red', 'blue', 'green'):
        path = f'public/e2e-{color}.png'
        picture = PILImage.new('RGB', (96, 96), 'white')
        ImageDraw.Draw(picture).rectangle((12, 12, 84, 84), fill=color)
        for directory in (CONFIG['PICTOGRAMS_PATH'], CONFIG['PICTOGRAMS_PATH_MIN']):
            target = directory / path
            target.parent.mkdir(parents=True, exist_ok=True)
            picture.save(target, 'PNG')
        image = Image(
            name=f'e2e-{color}.png', path=path,
            description=f'{color.capitalize()} pictogram',
            is_public=True, folder_id=public.id,
            image_hash=hashlib.sha256((CONFIG['PICTOGRAMS_PATH'] / path).read_bytes()).hexdigest(),
        )
        db.session.add(image)
        images.append(image)
    db.session.flush()

    for scenario in (
        'demo', 'auth', 'builder', 'list_local', 'list_saved',
        'tree_dnd', 'tree_overwrite', 'binder', 'resources', 'list_edit',
        'tree_reorder',
    ):
        user = User(
            username=f'e2e_{scenario}', email=f'{scenario}@example.test',
            confirmed=True, confirmed_on=datetime.now(UTC), locale='en',
        )
        user.set_password('E2eOnlyPassword123!')
        db.session.add(user)
        db.session.flush()
        db.session.add(Folder(name=user.username, path=user.username, user_id=user.id))
        for directory in (CONFIG['PICTOGRAMS_PATH'], CONFIG['PICTOGRAMS_PATH_MIN']):
            (directory / user.username).mkdir()

        trees = []
        if scenario in ('demo', 'builder', 'tree_overwrite'):
            trees = [('Seed tree', images[0])]
        elif scenario == 'binder':
            trees = [('Binder first', images[0]), ('Binder second', images[2])]
        for name, root_image in trees:
            root = {
                'id': root_image.id, 'url': f'/pictograms/{root_image.id}', 'name': root_image.name,
                'description': 'Root pictogram', 'children': [{
                    'id': images[1].id, 'url': f'/pictograms/{images[1].id}', 'name': images[1].name,
                    'description': 'Child pictogram', 'children': [],
                }],
            }
            db.session.add(Tree(
                name=name, user_id=user.id, root_id=root_image.id,
                root_url=f'/pictograms/{root_image.id}', json_data=json.dumps({'roots': [root]}),
                is_public=False,
            ))
        if scenario == 'tree_reorder':
            reorder_root = {
                'id': images[0].id, 'url': f'/pictograms/{images[0].id}', 'name': images[0].name,
                'description': 'Root pictogram', 'children': [
                    {
                        'id': images[1].id, 'url': f'/pictograms/{images[1].id}', 'name': images[1].name,
                        'description': 'Child one', 'children': [
                            {
                                'id': images[2].id, 'url': f'/pictograms/{images[2].id}', 'name': images[2].name,
                                'description': 'Grandchild', 'children': [],
                            }
                        ],
                    },
                    {
                        'id': images[2].id, 'url': f'/pictograms/{images[2].id}', 'name': images[2].name,
                        'description': 'Child two', 'children': [],
                    },
                ],
            }
            db.session.add(Tree(
                name='Reorder tree', user_id=user.id, root_id=images[0].id,
                root_url=f'/pictograms/{images[0].id}', json_data=json.dumps({'roots': [reorder_root]}),
                is_public=False,
            ))
        if scenario == 'list_saved':
            payload = [{
                'image_id': image.id, 'url': f'/pictograms/{image.id}',
                'name': image.name, 'description': description,
            } for image, description in zip(images, ('First pictogram', 'Second pictogram'))]
            db.session.add(PictogramList(
                list_name='Seed list', user_id=user.id, is_public=False,
                payload=json.dumps(payload),
            ))
    db.session.commit()
    print('E2E seed ready: migrated PostgreSQL 15, 11 accounts, 3 images and thumbnails', flush=True)
