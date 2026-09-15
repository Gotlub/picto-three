import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeLocale,
    findBestMatchingKeyword,
    filterAndRankPictograms
} from '../../app/static/js/components/ArasaacSearch.js';

describe('ArasaacSearch Unit Tests', () => {
    describe('normalizeLocale', () => {
        it('normalizes valid locales', () => {
            assert.equal(normalizeLocale('fr'), 'fr');
            assert.equal(normalizeLocale('fr_FR'), 'fr');
            assert.equal(normalizeLocale('en_US'), 'en');
            assert.equal(normalizeLocale('ES'), 'es');
            assert.equal(normalizeLocale('de-DE'), 'de');
            assert.equal(normalizeLocale('it'), 'it');
            assert.equal(normalizeLocale('pt_BR'), 'pt');
        });

        it('falls back to "fr" for unsupported or invalid locales', () => {
            assert.equal(normalizeLocale(''), 'fr');
            assert.equal(normalizeLocale(null), 'fr');
            assert.equal(normalizeLocale(undefined), 'fr');
            assert.equal(normalizeLocale('zh_CN'), 'fr');
            assert.equal(normalizeLocale('123'), 'fr');
        });
    });

    describe('findBestMatchingKeyword', () => {
        const keywords = [
            { keyword: 'animal de compagnie' },
            { keyword: 'chat domestique' },
            { keyword: 'chat' },
            { keyword: 'félin' }
        ];

        it('finds exact match first', () => {
            assert.equal(findBestMatchingKeyword(keywords, 'chat'), 'chat');
        });

        it('finds prefix match when no exact match exists', () => {
            assert.equal(findBestMatchingKeyword(keywords, 'fél'), 'félin');
        });

        it('finds substring match when no prefix match exists', () => {
            assert.equal(findBestMatchingKeyword(keywords, 'compagnie'), 'animal de compagnie');
        });

        it('falls back to first keyword if query is empty or no match', () => {
            assert.equal(findBestMatchingKeyword(keywords, ''), 'animal de compagnie');
            assert.equal(findBestMatchingKeyword(keywords, 'oiseau'), 'animal de compagnie');
            assert.equal(findBestMatchingKeyword([], 'chat'), '');
        });
    });

    describe('filterAndRankPictograms', () => {
        const mockPictos = [
            {
                _id: 1,
                keywords: [{ keyword: 'arbre à chat' }]
            },
            {
                _id: 2,
                keywords: [{ keyword: 'chat' }, { keyword: 'félin' }]
            },
            {
                _id: 3,
                keywords: [{ keyword: 'chaton' }]
            },
            {
                _id: 4,
                keywords: [{ keyword: 'chien' }]
            }
        ];

        it('ranks exact match first in smart mode', () => {
            const results = filterAndRankPictograms(mockPictos, 'chat', 'smart');
            assert.equal(results.length, 4); // All returned by API kept in smart mode
            assert.equal(results[0]._id, 2); // Exact 'chat'
            assert.equal(results[0]._matchedKeyword, 'chat');
            assert.equal(results[1]._id, 3); // Prefix 'chaton'
            assert.equal(results[2]._id, 1); // Contains 'arbre à chat'
        });

        it('filters strictly exact matches in exact mode', () => {
            const results = filterAndRankPictograms(mockPictos, 'chat', 'exact');
            assert.equal(results.length, 1);
            assert.equal(results[0]._id, 2);
            assert.equal(results[0]._matchedKeyword, 'chat');
        });

        it('filters prefix matches in starts mode', () => {
            const results = filterAndRankPictograms(mockPictos, 'chat', 'starts');
            assert.equal(results.length, 2); // 'chat' and 'chaton'
            const ids = results.map(r => r._id);
            assert.deepEqual(ids, [2, 3]);
        });

        it('filters substring matches in contains mode', () => {
            const results = filterAndRankPictograms(mockPictos, 'chat', 'contains');
            assert.equal(results.length, 3); // 'chat', 'chaton', 'arbre à chat'
            const ids = results.map(r => r._id);
            assert.ok(ids.includes(1));
            assert.ok(ids.includes(2));
            assert.ok(ids.includes(3));
            assert.ok(!ids.includes(4)); // 'chien' is excluded
        });
    });
});
