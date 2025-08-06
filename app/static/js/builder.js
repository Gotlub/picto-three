// --- Tooltip Manager ---
class TooltipManager {
    constructor() {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.id = 'image-tooltip';
        document.body.appendChild(this.tooltipElement);
        this.timer = null;
    }

    attach(element) {
        element.addEventListener('mouseenter', (e) => {
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                const previewImg = document.createElement('img');
                previewImg.src = element.src;
                this.tooltipElement.innerHTML = '';
                this.tooltipElement.appendChild(previewImg);

                // Position and show
                this.tooltipElement.style.left = `${e.pageX + 15}px`;
                this.tooltipElement.style.top = `${e.pageY + 15}px`;
                this.tooltipElement.style.display = 'block';
            }, 1000);
        });

        element.addEventListener('mouseleave', () => {
            clearTimeout(this.timer);
            this.tooltipElement.style.display = 'none';
        });
    }
}


// --- Node classes for the sidebar ---

class SidebarNode {
    constructor(data, builder) {
        this.data = data;
        this.builder = builder;
        this.element = null;
        this.children = [];
    }
}

class FolderNode extends SidebarNode {
    constructor(data, builder) {
        super(data, builder);
        this.isOpen = false;
        this.areChildrenLoaded = false;
        this.element = this.createElement();
    }

    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('sidebar-node', 'folder-node');
        nodeElement.style.paddingLeft = `${(this.data.depth || 0) * 15}px`;
        nodeElement.dataset.name = this.data.name; // For searching

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const icon = document.createElement('img');
        icon.src = '/static/images/pictograms/public/bold/folder-bold.png';
        icon.classList.add('folder-icon');
        contentElement.appendChild(icon);

        const nameElement = document.createElement('span');
        nameElement.textContent = this.data.name;
        contentElement.appendChild(nameElement);

        nodeElement.appendChild(contentElement);

        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('children-container');
        childrenContainer.style.display = 'none';
        nodeElement.appendChild(childrenContainer);

        contentElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        return nodeElement;
    }

    async toggle() {
        this.isOpen = !this.isOpen;
        const icon = this.element.querySelector('.folder-icon');
        const childrenContainer = this.element.querySelector('.children-container');

        if (this.isOpen) {
            icon.src = '/static/images/pictograms/public/bold/folder-open-bold.png';
            childrenContainer.style.display = 'block';
            if (!this.areChildrenLoaded) {
                await this.loadChildren();
            }
        } else {
            icon.src = '/static/images/pictograms/public/bold/folder-bold.png';
            childrenContainer.style.display = 'none';
        }
    }

    async loadChildren() {
        if (this.areChildrenLoaded) return;

        try {
            const response = await fetch(`/api/folder/${this.data.id}/contents`);
            if (!response.ok) throw new Error('Failed to fetch folder contents');
            const contents = await response.json();

            this.areChildrenLoaded = true;
            const childrenContainer = this.element.querySelector('.children-container');
            childrenContainer.innerHTML = ''; // Clear loading indicator

            const childDepth = (this.data.depth || 0) + 1;

            contents.folders.forEach(folderData => {
                folderData.depth = childDepth;
                const folderNode = new FolderNode(folderData, this.builder);
                this.children.push(folderNode);
                childrenContainer.appendChild(folderNode.element);
            });

            contents.images.forEach(imageData => {
                imageData.depth = childDepth;
                const imageNode = new ImageNode(imageData, this.builder);
                this.children.push(imageNode);
                childrenContainer.appendChild(imageNode.element);
            });

        } catch (error) {
            console.error('Error loading children:', error);
        }
    }
}

class ImageNode extends SidebarNode {
    constructor(data, builder) {
        super(data, builder);
        this.element = this.createElement();
    }

    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('sidebar-node', 'image-node');
        nodeElement.style.paddingLeft = `${(this.data.depth || 0) * 15}px`;
        nodeElement.dataset.name = this.data.name; // For searching

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        const imgPath = this.data.path.startsWith('app/') ? this.data.path.substring(3) : this.data.path;
        imgElement.src = imgPath;
        imgElement.alt = this.data.name;
        imgElement.classList.add('image-icon');
        this.builder.tooltipManager.attach(imgElement); // Attach tooltip logic
        contentElement.appendChild(imgElement);

