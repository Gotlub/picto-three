/**
 * Normalise une chaîne locale pour ARASAAC (ex: "fr_FR" -> "fr", "en-US" -> "en").
 * @param {string|null|undefined} rawLocale
 * @returns {string}
 */
export function normalizeLocale(rawLocale) {
    if (!rawLocale || typeof rawLocale !== 'string') return 'fr';
    const clean = rawLocale.trim().toLowerCase().slice(0, 2);
    const supported = ['fr', 'en', 'es', 'de', 'it', 'pt'];
    return supported.includes(clean) ? clean : 'fr';
}

/**
 * Trouve le mot-clé le plus pertinent dans la liste de mots-clés d'un pictogramme.
 * @param {Array} keywords
 * @param {string} query
 * @returns {string}
 */
export function findBestMatchingKeyword(keywords, query) {
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return '';
    const q = (query || '').trim().toLowerCase();
    if (!q) return keywords[0]?.keyword || '';

    // 1. Correspondance exacte
    const exact = keywords.find(k => k && k.keyword && k.keyword.trim().toLowerCase() === q);
    if (exact) return exact.keyword;

    // 2. Commence par
    const starts = keywords.find(k => k && k.keyword && k.keyword.trim().toLowerCase().startsWith(q));
    if (starts) return starts.keyword;

    // 3. Contient
    const contains = keywords.find(k => k && k.keyword && k.keyword.trim().toLowerCase().includes(q));
    if (contains) return contains.keyword;

    // Repli sur le premier mot-clé disponible
    return keywords[0]?.keyword || '';
}

/**
 * Filtre et ordonne les pictogrammes selon le mode de recherche choisi.
 * @param {Array} pictos
 * @param {string} query
 * @param {'smart'|'exact'|'starts'|'contains'} mode
 * @returns {Array}
 */
export function filterAndRankPictograms(pictos, query, mode = 'smart') {
    if (!Array.isArray(pictos)) return [];
    const q = (query || '').trim().toLowerCase();
    if (!q) return pictos;

    return pictos
        .map(picto => {
            const keywords = Array.isArray(picto.keywords) ? picto.keywords : [];
            const bestKeyword = findBestMatchingKeyword(keywords, q);
            const bestLower = bestKeyword.toLowerCase();

            let matchScore = 0; // 3 = exact, 2 = startsWith, 1 = contains, 0 = broad
            if (bestLower === q) matchScore = 3;
            else if (bestLower.startsWith(q)) matchScore = 2;
            else if (bestLower.includes(q)) matchScore = 1;

            return { picto, bestKeyword, matchScore };
        })
        .filter(item => {
            if (mode === 'exact') return item.matchScore === 3;
            if (mode === 'starts') return item.matchScore >= 2;
            if (mode === 'contains') return item.matchScore >= 1;
            return true;
        })
        .sort((a, b) => {
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.bestKeyword.length - b.bestKeyword.length;
        })
        .map(item => ({
            ...item.picto,
            _matchedKeyword: item.bestKeyword
        }));
}

