from unittest.mock import patch, MagicMock
import io
import shutil
from pathlib import Path

def test_export_pdf_with_remote_image(client, app):
    """Test that the PDF export endpoint handles remote images correctly."""
    
    # Mock requests.get to avoid actual network calls
    with patch('requests.get') as mock_get:
        # Create a mock response with a valid image
        mock_response = MagicMock()
        mock_response.status_code = 200
        
        # Create a simple 1x1 pixel red image for testing
        # 1x1 pixel red PNG
        red_pixel = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\xd7c\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82'
        
        mock_response.content = red_pixel
        mock_get.return_value = mock_response

        # Data for the PDF export
        data = {
            'image_data': [
                {
                    'path': 'https://static.arasaac.org/pictograms/1234/1234_500.png',
                    'description': 'Test Remote Image'
                }
            ],
            'layout_mode': 'chain',
            'orientation': 'portrait',
            'image_size': 100,
            'show_text': True
        }

        # Make the request to the PDF export endpoint
        response = client.post('/api/export_pdf', json=data)

        # Assertions
        assert response.status_code == 200
        assert response.mimetype == 'application/pdf'
        assert len(response.data) > 0
        
        # Verify requests.get was called
        mock_get.assert_called_with('https://static.arasaac.org/pictograms/1234/1234_500.png', timeout=5)
