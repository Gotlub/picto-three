export default class ArasaacSearch {
    constructor(containerId, dragStartCallback) {
        this.container = document.getElementById(containerId);
        this.dragStartCallback = dragStartCallback; // Callback to handle drag start in parent
        this.timeout = null;
        this.render();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="arasaac-search-box mb-2 flex-shrink-0">
                <input type="text" class="form-control" placeholder="Search Arasaac..." id="arasaac-input-${this.container.id}">
            </div>
            <div class="arasaac-results flex-grow-1" id="arasaac-results-${this.container.id}" style="overflow-y: auto; display: flex; flex-direction: column; gap: 5px; align-content: flex-start; min-height: 0; padding-right: 5px;">
                <!-- Results will appear here -->
                <div class="text-muted small text-center w-100 mt-3">Type to search symbols from Arasaac...</div>
            </div>
        `;

        this.input = this.container.querySelector(`#arasaac-input-${this.container.id}`);
        this.resultsContainer = this.container.querySelector(`#arasaac-results-${this.container.id}`);

        this.input.addEventListener('input', (e) => {
            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                this.search(e.target.value);
            }, 500);
        });
    }

    async search(query) {
        if (!query || query.length < 2) {
            this.resultsContainer.innerHTML = '<div class="text-muted small text-center w-100 mt-3">Type at least 2 characters...</div>';
            return;
        }

        this.resultsContainer.innerHTML = '<div class="text-muted small text-center w-100 mt-3">Loading...</div>';

        try {
            // Use the global locale variable injected in base.html, defaulting to 'en'
            const locale = window.CURRENT_LOCALE || 'en';
            const response = await fetch(`https://api.arasaac.org/api/pictograms/${locale}/search/${encodeURIComponent(query)}`);
            const data = await response.json();

            // Clear any active tooltip before destroying the DOM nodes
            if (typeof tooltip !== 'undefined' && tooltip.hide) {
                tooltip.hide();
            }
            this.resultsContainer.innerHTML = '';

            if (data.length === 0) {
                this.resultsContainer.innerHTML = '<div class="text-muted small text-center w-100 mt-3">No results found.</div>';
                return;
            }

            // Filtrer et trier par ordre alphabétique sur la description (keyword)
            data.sort((a, b) => {
                const keywordA = (a.keywords && a.keywords.length > 0) ? a.keywords[0].keyword.toLowerCase() : '';
                const keywordB = (b.keywords && b.keywords.length > 0) ? b.keywords[0].keyword.toLowerCase() : '';
                return keywordA.localeCompare(keywordB);
            });

            // Limit results to 50 to avoid performance issues
            const results = data.slice(0, 50);

            results.forEach(picto => {
                const imgUrl = `https://static.arasaac.org/pictograms/${picto._id}/${picto._id}_300.png`;

                const itemDiv = document.createElement('div');
                itemDiv.className = 'arasaac-item';
                itemDiv.style.width = '100%';
                itemDiv.style.border = '1px solid #ddd';
                itemDiv.style.borderRadius = '4px';
                itemDiv.style.cursor = 'grab';
                itemDiv.style.display = 'flex';
                itemDiv.style.alignItems = 'center';
                itemDiv.style.padding = '5px';
                itemDiv.style.position = 'relative'; // For absolute DL button
                itemDiv.style.background = '#fff';
                itemDiv.setAttribute('draggable', 'true');

                const imageContainer = document.createElement('div');
                imageContainer.style.width = '50px';
                imageContainer.style.height = '50px';
                imageContainer.style.flexShrink = '0';
                imageContainer.style.display = 'flex';
                imageContainer.style.justifyContent = 'center';
                imageContainer.style.alignItems = 'center';

                const img = document.createElement('img');
                img.src = imgUrl;
                img.alt = picto.keywords[0].keyword;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';

                imageContainer.appendChild(img);
                itemDiv.appendChild(imageContainer);

                const textSpan = document.createElement('span');
                textSpan.style.marginLeft = '12px';
                textSpan.style.flexGrow = '1';
                textSpan.style.fontSize = '14px';
                textSpan.style.color = '#333';
                textSpan.textContent = picto.keywords[0].keyword; // Description
                itemDiv.appendChild(textSpan);

                // Setup Tooltip
                // Use the global 'tooltip' object defined in tooltip.js
                if (typeof tooltip !== 'undefined') {
                    itemDiv.addEventListener('mouseover', (e) => {
                        // Pass image, name is empty, description is keyword
                        tooltip.show(e, imgUrl, '', picto.keywords[0].keyword);
                    });
                    itemDiv.addEventListener('mouseout', (e) => {
                        tooltip.hide(e);
                    });
                }

                // Setup Hover Download Button
                const dlBtn = document.createElement('a');
                dlBtn.href = imgUrl;
                dlBtn.target = '_blank'; // Arasaac is cross-origin, standard download attribute fails CORS without header
                dlBtn.download = picto.keywords[0].keyword + '.png';
                dlBtn.innerHTML = '&#128229;'; // Inbox tray emoji
                dlBtn.style.position = 'absolute';
                dlBtn.style.top = '50%';
                dlBtn.style.transform = 'translateY(-50%)';
                dlBtn.style.right = '8px';
                dlBtn.style.background = 'rgba(255, 255, 255, 0.9)';
                dlBtn.style.border = '1px solid #ddd';
                dlBtn.style.borderRadius = '4px';
                dlBtn.style.padding = '4px 8px';
                dlBtn.style.fontSize = '16px';
                dlBtn.style.color = '#333';
                dlBtn.style.textDecoration = 'none';
                dlBtn.style.display = 'none';
                dlBtn.style.cursor = 'pointer';
                dlBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
                dlBtn.title = 'Download';

                dlBtn.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent node drag

                itemDiv.addEventListener('mouseenter', () => dlBtn.style.display = 'block');
                itemDiv.addEventListener('mouseleave', () => dlBtn.style.display = 'none');

                itemDiv.appendChild(dlBtn);

                // Setup Drag
                itemDiv.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    const payload = {
                        type: 'arasaac-image',
                        data: {
                            id: picto._id, // Use Arasaac ID
                            name: picto.keywords[0].keyword,
                            path: imgUrl, // Full URL
                            description: picto.keywords[0].keyword
                        }
                    };

                    if (this.dragStartCallback) {
                        this.dragStartCallback(e, payload);
                    } else {
                        // Default fallback if no callback provided
                        e.dataTransfer.setData('application/json', JSON.stringify(payload));
                        e.dataTransfer.setData('text/plain', picto._id.toString());
                    }
                });

                this.resultsContainer.appendChild(itemDiv);
            });

        } catch (error) {
            console.error('Arasaac search error:', error);
            this.resultsContainer.innerHTML = '<div class="text-danger small text-center w-100 mt-3">Error fetching results.</div>';
        }
    }
}
