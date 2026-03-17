import re

def test_list_page_loads(client):
    """Tests that the /list page loads correctly."""
    response = client.get('/list')
    assert response.status_code == 200
    assert b'Chained List Builder' in response.data

def test_list_page_has_image_search(client):
    """Tests that the /list page contains the image search input."""
    response = client.get('/list')
    assert response.status_code == 200
    assert b'id="image-search"' in response.data

def test_list_js_contains_filter_logic(client):
    """
    Tests that the list.js file contains the filtering logic.
    This is a proxy for a full frontend test.
    """
    # First, get the list page to find the script URL
    list_response = client.get('/list')
    assert list_response.status_code == 200

    # Use regex to find the script tag for list.js, including any versioning
    script_tag_match = re.search(r'<script[^>]*src="(/static/js/list\.js[^"]*)"', list_response.data.decode())
    assert script_tag_match is not None

    script_url = script_tag_match.group(1)

    # Now, request the JS file itself
    js_response = client.get(script_url)
    assert js_response.status_code == 200
    js_content = js_response.data.decode()

    # Check that the key components of the filter logic exist in the file
    assert "filterImages" in js_content
    assert "imageTree.filter(searchTerm)" in js_content
    assert "ImageTree.prototype.filter" not in js_content # Make sure it's on the instance
