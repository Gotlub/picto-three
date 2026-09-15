import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BinderManager, BINDER_COLORS, resolveThumbnailUrl } from '../../app/static/js/components/BinderManager.js';

describe('BinderManager Unit Tests', () => {
    it('provides expected color palette matching mobile requirements', () => {
        assert.equal(BINDER_COLORS.length, 6);
        const hexCodes = BINDER_COLORS.map(c => c.hex);
        assert.deepEqual(hexCodes, ['#000000', '#FFEB3B', '#4CAF50', '#FF9800', '#2196F3', '#E91E63']);
    });

    it('resolves thumbnail URLs safely for local, Arasaac, and external paths', () => {
        // Arasaac with _500.png replacement to _300.png
        assert.equal(
            resolveThumbnailUrl({ root_id: -1, root_url: 'https://static.arasaac.org/pictograms/1234_500.png' }),
            'https://static.arasaac.org/pictograms/1234_300.png'
        );

        // Local ID thumbnail
        assert.equal(
            resolveThumbnailUrl({ root_id: 5, root_url: '/pictograms/5' }),
            '/pictogramsmin/5'
        );

        // Security check: javascript: protocol rejected
        assert.equal(
            resolveThumbnailUrl({ root_id: 1, root_url: 'javascript:void(0)' }),
            '/static/images/folder-bold.png'
        );
    });

    it('instantiates safely in headless environment and manages user trees', () => {
        const manager = new BinderManager();
        assert.equal(manager.userTrees.length, 0);

        const sampleTrees = [
            { id: 10, name: 'Tree 1', root_id: 1 },
            { id: 20, name: 'Tree 2', root_id: 2 }
        ];
        manager.setUserTrees(sampleTrees, 42);

        assert.equal(manager.userTrees.length, 2);
        assert.equal(manager.currentUserId, 42);
        assert.equal(manager.userTrees[0].name, 'Tree 1');
    });
});
