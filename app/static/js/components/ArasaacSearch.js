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
            <div class="arasaac-search-box mb-2">
                <input type="text" class="form-control" placeholder="Search Arasaac..." id="arasaac-input-${this.container.id}">
            </div>
            <div class="arasaac-results" id="arasaac-results-${this.container.id}" style="overflow-y: auto; height: calc(100% - 50px); display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start;">
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

            this.resultsContainer.innerHTML = '';

            if (data.length === 0) {
                this.resultsContainer.innerHTML = '<div class="text-muted small text-center w-100 mt-3">No results found.</div>';
                return;
            }

            // Limit results to 50 to avoid performance issues
            const results = data.slice(0, 50);

            results.forEach(picto => {
                const imgUrl = `https://static.arasaac.org/pictograms/${picto._id}/${picto._id}_300.png`;

                const itemDiv = document.createElement('div');
                itemDiv.className = 'arasaac-item';
                itemDiv.style.width = '60px';
                itemDiv.style.height = '60px';
                itemDiv.style.border = '1px solid #ddd';
                itemDiv.style.borderRadius = '4px';
                itemDiv.style.cursor = 'grab';
                itemDiv.style.display = 'flex';
                itemDiv.style.alignItems = 'center';
                itemDiv.style.justifyContent = 'center';
                itemDiv.style.padding = '2px';
                itemDiv.setAttribute('draggable', 'true');

                const img = document.createElement('img');
                img.src = imgUrl;
                img.alt = picto.keywords[0].keyword;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';

                itemDiv.appendChild(img);

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
