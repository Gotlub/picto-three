import type { BrowserContext } from '@playwright/test';

// Exact versions from the existing templates, executed unmodified from npm's
// integrity-checked lockfile. No remote fetch is permitted during a test.
const vendor: Record<string, [string, string]> = {
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css':
    ['bootstrap/dist/css/bootstrap.min.css', 'text/css'],
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js':
    ['bootstrap/dist/js/bootstrap.bundle.min.js', 'application/javascript'],
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.5.0/font/bootstrap-icons.css':
    ['bootstrap-icons/font/bootstrap-icons.css', 'text/css'],
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.5.0/font/fonts/bootstrap-icons.woff2':
    ['bootstrap-icons/font/fonts/bootstrap-icons.woff2', 'font/woff2'],
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.5.0/font/fonts/bootstrap-icons.woff':
    ['bootstrap-icons/font/fonts/bootstrap-icons.woff', 'font/woff'],
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js':
    ['jspdf/dist/jspdf.umd.min.js', 'application/javascript'],
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js':
    ['html2pdf.js/dist/html2pdf.bundle.min.js', 'application/javascript'],
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js':
    ['dompurify/dist/purify.min.js', 'application/javascript'],
};

export async function installNetwork(context: BrowserContext): Promise<string[]> {
  const unexpected: string[] = [];
  context.on('requestfailed', request => {
    const error = request.failure()?.errorText;
    // A page navigation can intentionally cancel outstanding image/API loads.
    if (new URL(request.url()).origin === 'http://app-e2e:5000' && error !== 'net::ERR_ABORTED') {
      unexpected.push(`${error} ${request.url()}`);
    }
  });
  context.on('response', response => {
    if (new URL(response.url()).origin === 'http://app-e2e:5000' && response.status() >= 400) {
      unexpected.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://app-e2e:5000') {
      await route.continue();
      return;
    }
    const asset = vendor[`${url.origin}${url.pathname}`];
    if (asset) {
      await route.fulfill({
        path: require.resolve(asset[0]),
        contentType: asset[1],
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
      return;
    }
    if (url.origin === 'https://www.youtube.com' && url.pathname.startsWith('/embed/')) {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Video omitted in E2E</title>' });
      return;
    }
    unexpected.push(url.href);
    await route.abort('blockedbyclient');
  });
  return unexpected;
}
