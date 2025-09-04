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
    assert b'id="filterInput"' in response.data

def test_common_filter_js_is_used_on_list_page(client):
    """
    Tests that the common-filter.js file is used on the /list page and contains the filtering logic.
    """
    # First, get the list page to find the script URL
    list_response = client.get('/list')
    assert list_response.status_code == 200

    # Use regex to find the script tag for common-filter.js
    script_tag_match = re.search(r'<script src="(/static/js/common-filter\.js[^"]*)" defer></script>', list_response.data.decode())
    assert script_tag_match is not None, "common-filter.js script not found on /list page"

    script_url = script_tag_match.group(1)

    # Now, request the JS file itself
    js_response = client.get(script_url)
    assert js_response.status_code == 200
    js_content = js_response.data.decode()

    # Check that the key components of the filter logic exist in the file
    assert "handleFilter" in js_content
    assert "fetchAllPictos" in js_content
    assert "fetch('/api/pictograms_all')" in js_content
