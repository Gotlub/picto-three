import re
from playwright.sync_api import sync_playwright, Page, expect

BASE_URL = "http://127.0.0.1:5000"

def get_csrf_token(page: Page):
    csrf_input = page.locator('input[name="csrf_token"]')
    expect(csrf_input).to_have_count(1)
    return csrf_input.get_attribute("value")

def login(page: Page, username="testuser", password="password"):
    page.goto(f"{BASE_URL}/login")
    page.get_by_label("Username").fill(username)
    page.get_by_label("Password").fill(password)
    page.get_by_role("button", name="Sign In").click()
    expect(page.get_by_role("link", name="Logout")).to_be_visible()

def register_and_login(page: Page, username="testuser", password="password"):
    page.goto(f"{BASE_URL}/register")
    csrf_token = get_csrf_token(page)
    page.get_by_label("Username").fill(username)
    page.get_by_label("Email").fill(f"{username}@example.com")
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_label("Repeat Password").fill(password)
    page.get_by_role("button", name="Register").click()
    login(page, username, password)

def test_save_confirmation_scenarios(page: Page):
    print("--- Testing Builder Save Confirmation Scenarios ---")
    page.goto(f"{BASE_URL}/builder")

    # 1. Create and save a PUBLIC tree
    print("Step 1: Saving a public tree...")
    public_folder = page.get_by_text("public", exact=True)
    expect(public_folder).to_be_visible()
    public_folder.click()
    bold_folder = page.get_by_text("bold", exact=True)
    expect(bold_folder).to_be_visible(timeout=10000)
    bold_folder.click()
    first_image = page.locator(".image-tree-node.image .node-content").first
    expect(first_image).to_be_visible(timeout=10000)
    first_image.click()

    tree_name_input = page.get_by_label("Tree Name")
    save_button = page.get_by_role("button", name="Save Tree")
    public_checkbox = page.get_by_label("Make Public")

    tree_name_input.fill("My Cross-Status Tree")
    public_checkbox.check()

    page.once("dialog", lambda dialog: dialog.accept()) # Accept the "saved successfully" dialog
    save_button.click()
    print("Public tree saved.")

    # Reload the page to ensure the list of saves is updated
    page.reload()
    page.wait_for_load_state("domcontentloaded")

    # 2. Modify the tree and try to save it as PRIVATE with the same name
    print("Step 2: Attempting to overwrite with a private save...")

    # Re-select the elements after reload
    tree_name_input = page.get_by_label("Tree Name")
    save_button = page.get_by_role("button", name="Save Tree")
    public_checkbox = page.get_by_label("Make Public")

    # The tree is gone after reload, so add an image again
    public_folder = page.get_by_text("public", exact=True)
    expect(public_folder).to_be_visible()
    public_folder.click()
    bold_folder = page.get_by_text("bold", exact=True)
    expect(bold_folder).to_be_visible(timeout=10000)
    bold_folder.click()
    first_image = page.locator(".image-tree-node.image .node-content").first
    expect(first_image).to_be_visible(timeout=10000)
    first_image.click()

    tree_name_input.fill("My Cross-Status Tree")
    public_checkbox.uncheck() # Make it private

    # Expect the confirmation dialog
    with page.expect_event("dialog") as dialog_info:
        save_button.click()
    dialog = dialog_info.value

    print(f"Dialog message: {dialog.message}")
    expect(dialog.message).to_equal("A save with this name already exists. Your old save will be replaced by the current one. Continue?")
    dialog.dismiss()
    print("Confirmation dialog appeared correctly for public -> private overwrite.")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        register_and_login(page)
        test_save_confirmation_scenarios(page)
        browser.close()
        print("\nVerification script finished successfully!")

if __name__ == "__main__":
    main()
