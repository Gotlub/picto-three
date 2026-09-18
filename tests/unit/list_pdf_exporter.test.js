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

    it('calculates chain layout with horizontal and vertical strip directions', () => {
        const items = [
            { data: { image_id: 1, name: 'Step 1' } },
            { data: { image_id: 2, name: 'Step 2' } }
        ];

        const horizSettings = {
            orientation: 'portrait',
            imageSize: 100,
            borderWidth: 2,
            showBorders: true,
            mode: 'chain',
            chainDirection: 'horizontal',
            marginX: 10,
            marginY: 10
        };
        const horizLayout = exporter.calculateLayout(items, horizSettings);
        assert.equal(horizLayout.chainDirection, 'horizontal');
        assert.ok(horizLayout.cols >= 1);

        const vertSettings = {
            orientation: 'portrait',
            imageSize: 100,
            borderWidth: 2,
            showBorders: true,
            mode: 'chain',
            chainDirection: 'vertical',
            marginX: 10,
            marginY: 10
        };
        const vertLayout = exporter.calculateLayout(items, vertSettings);
        assert.equal(vertLayout.chainDirection, 'vertical');
        assert.ok(vertLayout.rows >= 1);
    });

    it('handles borders toggle and effectiveBorderWidth calculation', () => {
        const items = [{ data: { image_id: 1, name: 'Item 1' } }];

        // Borders ON
        const layoutOn = exporter.calculateLayout(items, {
            imageSize: 100,
            borderWidth: 4,
            showBorders: true,
            borderCount: 3
        });
        assert.equal(layoutOn.effectiveBorderWidth, 4);
        assert.equal(layoutOn.borderCount, 3);

        // Borders OFF
        const layoutOff = exporter.calculateLayout(items, {
            imageSize: 100,
            borderWidth: 4,
            showBorders: false,
            borderCount: 3
        });
        assert.equal(layoutOff.effectiveBorderWidth, 0);
    });

    it('has no hardcoded default presets and handles custom print options', () => {
        const presets = exporter.getDefaultPresets();
        assert.deepEqual(presets, {});

        const custom = exporter.getCustomPresets();
        assert.ok(typeof custom === 'object');
    });

    it('renders preview with outward concentric border wrappers and isolated inner image box', () => {
        const makeMockEl = (tag) => {
            const el = {
                tag,
                className: '',
                style: {},
                children: [],
                appendChild(child) {
                    this.children.push(child);
                }
            };
            return el;
        };

        const originalDoc = globalThis.document;
        globalThis.document = {
            createElement: (tag) => makeMockEl(tag),
            getElementById: () => null,
            querySelectorAll: () => [],
            querySelector: () => null
        };

        try {
            const testExporter = new ListPdfExporter();
            const printWrapper = makeMockEl('div');
            testExporter.printPagesWrapper = printWrapper;
            testExporter.getItemsCallback = () => [
                { data: { image_id: 10, name: 'Tractor', path: 'tractor.png' } }
            ];
            testExporter.readSettings = () => ({
                orientation: 'portrait',
                imageSize: 120,
                showBorders: true,
                borders: [
                    { width: 5, color: '#ff0000' },
                    { width: 3, color: '#00ff00' },
                    { width: 2, color: '#0000ff' }
                ],
                showText: true,
                textBox: false,
                textPosition: 'bottom',
                textPlacement: 'inside',
                textSize: 14,
                mode: 'grid',
                gridMultiplier: 1,
                marginX: 10,
                marginY: 10
            });

            testExporter.renderPreview();

            // Structure: printWrapper -> pageDiv -> contentDiv -> itemContainer
            assert.equal(printWrapper.children.length, 1);
            const pageDiv = printWrapper.children[0];
            const contentDiv = pageDiv.children[0];
            const itemContainer = contentDiv.children[0];

            // itemContainer width should be imageSize + 2 * (5 + 3 + 2) = 120 + 20 = 140px
            assert.equal(itemContainer.style.width, '140px');

            // itemContainer contains the outermost border wrapper (Border 3)
            const b3Wrapper = itemContainer.children[0];
            assert.equal(b3Wrapper.style.border, '2px solid #0000ff');
            assert.equal(b3Wrapper.style.boxSizing, 'content-box');

            // b3Wrapper contains b2Wrapper
            const b2Wrapper = b3Wrapper.children[0];
            assert.equal(b2Wrapper.style.border, '3px solid #00ff00');
            assert.equal(b2Wrapper.style.boxSizing, 'content-box');

            // b2Wrapper contains b1Wrapper
            const b1Wrapper = b2Wrapper.children[0];
            assert.equal(b1Wrapper.style.border, '5px solid #ff0000');
            assert.equal(b1Wrapper.style.boxSizing, 'content-box');

            // b1Wrapper contains innerBox strictly sized to imageSize (120px)
            const innerBox = b1Wrapper.children[0];
            assert.equal(innerBox.style.width, '120px');
            assert.equal(innerBox.style.height, '120px');
            assert.equal(innerBox.style.overflow, 'hidden');
            assert.equal(innerBox.style.backgroundColor, '#ffffff');

            // innerBox contains the img and textSpan (since textPlacement is inside)
            assert.equal(innerBox.children.length, 2);
            const img = innerBox.children[0];
            assert.equal(img.tag, 'img');
            assert.equal(img.style.maxWidth, '100%');
            assert.equal(img.style.maxHeight, '100%');

            const textSpan = innerBox.children[1];
            assert.equal(textSpan.tag, 'span');
            assert.equal(textSpan.textContent, 'Tractor');
            assert.equal(textSpan.style.position, 'absolute');
        } finally {
            globalThis.document = originalDoc;
        }
    });
});

