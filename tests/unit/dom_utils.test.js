import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DomUtils } from '../../app/static/js/utils/DomUtils.js';

describe('DomUtils', () => {
    describe('escapeHtml', () => {
        it('should escape dangerous characters correctly', () => {
            const raw = '<script>alert("XSS & fun\'");</script>';
            const escaped = DomUtils.escapeHtml(raw);
            assert.equal(
                escaped,
                '&lt;script&gt;alert(&quot;XSS &amp; fun&#039;&quot;);&lt;/script&gt;'
            );
        });

        it('should handle empty or falsy inputs', () => {
            assert.equal(DomUtils.escapeHtml(''), '');
            assert.equal(DomUtils.escapeHtml(null), '');
            assert.equal(DomUtils.escapeHtml(undefined), '');
        });
    });

    describe('createElement', () => {
        it('should throw when called outside a DOM environment', () => {
            const originalDoc = globalThis.document;
            delete globalThis.document;
            try {
                assert.throws(() => DomUtils.createElement('div'), /DOM environment/);
            } finally {
                globalThis.document = originalDoc;
            }
        });

        it('should create an element with classes, attributes and text when document is present', () => {
            const mockEl = {
                classList: {
                    add: (cls) => mockEl.classes.push(cls)
                },
                classes: [],
                attributes: {},
                setAttribute: (k, v) => { mockEl.attributes[k] = v; },
                textContent: ''
            };

            const originalDoc = globalThis.document;
            globalThis.document = {
                createElement: (tag) => {
                    mockEl.tag = tag;
                    return mockEl;
                }
            };

            try {
                const el = DomUtils.createElement('button', {
                    classes: ['btn', 'btn-primary'],
                    attributes: { 'data-id': '123', disabled: 'true' },
                    text: 'Click me'
                });

                assert.equal(el.tag, 'button');
                assert.deepEqual(el.classes, ['btn', 'btn-primary']);
                assert.equal(el.attributes['data-id'], '123');
                assert.equal(el.textContent, 'Click me');
            } finally {
                globalThis.document = originalDoc;
            }
        });
    });
});
