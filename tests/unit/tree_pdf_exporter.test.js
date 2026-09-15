import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeImageUrl, exportToVectorPdf } from '../../app/static/js/services/TreePdfExporter.js';

describe('TreePdfExporter Unit Tests', () => {
    it('validates image URLs for safety before canvas processing', () => {
        assert.equal(isSafeImageUrl('https://example.com/picto.png'), true);
        assert.equal(isSafeImageUrl('http://localhost:5000/pictograms/1'), true);
        assert.equal(isSafeImageUrl('/pictograms/1'), true);
        assert.equal(isSafeImageUrl('data:image/png;base64,ABC...'), true);

        assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
        assert.equal(isSafeImageUrl(''), false);
        assert.equal(isSafeImageUrl(null), false);
        assert.equal(isSafeImageUrl(undefined), false);
    });

    it('rejects export if running in environment without DOM', async () => {
        await assert.rejects(
            async () => {
                await exportToVectorPdf('#non-existent');
            },
            {
                message: /Environnement DOM requis pour l'export PDF|introuvable ou vide/
            }
        );
    });
});
