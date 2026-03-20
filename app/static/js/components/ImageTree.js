import ImageTreeFolderNode from './ImageTreeFolderNode.js';
import ImageTreeImageNode from './ImageTreeImageNode.js';

export default class ImageTree {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            console.error(`ImageTree : element #${containerId} not found`);
            return;
        }

        this.rootNodes = [];
        this.nodeTypes = {
            FOLDER: ImageTreeFolderNode,
            IMAGE: ImageTreeImageNode
        };
        
        this.init().catch(err => {
            console.error('ImageTree init failed :', err);
            this.container.textContent = 'Error loading data.';
        });
    }

    async init() {
        this.container.replaceChildren(); // Clear container safely
        
        let response;
        try {
            response = await fetch('/api/load_tree_data', {
                credentials: 'same-origin'
            });
        } catch (networkError) {
            console.error('Network error :', networkError);
            this.container.textContent = 'Cannot load data.';
            return;
        }

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            console.error('Server error :', response.status);
            this.container.textContent = 'Error during loading.';
            return;
        }
        
        let treeData;
        try {
            treeData = await response.json();
        } catch (parseError) {
            console.error('Invalid JSON response :', parseError);
            return;
        }

        this.rootNodes = [];

        if (!Array.isArray(treeData)) {
            console.error('Unexpected data format');
            return;
        }

        treeData.forEach(nodeData => {
            if (!nodeData || typeof nodeData !== 'object') return;
            if (nodeData.type === 'folder' && nodeData.data) {
                const folderNode = new this.nodeTypes.FOLDER(nodeData.data, this, nodeData.children ?? [], this.nodeTypes);
                this.rootNodes.push(folderNode);
                this.container.appendChild(folderNode.element);
            }
        });
    }

    async filter(term = '') {
        term = typeof term === 'string' ? term.trim() : '';

        let searchResultsContainer = document.getElementById('image-tree-search-results');
        if (!searchResultsContainer) {
            searchResultsContainer = document.createElement('div');
            searchResultsContainer.id = 'image-tree-search-results';
            searchResultsContainer.classList.add('image-sidebar', 'border', 'p-3', 'flex-grow-1');
            searchResultsContainer.style.overflow = 'auto';
            this.container.parentNode.insertBefore(searchResultsContainer, this.container.nextSibling);
        }

        if (term.length === 0) {
            // Restore original tree view
            searchResultsContainer.style.display = 'none';
            this.container.style.display = '';
            searchResultsContainer.innerHTML = '';
            return;
        }

        // Show search view, hide normal tree
        this.container.style.display = 'none';
        searchResultsContainer.style.display = '';
        searchResultsContainer.innerHTML = '<div class="spinner-border spinner-border-sm m-3"></div>';

        try {
            const response = await fetch('/api/search_local_images?q=' + encodeURIComponent(term));
            if (!response.ok) throw new Error("Search failed");
            
            const results = await response.json();
            searchResultsContainer.innerHTML = '';

            if (results.length === 0) {
                searchResultsContainer.innerHTML = '<p class="text-muted m-3">No results found.</p>';
                return;
            }

            const grouped = {};
            results.forEach(childData => {
                if (childData.type === 'image') {
                    const pathParts = childData.data.path.split('/');
                    pathParts.pop(); // remove filename
                    let dirPath = pathParts.join(' / ');
                    if (!dirPath) dirPath = "Root";

                    if (!grouped[dirPath]) {
                        grouped[dirPath] = [];
                    }
                    grouped[dirPath].push(childData);
                }
            });

            for (const [dirPath, items] of Object.entries(grouped)) {
                // Create a folder header block
                const folderDiv = document.createElement('div');
                folderDiv.classList.add('image-tree-node', 'folder', 'mb-2');
                folderDiv.style.marginLeft = '0';
                
                const contentElement = document.createElement('div');
                contentElement.classList.add('node-content');
                contentElement.style.padding = '5px';
                contentElement.style.backgroundColor = '#f8f9fa';
                contentElement.style.border = '1px solid #ddd';
                contentElement.style.borderRadius = '4px';
                contentElement.style.cursor = 'pointer';

                const icon = document.createElement('img');
                icon.src = '/static/images/folder-open-bold.png';
                icon.style.width = '20px';
                icon.style.marginRight = '8px';
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = dirPath;
                nameSpan.style.fontWeight = 'bold';
                nameSpan.style.color = '#555';

                contentElement.appendChild(icon);
                contentElement.appendChild(nameSpan);
                folderDiv.appendChild(contentElement);

                const childrenContainer = document.createElement('div');
                childrenContainer.classList.add('children');
                childrenContainer.style.marginLeft = '15px';
                childrenContainer.style.display = 'block';

                let isExpanded = true;
                contentElement.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    childrenContainer.style.display = isExpanded ? 'block' : 'none';
                    icon.src = isExpanded ? '/static/images/folder-open-bold.png' : '/static/images/folder-bold.png';
                });

                items.forEach(childData => {
                    const childNode = new this.nodeTypes.IMAGE(childData.data, this);
                    childrenContainer.appendChild(childNode.element);
                    childNode.load(); // Load thumbnail image
                });

                folderDiv.appendChild(childrenContainer);
                searchResultsContainer.appendChild(folderDiv);
            }
        } catch (e) {
            console.error(e);
            searchResultsContainer.innerHTML = '<p class="text-danger m-3">Error performing search.</p>';
        }
    }
}
