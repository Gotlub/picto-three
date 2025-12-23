import pytest
from app import create_app, db
from app.models import User
import json

@pytest.fixture
def client():
    app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:', 'WTF_CSRF_ENABLED': False})
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

def test_export_pdf_with_padding(client):
    # Prepare data
    data = {
        'image_data': [{'path': 'test.png', 'description': 'Test Image'}],
        'layout_mode': 'chain',
        'padding_x': 20,
        'padding_y': 30
    }
    
    # Send request
    response = client.post('/api/export_pdf', json=data)
    
    # Check response
    assert response.status_code == 200
    assert response.headers['Content-Type'] == 'application/pdf'
