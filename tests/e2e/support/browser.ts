import { test as base, expect, type Page } from '@playwright/test';
import { installNetwork } from './network';

export const test = base.extend<{
  networkGuard: void;
  pageErrors: Error[];
}>({
  networkGuard: [async ({ context }, use) => {
    // Automatic context fixtures run before the page fixture creates any pages.
    const unexpectedRequests = await installNetwork(context);
    await use();
    expect(unexpectedRequests, 'Unexpected external requests').toEqual([]);
  }, { auto: true }],

  pageErrors: [async ({ context }, use) => {
    const errors: Error[] = [];
    const collect = (error: Error) => errors.push(error);
    const watch = (page: Page) => page.on('pageerror', collect);
    context.on('page', watch);
    context.pages().forEach(watch);

    await use(errors);

    context.off('page', watch);
    context.pages().forEach(page => page.off('pageerror', collect));
    expect(errors.map(error => error.stack || error.message), 'Unexpected page errors').toEqual([]);
  }, { auto: true }],
});

export { expect };
