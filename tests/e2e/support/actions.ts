import type { Locator, Page } from '@playwright/test';
import { expect } from './browser';

const baseURL = 'http://app-e2e:5000';
const password = 'E2eOnlyPassword123!';

export async function navigate(page: Page, name: string) {
  const nav = page.locator('#navbarNav');
  if (!await nav.isVisible()) {
    await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  }
  await nav.getByRole('link', { name, exact: true }).click();
  // Bootstrap links are usable before the module's DOMContentLoaded listeners.
  await page.waitForLoadState('domcontentloaded');
}

export async function login(page: Page, username: string) {
  await page.goto('/login');
  if (await page.locator('#cookie-consent-button').isVisible()) {
    await page.locator('#cookie-consent-button').click();
  }
  await page.locator('main #username').fill(username);
  await page.locator('main #password').fill(password);
  await page.locator('main #submit').click();
  await expect(page).toHaveURL(`${baseURL}/index`);
  await expect(page.locator('footer')).toContainText(`Logged in as: ${username}`);
}

export async function expectImage(page: Page, image: Locator, src: string, imageId?: number) {
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', src);
  await expect.poll(() => image.evaluate(element => {
    const img = element as HTMLImageElement;
    return { complete: img.complete, width: img.naturalWidth, height: img.naturalHeight };
  })).toEqual({ complete: true, width: 96, height: 96 });
  if (imageId !== undefined) {
    // The backend can return a decoded placeholder with HTTP 200; verify identity too.
    const response = await page.request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['x-image-id']).toBe(String(imageId));
    expect(response.headers()['content-type']).toContain('image/png');
    await response.dispose();
  }
}
