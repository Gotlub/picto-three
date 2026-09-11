import { randomUUID } from 'node:crypto';
import { test, expect } from './support/browser';
import { expectImage, login, navigate } from './support/actions';

const baseURL = 'http://app-e2e:5000';

test('anonymous navigation from home through Mobile Setup tabs to Paper Tools', async ({ page }) => {
  await page.goto('/');
  await page.locator('#cookie-consent-button').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PictoTree: A free, digital pictogram binder.');
  const profilesLoaded = page.waitForResponse(response => response.url() === `${baseURL}/api/profiles/load`);
  await navigate(page, 'Mobile Setup');
  const profilesResponse = await profilesLoaded;
  expect(profilesResponse.ok()).toBe(true);
  expect(await profilesResponse.json()).toEqual({ profiles: [] });
  await expect(page).toHaveURL(`${baseURL}/builder`);
  await expect(page.locator('#tree-builder-tab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tree-builder-pane')).toBeVisible();
  await expect(page.locator('#tree-list #user-tree-select option')).toHaveText(['Seed tree']);
  await expect(page.locator('#my-resources-tab')).toHaveCount(0);

  await page.locator('#profile-builder-tab').click();
  await expect(page.locator('#profile-builder-tab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#profile-builder-pane')).toBeVisible();
  await expect(page.locator('#tree-builder-pane')).toBeHidden();
  await expect(page.locator('#collapseManageProfiles')).toHaveClass(/\bshow\b/);
  await expect(page.locator('#profile-builder-empty-msg')).toBeVisible();
  const demoTree = page.locator('#profile-builder-tree-list .profile-tree-item').filter({ hasText: 'Seed tree' });
  await expect(demoTree.locator('.tree-name')).toHaveText('Seed tree');
  await expectImage(page, demoTree.locator('img'), '/pictogramsmin/1', 1);

  await page.locator('#tree-builder-tab').click();
  await expect(page.locator('#tree-builder-pane')).toBeVisible();
  await expect(page.locator('#profile-builder-pane')).toBeHidden();
  await expect(page.locator('#collapseManageTrees')).toHaveClass(/\bshow\b/);
  await navigate(page, 'Paper Tools');
  await expect(page).toHaveURL(`${baseURL}/list`);
  await expect(page.locator('#list-page-container')).toBeVisible();
  await expect(page.locator('#import-describe-tab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#import-describe')).toBeVisible();
  await expect(page.locator('#chained-list-container .chained-list-item')).toHaveCount(0);
});

test('authentication rejects a wrong password, exposes resources after login, and logs out', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#cookie-consent-button').click();
  await page.locator('main #username').fill('e2e_auth');
  await page.locator('main #password').fill('WrongPassword123!');
  await page.locator('main #submit').click();
  await expect(page).toHaveURL(`${baseURL}/login`);
  await expect(page.locator('main .alert')).toHaveText('Invalid username or password');
  await expect(page.locator('#navbarNav a[href="/logout"]')).toHaveCount(0);

  await login(page, 'e2e_auth');
  await navigate(page, 'Mobile Setup');
  await page.locator('#my-resources-tab').click();
  await expect(page.locator('#my-resources-tab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#my-resources-pane')).toBeVisible();
  await expect(page.locator('#collapseManageResources')).toHaveClass(/\bshow\b/);
  const root = page.locator('#pictogram-display > .folder-node > .node-content');
  await expect(root.locator('span')).toHaveText('e2e_auth');
  await root.click();
  await expect(root).toHaveClass(/\bselected\b/);
  await expect(page.locator('#my-resources-pane #new-folder-name')).toBeVisible();
  await expect(page.locator('#my-resources-pane #upload-image-btn')).toBeVisible();

  await navigate(page, 'Logout');
  await expect(page).toHaveURL(`${baseURL}/index`);
  await expect(page.locator('footer')).not.toContainText('Logged in as:');
  await expect(page.locator('#navbarNav a[href="/login"]')).toHaveCount(1);
  await navigate(page, 'Mobile Setup');
  await expect(page.locator('#my-resources-tab')).toHaveCount(0);
  await expect(page.locator('#my-resources-pane')).toHaveCount(0);
});