        const nameElement = document.createElement('span');
        nameElement.textContent = this.data.name;
        contentElement.appendChild(nameElement);

        nodeElement.appendChild(contentElement);

        contentElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.builder.handleImageClick(this.data);
        });

        return nodeElement;
    }
}

// --- Main Tree Node (on the canvas) ---
class Node {
    constructor(image, builder) {
        this.image = image;
        this.builder = builder;
        this.children = [];
        if (image.id !== 'root') {
            this.element = this.createElement(builder);
        }
    }

    addChild(node) {
        this.children.push(node);
    }

    createElement(builder) {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node');

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        const imgPath = this.image.path.startsWith('app/') ? this.image.path.substring(3) : this.image.path;
        imgElement.src = imgPath;
        imgElement.alt = this.image.name;
        this.builder.tooltipManager.attach(imgElement); // Attach tooltip logic
        contentElement.appendChild(imgElement);

        const nameElement = document.createElement('span');
        nameElement.textContent = this.image.name;
        contentElement.appendChild(nameElement);

        nodeElement.appendChild(contentElement);

        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation();
            builder.selectNode(this);
        });
        return nodeElement;
    }
}

// --- Main Application Class ---
class TreeBuilder {
    constructor() {
        this.imageSidebar = document.getElementById('image-sidebar');
        this.imageSearch = document.getElementById('image-search');
        this.treeDisplay = document.getElementById('tree-display');
        this.treeList = document.getElementById('tree-list');

        this.rootNode = new Node({ id: 'root', name: 'Root' }, this);
        this.selectedNode = null;
        this.rootSelected = false;

        this.sidebarRootNodes = [];
        this.savedTrees = [];

        this.tooltipManager = new TooltipManager();

        this.initSidebar();
        this.initEventListeners();
        this.loadSavedTrees();
    }

    initSidebar() {
        this.imageSidebar.innerHTML = '';
        const initialData = JSON.parse(document.getElementById('initial-tree-data').textContent);
        initialData.forEach(folderData => {
            folderData.depth = 0;
            const folderNode = new FolderNode(folderData, this);
            this.sidebarRootNodes.push(folderNode);
            this.imageSidebar.appendChild(folderNode.element);
        });
    }

    filterSidebar() {
        const searchTerm = this.imageSearch.value.toLowerCase();

        if (!searchTerm) {
            // Reset view: simply re-initialize
            this.initSidebar();
            return;
        }

        const allNodes = this.imageSidebar.querySelectorAll('.sidebar-node');
        allNodes.forEach(node => node.style.display = 'none'); // Hide all

        const matchedNodes = this.imageSidebar.querySelectorAll(`.sidebar-node[data-name*="${searchTerm}" i]`);

        matchedNodes.forEach(node => {
            node.style.display = 'block';
            let current = node;
            while (current && current !== this.imageSidebar) {
                if (current.classList.contains('sidebar-node')) {
                    current.style.display = 'block';
                }
                if (current.classList.contains('children-container')) {
                    current.style.display = 'block';
                    const parentNode = current.closest('.folder-node');
                    if (parentNode) {
                        const icon = parentNode.querySelector('.folder-icon');
                        if (icon) icon.src = '/static/images/pictograms/public/bold/folder-open-bold.png';
                    }
                }
                current = current.parentElement;
            }
        });
    }

