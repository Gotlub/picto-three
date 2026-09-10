import { randomUUID } from 'node:crypto';
import type { Page, Request } from '@playwright/test';
import { test, expect } from './support/browser';
import { expectImage, login, navigate } from './support/actions';

const baseURL = 'http://app-e2e:5000';

function expectDialog(page: Page, type: 'alert' | 'confirm', message: string, accept = true) {
  return page.waitForEvent('dialog').then(async dialog => {
    const actual = { type: dialog.type(), message: dialog.message() };
    if (accept) await dialog.accept();
    else await dialog.dismiss();
    expect(actual).toEqual({ type, message });
  });
}

test('Tree Builder constructs a three-level tree from public images and preserves it after save and reload', async ({ page }) => {
  const name = `E2E DnD tree ${randomUUID()}`;
  await login(page, 'e2e_tree_dnd');
  await navigate(page, 'Mobile Setup');
  await page.locator('#image-sidebar-tree .folder > .node-content').filter({ hasText: 'E2E public' }).click();
  const images = page.locator('#image-sidebar-tree .image-tree-node.image');
  const red = images.filter({ has: page.getByAltText('e2e-red.png', { exact: true }) });
  const blue = images.filter({ has: page.getByAltText('e2e-blue.png', { exact: true }) });
  const green = images.filter({ has: page.getByAltText('e2e-green.png', { exact: true }) });
  await expectImage(page, red.locator('img'), '/pictogramsmin/1', 1);
  await expectImage(page, blue.locator('img'), '/pictogramsmin/2', 2);
  await expectImage(page, green.locator('img'), '/pictogramsmin/3', 3);

  const root = page.locator('#tree-display > .node > .node-content');
  const child = page.locator('#tree-display > .node > .children > .node > .node-content');
  const grandchild = page.locator('#tree-display > .node > .children > .node > .children > .node > .node-content');
  await expect(root.locator('.node-name')).toHaveText('Choose the root image');
  const placeholderBox = await root.boundingBox();
  expect(placeholderBox).not.toBeNull();
  // Root top half replaces the placeholder; bottom half adds a child.
  await red.locator('.node-content').dragTo(root, {
    targetPosition: { x: placeholderBox!.width / 2, y: placeholderBox!.height * 0.2 },
  });
  await expect(root.locator('.node-name')).toHaveText('Red pictogram');
  const rootBox = await root.boundingBox();
  expect(rootBox).not.toBeNull();
  await blue.locator('.node-content').dragTo(root, {
    targetPosition: { x: rootBox!.width / 2, y: rootBox!.height * 0.8 },
  });
  await expect(child.locator('.node-name')).toHaveText('Blue pictogram');
  await green.locator('.node-content').dragTo(child);
  await expect(grandchild.locator('.node-name')).toHaveText('Green pictogram');
  await expect(page.locator('#tree-display .node')).toHaveCount(3);

  for (const [node, description] of [[root, 'Choose a meal'], [child, 'Choose a drink'], [grandchild, 'Water please']] as const) {
    await node.locator('.node-name').click();
    await page.locator('#tree-builder-pane #node-description').fill(description);
    await expect(node.locator('.node-name')).toHaveText(description);
  }
  await page.locator('#collapseManageTrees #tree-name').fill(name);
  const saved = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/tree/save` && response.request().method() === 'POST');
  const created = expectDialog(page, 'alert', 'Created');
  await page.locator('#collapseManageTrees #save-tree-btn').click();
  await created;
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: 'success' });
  await expect(page.locator('#user-tree-select option')).toHaveText([name]);

  await page.reload();
  await page.locator('#tree-list #user-tree-select').selectOption({ label: name });
  await page.locator('#collapseManageTrees #load-tree-btn').click();
  await expect(page.locator('#tree-display .node')).toHaveCount(3);
  await expect(root.locator('.node-name')).toHaveText('Choose a meal');
  await expect(child.locator('.node-name')).toHaveText('Choose a drink');
  await expect(grandchild.locator('.node-name')).toHaveText('Water please');
  await expectImage(page, root.locator('img'), '/pictograms/1', 1);
  await expectImage(page, child.locator('img'), '/pictograms/2', 2);
  await expectImage(page, grandchild.locator('img'), '/pictograms/3', 3);
});

test('Tree Builder cancels an overwrite without changing the saved tree, then confirms and persists it', async ({ page }) => {
  const confirmation = 'A tree with this name already exists. Are you sure you want to overwrite it?';
  const description = 'Overwritten child';
  await login(page, 'e2e_tree_overwrite');
  await navigate(page, 'Mobile Setup');
  const select = page.locator('#tree-list #user-tree-select');
  const load = page.locator('#collapseManageTrees #load-tree-btn');
  const name = page.locator('#collapseManageTrees #tree-name');
  const child = page.locator('#tree-display > .node > .children > .node > .node-content');
  await select.selectOption({ label: 'Seed tree' });
  const treeId = await select.inputValue();
  await load.click();
  await expect(child.locator('.node-name')).toHaveText('Child pictogram');
  // Load does not fill the name, so explicitly target the existing saved tree.
  await expect(name).toHaveValue('');
  await child.locator('.node-name').click();
  await page.locator('#tree-builder-pane #node-description').fill(description);
  await name.fill('Seed tree');
  const cancelledWrites: string[] = [];
  const recordWrite = (request: Request) => {
    if (request.url() === `${baseURL}/api/tree/save` && request.method() === 'POST') {
      cancelledWrites.push(request.url());
    }
  };
  page.on('request', recordWrite);
  const cancelled = expectDialog(page, 'confirm', confirmation, false);
  await page.locator('#collapseManageTrees #save-tree-btn').click();
  await cancelled;
  await expect(child.locator('.node-name')).toHaveText(description);

  await page.reload();
  await select.selectOption({ label: 'Seed tree' });
  await load.click();
  await expect(child.locator('.node-name')).toHaveText('Child pictogram');
  expect(cancelledWrites, 'Cancelling must not attempt a save, even one aborted by reload').toEqual([]);
  page.off('request', recordWrite);
  await child.locator('.node-name').click();
  await page.locator('#tree-builder-pane #node-description').fill(description);
  await name.fill('Seed tree');
  const saved = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/tree/save` && response.request().method() === 'POST');
  const confirmed = page.waitForEvent('dialog').then(async dialog => {
    const actual = { type: dialog.type(), message: dialog.message() };
    // Install the success handler before accepting the confirm, which starts fetch.
    const updated = expectDialog(page, 'alert', 'Updated');
    await dialog.accept();
    expect(actual).toEqual({ type: 'confirm', message: confirmation });
    await updated;
  });
  await page.locator('#collapseManageTrees #save-tree-btn').click();
  await confirmed;
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: 'success' });
  await expect(select.locator('option')).toHaveText(['Seed tree']);

  await page.reload();
  await select.selectOption({ label: 'Seed tree' });
  await expect(select).toHaveValue(treeId);
  await expect(select.locator('option')).toHaveText(['Seed tree']);
  await load.click();
  await expect(page.locator('#tree-display .node')).toHaveCount(2);
  const root = page.locator('#tree-display > .node > .node-content');
  await expect(root.locator('.node-name')).toHaveText('Root pictogram');
  await expect(child.locator('.node-name')).toHaveText(description);
  await expectImage(page, root.locator('img'), '/pictograms/1', 1);
  await expectImage(page, child.locator('img'), '/pictograms/2', 2);
});

