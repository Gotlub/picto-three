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

    filter(term = '') {
        if (typeof term !== 'string') return;
        const sanitized = term.toLowerCase().trim();
        const visibleNodes = new Set();
        this.rootNodes.forEach(theNode => {
            if (theNode && typeof theNode.filter === 'function') {
                theNode.filter(sanitized, visibleNodes);
            }
        });
    }
}
