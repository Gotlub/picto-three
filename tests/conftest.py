import pytest
from app import create_app, db

@pytest.fixture
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///test.db"
    })

    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

from app.models import Image

@pytest.fixture
def client(app):
    with app.app_context():
        # Add a test image
        image = Image(name='acorn-bold', path='app/static/images/pictograms/bold/acorn-bold.png', is_public=True)
        db.session.add(image)
        db.session.commit()
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()
