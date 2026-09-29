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

    it('handles root node and preserves sequential order in payload', () => {
        const manager = new ChainedListManager();
        manager.items = [
            {
                data: {
                    image_id: -1,
                    path: '/static/images/folder-open-bold.png',
                    name: 'Morning Routine',
                    description: 'Morning Routine'
                }
            },
            {
                data: {
                    image_id: 42,
                    path: '/pictograms/42',
                    name: 'Breakfast',
                    description: 'Eat breakfast'
                }
            }
        ];

        const payload = manager.toPayload();
        assert.equal(payload.length, 2);
        assert.equal(payload[0].image_id, -1);
        assert.equal(payload[0].name, 'Morning Routine');
        assert.equal(payload[0].description, 'Morning Routine');
        assert.equal(payload[0].url, '/static/images/folder-open-bold.png');
        assert.equal(payload[1].image_id, 42);
        assert.equal(payload[1].name, 'Breakfast');
    });

    it('handles locked state in Print mode (setLocked)', () => {
        const createMockEl = () => {
            const classes = new Set();
            const attrs = {};
            return {
                classList: {
                    add: (c) => classes.add(c),
                    remove: (c) => classes.delete(c),
                    contains: (c) => classes.has(c)
                },
                setAttribute: (k, v) => { attrs[k] = v; },
                getAttribute: (k) => attrs[k],
                addEventListener: () => {}
            };
        };

        const container = createMockEl();
        const manager = new ChainedListManager({ container });
        const item1 = { element: createMockEl(), data: { image_id: 1, name: 'A' } };
        const item2 = { element: createMockEl(), data: { image_id: 2, name: 'B' } };
        manager.items = [item1, item2];

        // Initially unlocked
        assert.equal(manager.isLocked, false);

        // Lock in print mode
        manager.setLocked(true);
        assert.equal(manager.isLocked, true);
        assert.equal(container.classList.contains('locked'), true);
        assert.equal(item1.element.getAttribute('draggable'), 'false');
        assert.equal(item1.element.classList.contains('locked'), true);

        // Drag start is prevented when locked
        let prevented = false;
        manager.handleChainedListDragStart({ preventDefault: () => { prevented = true; } }, item1);
        assert.equal(prevented, true);

        // Unlock when returning to Import and Describe
        manager.setLocked(false);
        assert.equal(manager.isLocked, false);
        assert.equal(container.classList.contains('locked'), false);
        assert.equal(item1.element.getAttribute('draggable'), 'true');
        assert.equal(item1.element.classList.contains('locked'), false);
    });

    it('supports single click, Ctrl+Click and Shift+Click multi-selection with UI synchronization', () => {
        const createMockEl = () => {
            const classes = new Set();
            const attrs = {};
            return {
                classList: {
                    add: (c) => classes.add(c),
                    remove: (c) => classes.delete(c),
                    contains: (c) => classes.has(c)
                },
                setAttribute: (k, v) => { attrs[k] = v; },
                getAttribute: (k) => attrs[k],
                addEventListener: () => {},
                dataset: {},
                value: '',
                disabled: false,
                textContent: '',
                querySelector: () => ({ textContent: '' })
            };
        };

        const descTextarea = createMockEl();
        const deleteBtn = createMockEl();
        deleteBtn.dataset.textSingular = 'Delete Selected Link';
        deleteBtn.dataset.textPlural = 'Delete Selected Links';

        const manager = new ChainedListManager({
            selectedLinkDescription: descTextarea,
            deleteLinkBtn: deleteBtn
        });

        const item0 = { element: createMockEl(), data: { image_id: 0, description: 'Zero' } };
        const item1 = { element: createMockEl(), data: { image_id: 1, description: 'One' } };
        const item2 = { element: createMockEl(), data: { image_id: 2, description: 'Two' } };
        const item3 = { element: createMockEl(), data: { image_id: 3, description: 'Three' } };
        const item4 = { element: createMockEl(), data: { image_id: 4, description: 'Four' } };
        manager.items = [item0, item1, item2, item3, item4];

        // Initial state: nothing selected -> disabled textarea, disabled delete button
        assert.equal(descTextarea.disabled, true);
        assert.equal(descTextarea.value, '');
        assert.equal(deleteBtn.disabled, true);
        assert.equal(deleteBtn.textContent, 'Delete Selected Link');

        // 1. Single click on item 1: selected, enabled textarea, singular button
        manager.selectItem(item1);
        assert.equal(manager.selectedItems.length, 1);
        assert.equal(manager.selectedItems[0], item1);
        assert.equal(manager.selectedItem, item1);
        assert.equal(item1.element.classList.contains('selected'), true);
        assert.equal(descTextarea.disabled, false);
        assert.equal(descTextarea.value, 'One');
        assert.equal(deleteBtn.disabled, false);
        assert.equal(deleteBtn.textContent, 'Delete Selected Link');

        // 2. Ctrl + click on item 3: both item1 and item3 selected -> textarea disabled, plural button
        manager.selectItem(item3, { ctrlKey: true });
        assert.equal(manager.selectedItems.length, 2);
        assert.equal(manager.selectedItem, null);
        assert.equal(item1.element.classList.contains('selected'), true);
        assert.equal(item3.element.classList.contains('selected'), true);
        assert.equal(descTextarea.disabled, true);
        assert.equal(descTextarea.value, '');
        assert.equal(deleteBtn.disabled, false);
        assert.equal(deleteBtn.textContent, 'Delete Selected Links');

        // 3. Ctrl + click on item 3 again: deselects item3, only item1 left -> textarea re-enabled with 'One'
        manager.selectItem(item3, { ctrlKey: true });
        assert.equal(manager.selectedItems.length, 1);
        assert.equal(manager.selectedItems[0], item1);
        assert.equal(item3.element.classList.contains('selected'), false);
        assert.equal(descTextarea.disabled, false);
        assert.equal(descTextarea.value, 'One');
        assert.equal(deleteBtn.textContent, 'Delete Selected Link');

        // 4. Shift + click on item 4: range from pivot (1) to 4 -> items 1, 2, 3, 4 selected
        manager.selectItem(item4, { shiftKey: true });
        assert.equal(manager.selectedItems.length, 4);
        assert.deepEqual(manager.selectedItems, [item1, item2, item3, item4]);
        assert.equal(descTextarea.disabled, true);
        assert.equal(deleteBtn.disabled, false);
        assert.equal(deleteBtn.textContent, 'Delete Selected Links');

        // 5. Delete selected links deletes all 4 selected items simultaneously
        manager.deleteSelectedLink();
        assert.equal(manager.items.length, 1);
        assert.equal(manager.items[0], item0);
        assert.equal(manager.selectedItems.length, 0);
        assert.equal(descTextarea.disabled, true);
        assert.equal(deleteBtn.disabled, true);
        assert.equal(deleteBtn.textContent, 'Delete Selected Link');
    });
});
