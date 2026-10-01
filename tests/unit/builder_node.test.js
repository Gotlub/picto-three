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

    it('creates DOM element with proper event listeners when document is available', () => {
        const listeners = {};
        const mockElement = (tag) => {
            const el = {
                tagName: tag,
                className: '',
                classList: {
                    classes: new Set(),
                    add(c) {
                        this.classes.add(c);
                        el.className = Array.from(this.classes).join(' ');
                    },
                    contains(c) { return this.classes.has(c); },
                },
                style: {},
                children: [],
                appendChild(child) { this.children.push(child); return child; },
                contains(target) { return this.children.includes(target) || target === this; },
                setAttribute(attr, val) { this[attr] = val; },
                addEventListener(event, fn) {
                    const key = this.classList.contains('node-content') ? 'node-content' : (this.classList.contains('node') ? 'node' : tag);
                    if (!listeners[key]) listeners[key] = {};
                    listeners[key][event] = fn;
                }
            };
            return el;
        };

        const originalDoc = globalThis.document;
        try {
            globalThis.document = {
                createElement(tag) {
                    return mockElement(tag);
                }
            };

            const mockBuilder = {
                selectNode: () => {},
                handleDragStart: () => {},
                handleDragOver: () => {},
                handleDragLeave: () => {},
                handleDrop: () => {},
                handleDragEnd: () => {},
            };

            const node = new BuilderNode({ id: 10, name: 'Test Node', path: '/pictograms/10' }, mockBuilder);
            assert.ok(node.element);
            assert.equal(node.element.draggable, 'true');

            // Verify dragleave does not dismiss when moving into nodeElement (e.g. connector area)
            let dragLeaveCalled = false;
            mockBuilder.handleDragLeave = () => { dragLeaveCalled = true; };
            const contentLeave = listeners['node-content']?.dragleave;
            assert.ok(typeof contentLeave === 'function');

            // Moving into nodeElement
            node.element.contains = (target) => target === node.element;
            contentLeave({ stopPropagation: () => {}, relatedTarget: node.element });
            assert.equal(dragLeaveCalled, false, 'Should not dismiss when relatedTarget is inside nodeElement');

            // Moving outside nodeElement
            node.element.contains = () => false;
            contentLeave({ stopPropagation: () => {}, relatedTarget: null });
            assert.equal(dragLeaveCalled, true, 'Should dismiss when relatedTarget is outside nodeElement');
        } finally {
            globalThis.document = originalDoc;
        }
    });
});
