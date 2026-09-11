import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiClientError } from '../../app/static/js/services/ApiClient.js';

describe('ApiClient & ApiClientError', () => {
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;

    beforeEach(() => {
        // Setup minimal DOM mock
        globalThis.document = {
            querySelector: (selector) => {
                if (selector === 'input[name="csrf_token"]') {
                    return { value: 'mock-csrf-token-123' };
                }
                return null;
            }
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        globalThis.document = originalDocument;
    });

    it('should retrieve CSRF token from input field', () => {
        const token = ApiClient.getCsrfToken();
        assert.equal(token, 'mock-csrf-token-123');
    });

    it('should retrieve CSRF token from meta tag if input is absent', () => {
        globalThis.document.querySelector = (selector) => {
            if (selector === 'meta[name="csrf-token"]') {
                return { content: 'meta-csrf-token-456' };
            }
            return null;
        };
        const token = ApiClient.getCsrfToken();
        assert.equal(token, 'meta-csrf-token-456');
    });

    it('should return empty string if no CSRF token found in DOM', () => {
        globalThis.document.querySelector = () => null;
        const token = ApiClient.getCsrfToken();
        assert.equal(token, '');
    });

    it('should perform GET request and parse JSON response', async () => {
        const fakeData = { id: 1, name: 'Sample Tree' };
        globalThis.fetch = async (url, options) => {
            assert.equal(url, '/api/trees/1');
            assert.equal(options.method, 'GET');
            return {
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => fakeData
            };
        };

        const result = await ApiClient.get('/api/trees/1');
        assert.deepEqual(result, fakeData);
    });

    it('should perform POST request with automatic JSON body and CSRF header', async () => {
        const payload = { name: 'New Tree', nodes: [] };
        let capturedOptions = null;

        globalThis.fetch = async (url, options) => {
            capturedOptions = options;
            return {
                ok: true,
                status: 201,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ status: 'success', id: 42 })
            };
        };

        const result = await ApiClient.post('/api/tree/save', payload);
        assert.equal(capturedOptions.method, 'POST');
        assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
        assert.equal(capturedOptions.headers['X-CSRFToken'], 'mock-csrf-token-123');
        assert.equal(capturedOptions.body, JSON.stringify(payload));
        assert.equal(result.id, 42);
    });

    it('should perform DELETE request with CSRF header', async () => {
        let capturedOptions = null;
        globalThis.fetch = async (url, options) => {
            capturedOptions = options;
            return {
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ message: 'Deleted' })
            };
        };

        const result = await ApiClient.delete('/api/tree/42');
        assert.equal(capturedOptions.method, 'DELETE');
        assert.equal(capturedOptions.headers['X-CSRFToken'], 'mock-csrf-token-123');
        assert.equal(result.message, 'Deleted');
    });

    it('should throw ApiClientError on HTTP error with API message', async () => {
        globalThis.fetch = async () => ({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            json: async () => ({ message: 'Permission denied: tree is private' })
        });

        await assert.rejects(
            async () => ApiClient.get('/api/tree/99'),
            (err) => {
                assert.ok(err instanceof ApiClientError);
                assert.equal(err.status, 403);
                assert.equal(err.message, 'Permission denied: tree is private');
                return true;
            }
        );
    });
});