    initEventListeners() {
        this.treeDisplay.addEventListener('click', (e) => {
            if (e.target === this.treeDisplay) this.deselectAllNodes();
        });

        const saveBtn = document.getElementById('save-tree-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveTree());

        const importBtn = document.getElementById('import-json-btn');
        if (importBtn) importBtn.addEventListener('click', () => this.importTreeFromJSON());

        const exportBtn = document.getElementById('export-json-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportTreeToJSON());

        const loadBtn = document.getElementById('load-tree-btn');
        if (loadBtn) loadBtn.addEventListener('click', () => this.loadTree());

        if (this.imageSearch) this.imageSearch.addEventListener('input', () => this.filterSidebar());

        const rootBtn = document.getElementById('root-btn');
        if (rootBtn) rootBtn.addEventListener('click', () => this.selectRoot());

        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteSelectedNode());
    }

    handleImageClick(image) {
        const newNode = new Node(image, this);
        if (this.rootSelected) {
            this.rootNode.addChild(newNode);
            this.selectNode(newNode);
            this.rootSelected = false;
            this.treeDisplay.classList.remove('root-selected');
        } else if (this.selectedNode) {
            this.selectedNode.addChild(newNode);
            this.selectNode(newNode);
        } else {
            this.rootNode.addChild(newNode);
            this.selectNode(newNode);
        }
        this.renderTree();
    }

    selectNode(node) {
        this.deselectAllNodes();
        this.selectedNode = node;
        if (this.selectedNode && this.selectedNode.element) {
            this.selectedNode.element.querySelector('.node-content').classList.add('selected');
        }
    }

    deselectAllNodes() {
        if (this.selectedNode && this.selectedNode.element) {
            this.selectedNode.element.querySelector('.node-content').classList.remove('selected');
        }
        this.selectedNode = null;
        this.rootSelected = false;
        this.treeDisplay.classList.remove('root-selected');
    }

    selectRoot() {
        this.deselectAllNodes();
        this.rootSelected = true;
        this.treeDisplay.classList.add('root-selected');
    }

    deleteSelectedNode() {
        if (!this.selectedNode) return alert('Please select a node to delete.');
        if (confirm('Are you sure you want to delete the selected node and all its children?')) {
            this.removeNode(this.rootNode, this.selectedNode);
            this.selectedNode = null;
            this.renderTree();
        }
    }

    removeNode(parent, nodeToRemove) {
        const index = parent.children.indexOf(nodeToRemove);
        if (index > -1) {
            parent.children.splice(index, 1);
        } else {
            parent.children.forEach(child => this.removeNode(child, nodeToRemove));
        }
    }

    renderTree() {
        this.treeDisplay.innerHTML = '';
        this.rootNode.children.forEach(child => {
            this.treeDisplay.appendChild(child.element);
            this.renderChildren(child, child.element);
        });
    }

    renderChildren(node, parentElement) {
        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('children');
        node.children.forEach(child => {
            childrenContainer.appendChild(child.element);
            this.renderChildren(child, child.element);
        });
        parentElement.appendChild(childrenContainer);
    }

    getTreeAsJSON() {
        const buildNode = (node) => ({
            id: node.image.id,
            children: node.children.map(buildNode)
        });
        return { roots: this.rootNode.children.map(buildNode) };
    }

    async saveTree() {
        const treeName = document.getElementById('tree-name').value;
        if (!treeName) return alert('Please enter a name for the tree.');

        const isPublic = document.getElementById('tree-is-public').checked;
        const jsonData = this.getTreeAsJSON();

        if (jsonData.roots.length === 0) return alert('The tree is empty.');

        const response = await fetch('/api/tree/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: treeName, is_public: isPublic, json_data: jsonData }),
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Tree saved successfully!');
            this.loadSavedTrees();
        } else {
            alert(`Error saving tree: ${result.message}`);
        }
    }

    async loadSavedTrees() {
        try {
            const response = await fetch('/api/trees/load');
            this.savedTrees = await response.json();
            this.renderTreeList();
        } catch (error) {
            console.error("Could not load saved trees", error);
        }
    }

    renderTreeList() {
        if (!this.treeList) return;
        this.treeList.innerHTML = '';
        const select = document.createElement('select');
        select.id = 'tree-select';
        select.className = 'form-control';

        this.savedTrees.forEach(tree => {
            const option = document.createElement('option');
            option.value = tree.id;
            option.textContent = tree.name;
            select.appendChild(option);
        });
        this.treeList.appendChild(select);
    }

    loadTree() {
        alert('Loading saved trees is temporarily unavailable. This feature is being updated.');
        console.error("Load Tree: This functionality needs a new backend endpoint to fetch image details from IDs.");
    }

    exportTreeToJSON() {
        const jsonData = this.getTreeAsJSON();
        if (jsonData.roots.length === 0) return alert('The tree is empty.');

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "tree.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    importTreeFromJSON() {
        alert('Importing trees is temporarily unavailable. This feature is being updated.');
        console.error("Import Tree: This functionality needs a new backend endpoint to fetch image details from IDs.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TreeBuilder();
});
