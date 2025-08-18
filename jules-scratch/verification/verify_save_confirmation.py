import re
from playwright.sync_api import sync_playwright, Page, expect

BASE_URL = "http://127.0.0.1:5000"

def get_csrf_token(page: Page):
    """Extracts CSRF token from a page."""
    csrf_input = page.locator('input[name="csrf_token"]')
    # The input is hidden, so we cannot check for visibility.
    # We just need to ensure it exists before getting the value.
    expect(csrf_input).to_have_count(1)
    return csrf_input.get_attribute("value")

def login(page: Page, username="testuser", password="password"):
    """Logs in a user."""
    page.goto(f"{BASE_URL}/login")
    page.get_by_label("Username").fill(username)
    page.get_by_label("Password").fill(password)
    page.get_by_role("button", name="Sign In").click()
    expect(page.get_by_role("link", name="Logout")).to_be_visible()

def register_and_login(page: Page, username="testuser", password="password"):
    """Registers a new user and logs in."""
    page.goto(f"{BASE_URL}/register")
    csrf_token = get_csrf_token(page)
    page.get_by_label("Username").fill(username)
    page.get_by_label("Email").fill(f"{username}@example.com")
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_label("Repeat Password").fill(password)
    page.get_by_role("button", name="Register").click()
    # After registration, login
    login(page, username, password)

def test_builder_save_confirmation(page: Page):
    """Tests the save confirmation dialog on the builder page."""
    print("Testing builder save confirmation...")
    page.goto(f"{BASE_URL}/builder")

    # Add an image to the tree to enable saving
    # Expand the public folder and then the 'bold' subfolder
    public_folder = page.get_by_text("public", exact=True)
    expect(public_folder).to_be_visible()
    public_folder.click()

    bold_folder = page.get_by_text("bold", exact=True)
    expect(bold_folder).to_be_visible(timeout=10000) # Wait for subfolder to appear
    bold_folder.click()

    # Now click on the first image
    first_image_in_sidebar = page.locator(".image-tree-node.image .node-content").first
    expect(first_image_in_sidebar).to_be_visible(timeout=10000)
    first_image_in_sidebar.click()

    # Save the tree for the first time
    tree_name_input = page.get_by_label("Tree Name")
    save_button = page.get_by_role("button", name="Save")

    tree_name_input.fill("My Test Tree")

    # Use a dialog listener to handle the success alert
    page.once("dialog", lambda dialog: dialog.accept())
    save_button.click()

    # Accept the first "success" dialog and wait for the UI to refresh
    page.once("dialog", lambda dialog: dialog.accept())
    save_button.click()
    page.wait_for_timeout(2000) # Pragmatic wait for UI to update

    # Now, try to save again with the same name to trigger the confirmation
    with page.expect_event("dialog") as dialog_info:
        save_button.click()
    dialog = dialog_info.value

    # Take screenshot while the dialog is open
    page.screenshot(path="jules-scratch/verification/builder_confirmation.png")
    print("Builder screenshot taken.")

    # Assert on the dialog's message and then dismiss it
    expect(dialog.message).to_equal("A save with this name already exists. Your old save will be replaced by the current one. Continue?")
    dialog.dismiss()


def test_list_save_confirmation(page: Page):
    """Tests the save confirmation dialog on the list page."""
    print("Testing list save confirmation...")
    page.goto(f"{BASE_URL}/list")

    # Add an image to the list to enable saving
    first_image_in_sidebar = page.locator(".image-tree-node.image .node-content").first
    expect(first_image_in_sidebar).to_be_visible()

    # Drag the image to the list container
    list_container = page.locator("#chained-list-container")
    first_image_in_sidebar.drag_to(list_container)

    # Save the list for the first time
    list_name_input = page.get_by_label("List Name:")
    save_button = page.get_by_role("button", name="Save List")

    list_name_input.fill("My Test List")

    # Use a dialog listener to handle the success alert
    page.once("dialog", lambda dialog: dialog.accept())
    save_button.click()

    # Accept the first "success" dialog and wait for the UI to refresh
    page.once("dialog", lambda dialog: dialog.accept())
    save_button.click()
    page.wait_for_timeout(2000) # Pragmatic wait for UI to update

    # Now, try to save again with the same name
    with page.expect_event("dialog") as dialog_info:
        save_button.click()
    dialog = dialog_info.value

    # Take screenshot while the dialog is open
    page.screenshot(path="jules-scratch/verification/list_confirmation.png")
    print("List screenshot taken.")

    # Assert on the dialog's message and then dismiss it
    expect(dialog.message).to_equal("A save with this name already exists. Your old save will be replaced by the current one. Continue?")
    dialog.dismiss()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Register a user first, as the test environment is clean
        register_and_login(page)

        test_builder_save_confirmation(page)
        test_list_save_confirmation(page)

        browser.close()
        print("Verification script finished successfully.")

if __name__ == "__main__":
    main()