export default class ArasaacSearch {
    constructor(containerId, dragStartCallback, onClickCallback = null) {
        this.container = document.getElementById(containerId);
        this.dragStartCallback = dragStartCallback; // Callback to handle drag start in parent
        this.onClickCallback = onClickCallback; // Optional callback for click selection
        this.timeout = null;
        this.selectedLocale = normalizeLocale(typeof window !== 'undefined' ? window.CURRENT_LOCALE : 'fr');
        this.searchMode = 'smart';
        this.render();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="arasaac-search-box mb-2 flex-shrink-0">
                <div class="input-group input-group-sm mb-1">
                    <span class="input-group-text py-0 px-2" style="font-size: 13px;">🔍</span>
                    <input type="text" class="form-control form-control-sm" placeholder="Rechercher ARASAAC..." id="arasaac-input-${this.container.id}">
                </div>
                <div class="d-flex gap-1">
                    <select class="form-select form-select-sm" id="arasaac-mode-${this.container.id}" style="font-size: 11px; padding: 2px 6px;" title="Mode de recherche">
                        <option value="smart" ${this.searchMode === 'smart' ? 'selected' : ''}>🎯 Pertinence</option>
                        <option value="exact" ${this.searchMode === 'exact' ? 'selected' : ''}>📌 Exact ("Est")</option>
                        <option value="starts" ${this.searchMode === 'starts' ? 'selected' : ''}>🔤 Commence par</option>
                        <option value="contains" ${this.searchMode === 'contains' ? 'selected' : ''}>🔍 Contient</option>
                    </select>
                    <select class="form-select form-select-sm" id="arasaac-lang-${this.container.id}" style="font-size: 11px; width: 92px; flex-shrink: 0; padding: 2px 4px;" title="Langue">
                        <option value="fr" ${this.selectedLocale === 'fr' ? 'selected' : ''}>🇫🇷 FR</option>
                        <option value="en" ${this.selectedLocale === 'en' ? 'selected' : ''}>🇬🇧 EN</option>
                        <option value="es" ${this.selectedLocale === 'es' ? 'selected' : ''}>🇪🇸 ES</option>
                        <option value="de" ${this.selectedLocale === 'de' ? 'selected' : ''}>🇩🇪 DE</option>
                        <option value="it" ${this.selectedLocale === 'it' ? 'selected' : ''}>🇮🇹 IT</option>
                        <option value="pt" ${this.selectedLocale === 'pt' ? 'selected' : ''}>🇵🇹 PT</option>
                    </select>
                </div>
            </div>
            <div class="arasaac-results flex-grow-1" id="arasaac-results-${this.container.id}" style="overflow-y: auto; display: flex; flex-direction: column; gap: 6px; align-content: flex-start; min-height: 0; padding-right: 5px;">
                <!-- Results will appear here -->
                <div class="text-muted small text-center w-100 mt-3">Recherchez des pictogrammes ARASAAC...</div>
            </div>
        `;

        this.input = this.container.querySelector(`#arasaac-input-${this.container.id}`);
        this.modeSelect = this.container.querySelector(`#arasaac-mode-${this.container.id}`);
        this.langSelect = this.container.querySelector(`#arasaac-lang-${this.container.id}`);
        this.resultsContainer = this.container.querySelector(`#arasaac-results-${this.container.id}`);

        this.input.addEventListener('input', (e) => {
            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                this.search(e.target.value);
            }, 400);
        });

        this.modeSelect.addEventListener('change', (e) => {
            this.searchMode = e.target.value;
            if (this.input.value && this.input.value.trim().length >= 2) {
                this.search(this.input.value);
            }
        });

        this.langSelect.addEventListener('change', (e) => {
            this.selectedLocale = e.target.value;
            if (this.input.value && this.input.value.trim().length >= 2) {
                this.search(this.input.value);
            }
        });
    }

    async search(query) {
        const trimmed = (query || '').trim();
        if (!trimmed || trimmed.length < 2) {
            this.resultsContainer.innerHTML = '<div class="text-muted small text-center w-100 mt-3">Tapez au moins 2 caractères...</div>';
            return;
        }

        this.resultsContainer.innerHTML = '<div class="text-muted small text-center w-100 mt-3"><span class="spinner-border spinner-border-sm text-secondary me-1"></span>Recherche en cours...</div>';

        try {
            const locale = this.selectedLocale || 'fr';
            const endpoint = this.searchMode === 'exact' ? 'bestsearch' : 'search';
            const url = `https://api.arasaac.org/api/pictograms/${locale}/${endpoint}/${encodeURIComponent(trimmed)}`;

            const response = await fetch(url);

            if (response.status === 404) {
                this.resultsContainer.innerHTML = '<div class="text-muted small text-center w-100 mt-3">Aucun résultat trouvé.</div>';
                return;
            }

            if (!response.ok) {
                throw new Error(`Erreur API ARASAAC: ${response.status}`);
            }

            const rawData = await response.json();

            // Clear any active tooltip before destroying the DOM nodes
            if (typeof tooltip !== 'undefined' && tooltip.hide) {
                tooltip.hide();
            }
            this.resultsContainer.innerHTML = '';

            const filteredData = filterAndRankPictograms(rawData, trimmed, this.searchMode);

            if (filteredData.length === 0) {
                this.resultsContainer.innerHTML = '<div class="text-muted small text-center w-100 mt-3">Aucun résultat pour ce critère.</div>';
                return;
            }

            // Limit results to 50 to avoid performance issues
            const results = filteredData.slice(0, 50);

            results.forEach(picto => {
                const imgUrl = `https://static.arasaac.org/pictograms/${picto._id}/${picto._id}_300.png`;
                const displayKeyword = picto._matchedKeyword || (picto.keywords && picto.keywords[0] ? picto.keywords[0].keyword : 'Symbole');

                // Collect other synonyms/keywords for secondary display
                const otherKeywords = (picto.keywords || [])
                    .map(k => k.keyword)
                    .filter(kw => kw && kw.toLowerCase() !== displayKeyword.toLowerCase())
                    .slice(0, 3);

                const itemDiv = document.createElement('div');
                itemDiv.className = 'arasaac-item shadow-sm';
                itemDiv.style.width = '100%';
                itemDiv.style.border = '1px solid #e0e0e0';
                itemDiv.style.borderRadius = '6px';
                itemDiv.style.cursor = 'grab';
                itemDiv.style.display = 'flex';
                itemDiv.style.alignItems = 'center';
                itemDiv.style.padding = '6px';
                itemDiv.style.position = 'relative';
                itemDiv.style.background = '#fff';
                itemDiv.style.transition = 'border-color 0.2s ease, box-shadow 0.2s ease';
                itemDiv.setAttribute('draggable', 'true');

                const imageContainer = document.createElement('div');
                imageContainer.style.width = '48px';
                imageContainer.style.height = '48px';
                imageContainer.style.flexShrink = '0';
                imageContainer.style.display = 'flex';
                imageContainer.style.justifyContent = 'center';
                imageContainer.style.alignItems = 'center';
                imageContainer.style.background = '#fcfcfc';
                imageContainer.style.borderRadius = '4px';

                const img = document.createElement('img');
                img.src = imgUrl;
                img.alt = displayKeyword;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.loading = 'lazy';

                imageContainer.appendChild(img);
                itemDiv.appendChild(imageContainer);

                const textContainer = document.createElement('div');
                textContainer.style.marginLeft = '10px';
                textContainer.style.flexGrow = '1';
                textContainer.style.minWidth = '0';
                textContainer.style.display = 'flex';
                textContainer.style.flexDirection = 'column';

                const mainText = document.createElement('span');
                mainText.style.fontSize = '13px';
                mainText.style.fontWeight = '600';
                mainText.style.color = '#212529';
                mainText.style.whiteSpace = 'nowrap';
                mainText.style.overflow = 'hidden';
                mainText.style.textOverflow = 'ellipsis';
                mainText.textContent = displayKeyword;
                textContainer.appendChild(mainText);

                if (otherKeywords.length > 0) {
                    const subText = document.createElement('span');
                    subText.style.fontSize = '11px';
                    subText.style.color = '#6c757d';
                    subText.style.whiteSpace = 'nowrap';
                    subText.style.overflow = 'hidden';
                    subText.style.textOverflow = 'ellipsis';
                    subText.textContent = otherKeywords.join(', ');
                    textContainer.appendChild(subText);
                }

                itemDiv.appendChild(textContainer);

                // Setup Tooltip
                if (typeof tooltip !== 'undefined') {
                    itemDiv.addEventListener('mouseover', (e) => {
                        tooltip.show(e, imgUrl, '', displayKeyword);
                    });
                    itemDiv.addEventListener('mouseout', (e) => {
                        tooltip.hide(e);
                    });
                }

                // Setup Hover Download Button
                const dlBtn = document.createElement('a');
                dlBtn.href = imgUrl;
                dlBtn.target = '_blank';
                dlBtn.download = displayKeyword + '.png';
                dlBtn.innerHTML = '&#128229;';
                dlBtn.style.position = 'absolute';
                dlBtn.style.top = '50%';
                dlBtn.style.transform = 'translateY(-50%)';
                dlBtn.style.right = '8px';
                dlBtn.style.background = 'rgba(255, 255, 255, 0.95)';
                dlBtn.style.border = '1px solid #ced4da';
                dlBtn.style.borderRadius = '4px';
                dlBtn.style.padding = '3px 6px';
                dlBtn.style.fontSize = '14px';
                dlBtn.style.color = '#333';
                dlBtn.style.textDecoration = 'none';
                dlBtn.style.display = 'none';
                dlBtn.style.cursor = 'pointer';
                dlBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
                dlBtn.title = 'Télécharger';

                dlBtn.addEventListener('mousedown', (e) => e.stopPropagation());

                itemDiv.addEventListener('mouseenter', () => {
                    dlBtn.style.display = 'block';
                    itemDiv.style.borderColor = '#adb5bd';
                });
                itemDiv.addEventListener('mouseleave', () => {
                    dlBtn.style.display = 'none';
                    itemDiv.style.borderColor = '#e0e0e0';
                });

                itemDiv.appendChild(dlBtn);

                if (this.onClickCallback) {
                    itemDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.onClickCallback(imgUrl);
                    });
                }

                // Setup Drag
                itemDiv.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    const payload = {
                        type: 'arasaac-image',
                        data: {
                            id: picto._id,
                            name: displayKeyword,
                            path: imgUrl,
                            description: displayKeyword
                        }
                    };

                    if (this.dragStartCallback) {
                        this.dragStartCallback(e, payload);
                    } else {
                        e.dataTransfer.setData('application/json', JSON.stringify(payload));
                        e.dataTransfer.setData('text/plain', picto._id.toString());
                    }
                });

                this.resultsContainer.appendChild(itemDiv);
            });

        } catch (error) {
            console.error('Arasaac search error:', error);
            this.resultsContainer.innerHTML = '<div class="text-danger small text-center w-100 mt-3">Erreur lors de la récupération des résultats.</div>';
        }
    }
}
