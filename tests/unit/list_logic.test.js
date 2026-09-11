import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ListItem, ListModel } from '../../app/static/js/models/ListModel.js';

describe('ListModel & ListItem Logic', () => {
    it('creates ListItem and normalizes external URLs to id -1', () => {
        const localItem = new ListItem({ image_id: 5, name: 'Local', url: '/pictograms/5', description: 'Step 1' });
        assert.equal(localItem.imageId, 5);
        assert.equal(localItem.toJSON().image_id, 5);

        const externalItem = new ListItem({ image_id: 10, name: 'Arasaac', url: 'https://static.arasaac.org/picto.png' });
        assert.equal(externalItem.toJSON().image_id, -1);
    });

    it('adds, removes, and clears items in ListModel', () => {
        const list = new ListModel({ name: 'Morning Routine' });
        assert.equal(list.items.length, 0);

        list.addItem({ image_id: 1, name: 'Wake up', description: 'Wake up' });
        list.addItem({ image_id: 2, name: 'Brush teeth', description: 'Brush teeth' });
        list.addItem({ image_id: 3, name: 'Eat breakfast', description: 'Eat breakfast' }, 1); // Insert in middle

        assert.equal(list.items.length, 3);
        assert.equal(list.items[0].name, 'Wake up');
        assert.equal(list.items[1].name, 'Eat breakfast');
        assert.equal(list.items[2].name, 'Brush teeth');

        const removed = list.removeItem(1);
        assert.equal(removed.name, 'Eat breakfast');
        assert.equal(list.items.length, 2);

        list.clear();
        assert.equal(list.items.length, 0);
    });

    it('reorders items correctly with moveItem (DnD simulation)', () => {
        const list = new ListModel({
            items: [
                { image_id: 1, name: 'Item 1' },
                { image_id: 2, name: 'Item 2' },
                { image_id: 3, name: 'Item 3' }
            ]
        });

        // Move Item 1 from index 0 to index 2
        const success = list.moveItem(0, 2);
        assert.equal(success, true);
        assert.equal(list.items[0].name, 'Item 2');
        assert.equal(list.items[1].name, 'Item 3');
        assert.equal(list.items[2].name, 'Item 1');

        // Invalid indices return false
        assert.equal(list.moveItem(-1, 2), false);
        assert.equal(list.moveItem(0, 99), false);
    });

    it('calculates page chunks accurately for PDF export and print', () => {
        const list = new ListModel();
        for (let i = 1; i <= 8; i++) {
            list.addItem({ image_id: i, name: `Picto ${i}` });
        }

        // 8 items with 3 per page should yield 3 pages (3, 3, 2)
        const pages = list.calculatePages({ itemsPerPage: 3 });
        assert.equal(pages.length, 3);
        assert.equal(pages[0].length, 3);
        assert.equal(pages[1].length, 3);
        assert.equal(pages[2].length, 2);
        assert.equal(pages[0][0].name, 'Picto 1');
        assert.equal(pages[2][1].name, 'Picto 8');
    });

    it('serializes to payload and round-trips with fromJSON', () => {
        const originalList = new ListModel({
            name: 'Saved List',
            items: [
                { image_id: 1, name: 'Step 1', url: '/pictograms/1', description: 'First step' },
                { image_id: 2, name: 'Step 2', url: '/pictograms/2', description: 'Second step' }
            ]
        });

        const payload = originalList.toPayload();
        assert.equal(payload.length, 2);
        assert.equal(payload[0].image_id, 1);
        assert.equal(payload[1].image_id, 2);

        // Reconstruct from payload
        const restored = ListModel.fromJSON({ list_name: 'Saved List', payload });
        assert.equal(restored.name, 'Saved List');
        assert.equal(restored.items.length, 2);
        assert.equal(restored.items[0].name, 'Step 1');
        assert.equal(restored.items[1].description, 'Second step');
    });
});