test('Binder Builder composes and reorders two owned trees with a color and local avatar, then reloads them', async ({ page }) => {
  const name = `E2E binder ${randomUUID()}`;
  await login(page, 'e2e_binder');
  await navigate(page, 'Mobile Setup');
  await page.locator('#profile-builder-tab').click();
  const sources = page.locator('#profile-builder-tree-list .profile-tree-item');
  const firstSource = sources.filter({ hasText: 'Binder first' });
  const secondSource = sources.filter({ hasText: 'Binder second' });
  await expect(sources).toHaveCount(2);
  await expectImage(page, firstSource.locator('img'), '/pictogramsmin/1', 1);
  await expectImage(page, secondSource.locator('img'), '/pictogramsmin/3', 3);
  const items = page.locator('#profile-trees-list .profile-dropped-tree-item');
  const names = items.locator('span.fw-bold:not(.tree-number)');
  await firstSource.locator('.tree-name').dragTo(page.locator('#profile-trees-list'));
  await expect(names).toHaveText(['Binder first']);
  const firstBox = await items.first().boundingBox();
  expect(firstBox).not.toBeNull();
  await secondSource.locator('.tree-name').dragTo(items.first(), {
    targetPosition: { x: firstBox!.width / 2, y: firstBox!.height * 0.8 },
  });
  await expect(names).toHaveText(['Binder first', 'Binder second']);
  await items.nth(1).locator('.tree-number').dragTo(items.nth(0), {
    targetPosition: { x: firstBox!.width / 2, y: firstBox!.height * 0.2 },
  });
  await expect(names).toHaveText(['Binder second', 'Binder first']);
  await expect(items.locator('.tree-number')).toHaveText(['1.', '2.']);
  await expect(page.locator('#profile-builder-empty-msg')).toBeHidden();
  await items.first().getByRole('button', { name: 'Black', exact: true }).click();
  await items.first().getByRole('link', { name: 'Blue', exact: true }).click();
  await expect(items.first().getByRole('button', { name: 'Blue', exact: true })).toBeVisible();

  await page.locator('#profile-avatar-container').click();
  await expect(page.locator('#avatar-modal')).toBeVisible();
  await page.locator('#modal-image-sidebar-tree .folder > .node-content').filter({ hasText: 'E2E public' }).click();
  await page.locator('#modal-image-sidebar-tree').getByAltText('e2e-blue.png', { exact: true }).click();
  await expect(page.locator('#avatar-modal')).toBeHidden();
  await expectImage(page, page.locator('#profile-image-preview'), '/pictogramsmin/2', 2);
  await page.locator('#collapseManageProfiles #profile-name').fill(name);
  const saved = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/profile/save` && response.request().method() === 'POST');
  const created = expectDialog(page, 'alert', 'Profile saved successfully');
  await page.locator('#collapseManageProfiles #save-profile-btn').click();
  await created;
  expect((await saved).ok()).toBe(true);
  await expect(page.locator('#profile-select option')).toHaveText([name]);

  await page.reload();
  await page.locator('#profile-builder-tab').click();
  await page.locator('#profile-select').selectOption({ label: name });
  await page.locator('#collapseManageProfiles #load-profile-btn').click();
  await expect(page.locator('#collapseManageProfiles #profile-name')).toHaveValue(name);
  await expect(names).toHaveText(['Binder second', 'Binder first']);
  await expect(items.locator('.tree-number')).toHaveText(['1.', '2.']);
  await expect(items.first().getByRole('button', { name: 'Blue', exact: true })).toBeVisible();
  await expect(items.nth(1).getByRole('button', { name: 'Black', exact: true })).toBeVisible();
  await expectImage(page, items.first().locator('img'), '/pictogramsmin/3', 3);
  await expectImage(page, items.nth(1).locator('img'), '/pictogramsmin/1', 1);
  await expectImage(page, page.locator('#profile-image-preview'), '/pictogramsmin/2', 2);
});

test('My Resources creates a subfolder, uploads and edits a PNG, then persists cancelled and confirmed deletion', async ({ page }) => {
  const folderName = `E2E-folder-${randomUUID()}`;
  const filename = `resource-${randomUUID()}.png`;
  const description = 'My edited green pictogram';
  await login(page, 'e2e_resources');
  const png = await page.request.get('/pictograms/3');
  expect(png.ok()).toBe(true);
  expect(png.headers()['x-image-id']).toBe('3');
  expect(png.headers()['content-type']).toContain('image/png');
  const buffer = await png.body();
  await png.dispose();
  await navigate(page, 'Mobile Setup');
  await page.locator('#my-resources-tab').click();
  const root = page.locator('#pictogram-display > .folder-node');
  await expect(root.locator(':scope > .node-content > span')).toHaveText('e2e_resources');
  await root.locator(':scope > .node-content').click();
  await page.locator('#my-resources-pane #new-folder-name').fill(folderName);
  const created = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/folder/create` && response.request().method() === 'POST');
  await page.locator('#my-resources-pane #create-folder-btn').click();
  const folderResponse = await created;
  expect(folderResponse.ok()).toBe(true);
  const folderData = await folderResponse.json();
  expect(folderData).toMatchObject({ status: 'success', folder: { id: expect.any(Number), name: folderName } });
  const folder = root.locator(`:scope > .children > .folder-node[data-id="${folderData.folder.id}"]`);
  await expect(folder.locator(':scope > .node-content > span')).toHaveText(folderName);
  await folder.locator(':scope > .node-content').click();
  await page.locator('#image-upload-file').setInputFiles({ name: filename, mimeType: 'image/png', buffer });
  await expect(page.locator('#file-chosen')).toHaveText(filename);
  await page.locator('#image-description').fill('My uploaded green pictogram');
  const uploaded = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/image/upload` && response.request().method() === 'POST');
  await page.locator('#upload-image-btn').click();
  const uploadResponse = await uploaded;
  expect(uploadResponse.ok()).toBe(true);
  const uploadData = await uploadResponse.json();
  expect(uploadData).toMatchObject({ status: 'success', image: {
    id: expect.any(Number), folder_id: folderData.folder.id, name: filename, is_public: false,
  } });
  const imageId: number = uploadData.image.id;
  const image = folder.locator(`:scope > .children > .image-node[data-id="${imageId}"]`);
  await expectImage(page, image.locator('img'), `/pictograms/${imageId}`, imageId);
  await image.locator('span').click();
  await expect(page.locator('#edit-image-description')).toHaveValue('My uploaded green pictogram');
  await page.locator('#edit-image-description').fill(description);
  const updated = expectDialog(page, 'alert', 'Image updated successfully!');
  await page.locator('#save-image-changes-btn').click();
  await updated;

  await page.reload();
  await page.locator('#my-resources-tab').click();
  await expect(folder.locator(':scope > .node-content > span')).toHaveText(folderName);
  await image.locator('span').click();
  await expect(page.locator('#edit-image-description')).toHaveValue(description);
  await expectImage(page, image.locator('img'), `/pictograms/${imageId}`, imageId);
  await page.locator('#tree-builder-tab').click();
  const resourceRoot = page.locator('#image-sidebar-tree .folder > .node-content').filter({ hasText: 'e2e_resources' });
  await resourceRoot.click();
  // Expanding refreshes and replaces the initial child folder elements.
  await expect(resourceRoot.locator('.refresh-btn')).not.toHaveClass(/\bspin\b/);
  await page.locator('#image-sidebar-tree .folder > .node-content').filter({ hasText: folderName }).click();
  await expectImage(page, page.locator('#image-sidebar-tree').getByAltText(filename, { exact: true }), `/pictogramsmin/${imageId}`, imageId);

  await page.locator('#my-resources-tab').click();
  await image.locator('span').click();
  const confirmation = 'Are you sure you want to delete the selected item? This action cannot be undone.';
  const cancelledDeletes: string[] = [];
  const recordDelete = (request: Request) => {
    if (request.url() === `${baseURL}/api/item/delete` && request.method() === 'DELETE') {
      cancelledDeletes.push(request.url());
    }
  };
  page.on('request', recordDelete);
  const cancelled = expectDialog(page, 'confirm', confirmation, false);
  await page.locator('#bank-delete-btn').click();
  await cancelled;
  await page.reload();
  await page.locator('#my-resources-tab').click();
  await image.locator('span').click();
  await expect(page.locator('#edit-image-description')).toHaveValue(description);
  expect(cancelledDeletes, 'Cancelling must not attempt deletion').toEqual([]);
  page.off('request', recordDelete);
  const deleted = page.waitForResponse(response =>
    response.url() === `${baseURL}/api/item/delete` && response.request().method() === 'DELETE');
  const confirmed = expectDialog(page, 'confirm', confirmation);
  await page.locator('#bank-delete-btn').click();
  await confirmed;
  const deleteResponse = await deleted;
  expect(deleteResponse.ok()).toBe(true);
  expect(await deleteResponse.json()).toMatchObject({ status: 'success' });
  await expect(image).toHaveCount(0);
  await page.reload();
  await page.locator('#my-resources-tab').click();
  await expect(folder.locator(':scope > .node-content > span')).toHaveText(folderName);
  await expect(folder.locator('.image-node')).toHaveCount(0);
  await page.locator('#tree-builder-tab').click();
  await resourceRoot.click();
  await expect(resourceRoot.locator('.refresh-btn')).not.toHaveClass(/\bspin\b/);
  await page.locator('#image-sidebar-tree .folder > .node-content').filter({ hasText: folderName }).click();
  await expect(page.locator('#image-sidebar-tree').getByText('Empty folder', { exact: true })).toBeVisible();
  await expect(page.locator('#image-sidebar-tree').getByAltText(filename, { exact: true })).toHaveCount(0);
});

test('List reorders local images, deletes a link, cancels New Chain, and downloads a nominal PDF', async ({ page }, testInfo) => {
  await login(page, 'e2e_list_edit');
  const png = await page.request.get('/pictograms/3');
  expect(png.ok()).toBe(true);
  expect(png.headers()['x-image-id']).toBe('3');
  expect(png.headers()['content-type']).toContain('image/png');
  const buffer = await png.body();
  await png.dispose();
  const src = `data:image/png;base64,${buffer.toString('base64')}`;
  await navigate(page, 'Paper Tools');
  const items = page.locator('#chained-list-container .chained-list-item');
  for (const [index, description] of ['First', 'Second', 'Third'].entries()) {
    await page.locator('#local-pic-input').setInputFiles({
      name: `local-${randomUUID()}.png`, mimeType: 'image/png', buffer,
    });
    await expect(items).toHaveCount(index + 1);
    await items.nth(index).locator('img').click();
    await page.locator('#selected-link-description').fill(description);
    await expect(items.nth(index).locator('p')).toHaveText(description);
    await expectImage(page, items.nth(index).locator('img'), src);
  }
  await items.nth(2).locator('p').dragTo(items.nth(0), { targetPosition: { x: 5, y: 20 } });
  await expect(items.locator('p')).toHaveText(['Third', 'First', 'Second']);
  await items.nth(1).locator('img').click();
  await page.locator('#delete-link-btn').click();
  await expect(items.locator('p')).toHaveText(['Third', 'Second']);
  await expect(page.locator('#selected-link-description')).toBeDisabled();
  const cancelled = expectDialog(page, 'confirm', 'Are you sure you want to clear the entire chain?', false);
  await page.locator('#new-chain-btn').click();
  await cancelled;
  await expect(items.locator('p')).toHaveText(['Third', 'Second']);

  await page.locator('#print-tab').click();
  await page.locator('#collapseExportPdf #btn-render-preview').click();
  const preview = page.locator('#print-pages-wrapper .a4-page');
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveClass('a4-page portrait');
  await expect(preview.locator('.page-content span')).toHaveText(['Third', 'Second']);
  await expectImage(page, preview.locator('img').nth(0), src);
  await expectImage(page, preview.locator('img').nth(1), src);
  const downloading = page.waitForEvent('download');
  await page.locator('#export-pdf-btn').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('pictograms-list.pdf');
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks);
  expect(pdf.length).toBeGreaterThan(1000);
  expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  const content = pdf.toString('latin1');
  expect(content).toMatch(/%%EOF\s*$/);
  expect(content).toMatch(/\/Type\s*\/Page\b/);
  expect(content).toMatch(/\/Subtype\s*\/Image\b/);
  expect(content).toContain('(Third)');
  expect(content).toContain('(Second)');
  expect(content).not.toContain('(First)');
  const pdfPath = testInfo.outputPath('pictograms-list.pdf');
  await download.saveAs(pdfPath);
  await testInfo.attach('List PDF', { path: pdfPath, contentType: 'application/pdf' });
  await expect(page.locator('#export-pdf-btn')).toBeEnabled();
});
