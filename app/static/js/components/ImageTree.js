import ImageTreeFolderNode from './ImageTreeFolderNode.js';
import ImageTreeImageNode from './ImageTreeImageNode.js';

export default class ImageTree {
    constructor(containerId, onImageClick) {
        this.container = document.getElementById(containerId);
        this.onImageClick = onImageClick;
        this.rootNodes = [];
        this.nodeTypes = {
            FOLDER: ImageTreeFolderNode,
            IMAGE: ImageTreeImageNode
        };
        this.init();
    }

    async init() {
        this.container.innerHTML = ''; // Clear container
        const response = await fetch('/api/load_tree_data');
        const treeData = await response.json();

        this.rootNodes = [];

        treeData.forEach(nodeData => {
            if (nodeData.type === 'folder') {
                const folderNode = new this.nodeTypes.FOLDER(nodeData.data, this, nodeData.children, this.nodeTypes);
                this.rootNodes.push(folderNode);
                this.container.appendChild(folderNode.element);
            }
        });
    }

    filter(term) {
        const visibleNodes = new Set();
        this.rootNodes.forEach(theNode => theNode.filter(term.toLowerCase(), visibleNodes));
    }
}
