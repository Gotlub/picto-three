import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ListPdfExporter } from '../../app/static/js/services/ListPdfExporter.js';

describe('ListPdfExporter Unit Tests', () => {
    const exporter = new ListPdfExporter();

    it('resolves image URLs accurately across formats', () => {
        assert.equal(
            exporter.resolveImageUrl({ data: { path: 'https://example.com/picto.png' } }),
            'https://example.com/picto.png'
        );
        assert.equal(
            exporter.resolveImageUrl({ data: { image_id: 42, path: 'uploads/picto.png' } }),
            '/pictograms/42'
        );
        assert.equal(
            exporter.resolveImageUrl({ data: { path: 'data:image/png;base64,abc' } }),
            'data:image/png;base64,abc'
        );
        assert.equal(
            exporter.resolveImageUrl({ data: { path: '/custom/path.png' } }),
            '/custom/path.png'
        );
        assert.equal(
            exporter.resolveImageUrl({ data: {} }),
            '/static/images/prohibit-bold.png'
        );
    });

    it('calculates grid layout mathematics correctly', () => {
        const items = [
            { data: { image_id: 1, name: 'Item 1' } },
            { data: { image_id: 2, name: 'Item 2' } }
        ];

        const settings = {
            orientation: 'portrait',
            imageSize: 100,
            borderWidth: 2,
            showText: true,
            textPlacement: 'outside',
            textSize: 14,
            mode: 'grid',
            gridMultiplier: 2, // 4 items total
            marginX: 10,
            marginY: 10
        };

        const layout = exporter.calculateLayout(items, settings);

        assert.equal(layout.pageWidth, 794);
        assert.equal(layout.pageHeight, 1123);
        assert.equal(layout.itemsToRender.length, 4); // 2 items x 2 multiplier
        assert.ok(layout.cols >= 1);
        assert.ok(layout.rows >= 1);
        assert.ok(layout.itemsPerPage >= 1);
    });

    it('calculates chain landscape layout mathematics correctly', () => {
        const items = [
            { data: { image_id: 1, name: 'Item 1' } },
            { data: { image_id: 2, name: 'Item 2' } },
            { data: { image_id: 3, name: 'Item 3' } }
        ];

        const settings = {
            orientation: 'landscape',
            imageSize: 80,
            borderWidth: 1,
            showText: false,
            textPlacement: 'inside',
            textSize: 12,
            mode: 'chain',
            gridMultiplier: 1,
            marginX: 15,
            marginY: 15
        };

        const layout = exporter.calculateLayout(items, settings);

        assert.equal(layout.pageWidth, 1123);
        assert.equal(layout.pageHeight, 794);
        assert.equal(layout.itemsToRender.length, 3);
        assert.equal(layout.textHeight, 0);
    });
});
