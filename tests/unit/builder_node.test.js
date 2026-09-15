import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BuilderNode, resolveBuilderImageUrl } from '../../app/static/js/components/BuilderNode.js';

describe('BuilderNode Unit Tests', () => {
    it('resolves image URLs correctly and prevents dangerous pseudo-protocols', () => {
        // HTTP / HTTPS
        assert.equal(
            resolveBuilderImageUrl({ id: -1, path: 'https://static.arasaac.org/pictograms/123_300.png' }),
            'https://static.arasaac.org/pictograms/123_300.png'
        );

        // Local ID
        assert.equal(
            resolveBuilderImageUrl({ id: 42, path: 'pictograms/42.png' }),
            '/pictograms/42'
        );

        // Absolute path
        assert.equal(
            resolveBuilderImageUrl({ id: 'root', path: '/static/images/folder-open-bold.png' }),
            '/static/images/folder-open-bold.png'
        );

        // Relative path
        assert.equal(
            resolveBuilderImageUrl({ id: -1, path: 'custom/icon.png' }),
            '/pictograms/custom/icon.png'
        );

        // Security: rejection of javascript: protocol
        assert.equal(
            resolveBuilderImageUrl({ id: 1, path: 'javascript:alert(1)' }),
            '/static/images/folder-open-bold.png'
        );
    });

    it('initializes BuilderNode and maintains child-parent hierarchy', () => {
        const root = new BuilderNode({ id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' }, null, null, true);
        assert.equal(root.isRoot, true);
        assert.equal(root.children.length, 0);

        const child = new BuilderNode({ id: 1, name: 'Child 1', path: '/pictograms/1' }, null);
        root.addChild(child);

        assert.equal(root.children.length, 1);
        assert.equal(root.children[0], child);
        assert.equal(child.parent, root);
    });

    it('updates node description properly', () => {
        const node = new BuilderNode({ id: 2, name: 'Original', description: 'Original desc' }, null);
        assert.equal(node.description, 'Original desc');

        node.updateDescription('Updated description');
        assert.equal(node.description, 'Updated description');
    });
});