test('builder saves an edited seeded child under a new name and reloads it through the UI', async ({ page }) => {
  const name = `E2E tree ${randomUUID()}`;
  const description = 'Edited child pictogram';
  await login(page, 'e2e_builder');
  await navigate(page, 'Mobile Setup');
  await page.locator('#tree-list #user-tree-select').selectOption({ label: 'Seed tree' });
  await page.locator('#collapseManageTrees #load-tree-btn').click();

  const root = page.locator('#tree-display > .node > .node-content');
  const child = page.locator('#tree-display > .node > .children > .node > .node-content');
  await expect(page.locator('#tree-display .node')).toHaveCount(2);
  await expect(root.locator('.node-name')).toHaveText('Root pictogram');
  await expect(child.locator('.node-name')).toHaveText('Child pictogram');
  await expectImage(page, root.locator('img'), '/pictograms/1', 1);
  await expectImage(page, child.locator('img'), '/pictograms/2', 2);
  await child.locator('.node-name').click();
  await expect(page.locator('#tree-builder-pane #node-description')).toHaveValue('Child pictogram');
  await page.locator('#tree-builder-pane #node-description').fill(description);
  await expect(child.locator('.node-name')).toHaveText(description);
  await page.locator('#collapseManageTrees #tree-name').fill(name);

  const saved = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/tree/save` && response.request().method() === 'POST');
  const created = page.waitForEvent('dialog').then(async dialog => {
    const result = { type: dialog.type(), message: dialog.message() };
    await dialog.accept();
    return result;
  });
  await page.locator('#collapseManageTrees #save-tree-btn').click();
  expect(await created).toEqual({ type: 'alert', message: 'Created' });
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: 'success' });
  await expect(page.locator('#user-tree-select option').filter({ hasText: name })).toHaveCount(1);

  await page.reload();
  await page.locator('#tree-list #user-tree-select').selectOption({ label: name });
  await page.locator('#collapseManageTrees #load-tree-btn').click();
  await expect(page.locator('#tree-display .node')).toHaveCount(2);
  await expect(root.locator('.node-name')).toHaveText('Root pictogram');
  await expect(child.locator('.node-name')).toHaveText(description);
  await expectImage(page, root.locator('img'), '/pictograms/1', 1);
  await expectImage(page, child.locator('img'), '/pictograms/2', 2);
  await child.locator('.node-name').click();
  await expect(page.locator('#tree-builder-pane #node-description')).toHaveValue(description);
});

test('List imports a local PNG, edits its description, previews landscape, saves the list, and reloads it', async ({ page }) => {
  await login(page, 'e2e_list_local');
  const listsLoaded = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/lists` && response.request().method() === 'GET');
  await navigate(page, 'Paper Tools');
  const listsResponse = await listsLoaded;
  expect(listsResponse.ok()).toBe(true);
  expect((await listsResponse.json()).current_user_id).toEqual(expect.any(Number));

  const png = await page.request.get('/pictograms/3');
  expect(png.ok()).toBe(true);
  expect(png.headers()['x-image-id']).toBe('3');
  expect(png.headers()['content-type']).toContain('image/png');
  const buffer = await png.body();
  await png.dispose();
  const src = `data:image/png;base64,${buffer.toString('base64')}`;
  await page.locator('#local-pic-input').setInputFiles({ name: 'local-green.png', mimeType: 'image/png', buffer });
  const item = page.locator('#chained-list-container .chained-list-item');
  await expect(item).toHaveCount(1);
  await expect(item.locator('p')).toHaveText('local-green');
  await expectImage(page, item.locator('img'), src);
  await item.locator('img').click();
  await expect(page.locator('#import-describe #selected-link-description')).toHaveValue('local-green');
  const description = 'Local green pictogram';
  await page.locator('#import-describe #selected-link-description').fill(description);
  await expect(item.locator('p')).toHaveText(description);

  await page.locator('#print-tab').click();
  await expect(page.locator('#print')).toBeVisible();
  await page.locator('#collapseExportPdf label[for="print-orient-landscape"]').click();
  await expect(page.locator('#print-orient-landscape')).toBeChecked();
  await page.locator('#collapseExportPdf #btn-render-preview').click();
  const preview = page.locator('#print-pages-wrapper .a4-page');
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveClass('a4-page landscape');
  await expect(preview).toHaveCSS('width', '1123px');
  await expect(preview).toHaveCSS('height', '794px');
  await expect(preview.locator('.page-content span')).toHaveText([description]);
  await expectImage(page, preview.locator('img'), src);

  await page.locator('#import-describe-tab').click();
  await page.locator('#collapseConstruct button[data-bs-target="#collapseSaveList"]').click();
  const name = `E2E local list ${randomUUID()}`;
  await page.locator('#collapseSaveList #list-name').fill(name);
  await expect(page.locator('#collapseSaveList #list-name')).toHaveValue(name);
  await expect(page.locator('footer')).toContainText('Logged in as: e2e_list_local');
  await expect(item.locator('p')).toHaveText(description);
  await expect(page.locator('#list-is-public')).toHaveCount(0);
  await expect(page.locator('#collapseSaveList #save-list-btn')).toBeEnabled();

  const saved = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/lists` && response.request().method() === 'POST');
  const created = page.waitForEvent('dialog').then(async dialog => {
    const result = { type: dialog.type(), message: dialog.message() };
    await dialog.accept();
    return result;
  });
  await page.locator('#collapseSaveList #save-list-btn').click();
  expect(await created).toEqual({ type: 'alert', message: 'Created' });
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: 'success' });

  await page.reload();
  await page.locator('#collapseConstruct button[data-bs-target="#collapseLoadList"]').click();
  await page.locator('#list-container select').selectOption({ label: `e2e_list_local - ${name}` });
  await page.locator('#collapseLoadList #load-list-btn').click();
  const reloadedItem = page.locator('#chained-list-container .chained-list-item');
  await expect(reloadedItem).toHaveCount(1);
  await expect(reloadedItem.locator('p')).toHaveText(description);
  await expectImage(page, reloadedItem.locator('img'), src);
});

test('List loads the seeded saved list in order and previews both pictograms', async ({ page }) => {
  await login(page, 'e2e_list_saved');
  await navigate(page, 'Paper Tools');
  await page.locator('#collapseConstruct button[data-bs-target="#collapseLoadList"]').click();
  await page.locator('#list-container select').selectOption({ label: 'e2e_list_saved - Seed list' });
  await page.locator('#collapseLoadList #load-list-btn').click();
  const items = page.locator('#chained-list-container .chained-list-item');
  await expect(items).toHaveCount(2);
  await expect(items.locator('p')).toHaveText(['First pictogram', 'Second pictogram']);
  await expectImage(page, items.nth(0).locator('img'), '/pictograms/1', 1);
  await expectImage(page, items.nth(1).locator('img'), '/pictograms/2', 2);
  await items.nth(1).locator('img').click();
  await expect(page.locator('#import-describe #selected-link-description')).toHaveValue('Second pictogram');

  await page.locator('#print-tab').click();
  await expect(page.locator('#print')).toBeVisible();
  await page.locator('#collapseExportPdf #btn-render-preview').click();
  const preview = page.locator('#print-pages-wrapper .a4-page');
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveClass('a4-page portrait');
  await expect(preview.locator('.page-content span')).toHaveText(['First pictogram', 'Second pictogram']);
  await expect(preview.locator('img')).toHaveCount(2);
  await expectImage(page, preview.locator('img').nth(0), '/pictograms/1', 1);
  await expectImage(page, preview.locator('img').nth(1), '/pictograms/2', 2);
});
