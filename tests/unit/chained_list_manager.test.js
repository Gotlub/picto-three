import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChainedListManager } from '../../app/static/js/components/ChainedListManager.js';

describe('ChainedListManager Unit Tests', () => {
    it('initializes with empty items array without crashing in headless node', () => {
        const manager = new ChainedListManager();
        assert.equal(Array.isArray(manager.items), true);
        assert.equal(manager.items.length, 0);
    });

    it('creates accurate API payloads matching backend contract', () => {
        const manager = new ChainedListManager();
        manager.items = [
            {
                data: {
                    image_id: 1,
                    path: '/pictograms/1',
                    name: 'First',
                    description: 'First item'
                }
            },
            {
                data: {
                    image_id: 2,
                    path: 'https://example.com/external.png',
                    name: 'External',
                    description: 'External item'
                }
            }
        ];

        const payload = manager.toPayload();
        assert.equal(payload.length, 2);
        assert.equal(payload[0].image_id, 1);
        assert.equal(payload[0].url, '/pictograms/1');
        assert.equal(payload[0].description, 'First item');

        // External URLs are normalized to -1
        assert.equal(payload[1].image_id, -1);
        assert.equal(payload[1].url, 'https://example.com/external.png');
    });
});
