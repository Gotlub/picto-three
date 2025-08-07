// --- Start of new Image Tree for Right Sidebar ---

class ImageTreeNode {
    constructor(data, imageTree) {
        this.data = data;
        this.imageTree = imageTree;
        this.element = this.createElement();
        this.children = [];
        this.parent = null;
    }

    createElement() {
        throw new Error("createElement must be implemented by subclass");
    }
}

class ImageTreeFolderNode extends ImageTreeNode {
    constructor(data, imageTree) {
        super(data, imageTree);
        this.expanded = false;
        this.childrenLoaded = false;
    }

    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('image-tree-node', 'folder');
        nodeElement.dataset.id = this.data.id;

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const icon = document.createElement('img');
        icon.src = '/static/images/pictograms/public/bold/folder-bold.png';
        this.icon = icon;
        contentElement.appendChild(icon);

        const nameElement = document.createElement('span');
        nameElement.textContent = this.data.name;
        contentElement.appendChild(nameElement);

        nodeElement.appendChild(contentElement);

        this.childrenContainer = document.createElement('div');
        this.childrenContainer.classList.add('children');
        this.childrenContainer.style.display = 'none';
        nodeElement.appendChild(this.childrenContainer);

        contentElement.addEventListener('click', () => this.toggle());

        return nodeElement;
    }

    toggle() {
        this.expanded = !this.expanded;
        if (this.expanded) {
            this.icon.src = '/static/images/pictograms/public/bold/folder-open-bold.png';
            this.childrenContainer.style.display = '';
            if (!this.childrenLoaded) {
                this.loadChildren();
            }
        } else {
            this.icon.src = '/static/images/pictograms/public/bold/folder-bold.png';
            this.childrenContainer.style.display = 'none';
        }
    }

    async loadChildren() {
        if (this.childrenLoaded) return;

        const response = await fetch(`/api/folder/contents?parent_id=${this.data.id}`);
        const childrenData = await response.json();

        this.childrenLoaded = true;
        this.childrenContainer.innerHTML = ''; // Clear any loading indicator

        if (childrenData.length === 0) {
            const noItems = document.createElement('div');
            noItems.classList.add('image-tree-node', 'info');
            noItems.textContent = 'Empty folder';
            this.childrenContainer.appendChild(noItems);
        } else {
            childrenData.forEach(childData => {
                let childNode;
                if (childData.type === 'folder') {
                    childNode = new ImageTreeFolderNode(childData, this.imageTree);
                } else {
                    childNode = new ImageTreeImageNode(childData, this.imageTree);
                }
                childNode.parent = this;
                this.children.push(childNode);
                this.childrenContainer.appendChild(childNode.element);
            });
        }
    }

    filter(term, visibleNodes) {
        const nameMatch = this.data.name.toLowerCase().includes(term);
        let childrenMatch = false;

        this.children.forEach(child => {
            if (child.filter(term, visibleNodes)) {
                childrenMatch = true;
            }
        });

        if (nameMatch || childrenMatch) {
            this.element.style.display = '';
            visibleNodes.add(this);
            if (childrenMatch && !this.expanded) {
                 this.toggle();
            }
        } else {
            this.element.style.display = 'none';
        }
        return nameMatch || childrenMatch;
    }
}

class ImageTreeImageNode extends ImageTreeNode {
    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('image-tree-node', 'image');
        nodeElement.dataset.id = this.data.id;

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        imgElement.src = this.data.path.replace('app/static', '/static');
        imgElement.alt = this.data.name;

        // Add tooltip events
        imgElement.addEventListener('mouseover', (e) => {
            tooltip.show(e, imgElement.src);
        });
        imgElement.addEventListener('mouseout', (e) => {
            tooltip.hide(e);
        });

        contentElement.appendChild(imgElement);

        const nameElement = document.createElement('span');
        nameElement.textContent = this.data.name;
        contentElement.appendChild(nameElement);

        nodeElement.appendChild(contentElement);

        contentElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.imageTree.onImageClick(this.data);
        });

        return nodeElement;
    }

    filter(term, visibleNodes) {
        const nameMatch = this.data.name.toLowerCase().includes(term);
        if (nameMatch) {
            this.element.style.display = '';
            visibleNodes.add(this);
        } else {
            this.element.style.display = 'none';
        }
        return nameMatch;
    }
}

class ImageTree {
    constructor(containerId, initialData, onImageClick) {
        this.container = document.getElementById(containerId);
        this.initialData = initialData;
        this.onImageClick = onImageClick;
        this.rootNodes = [];
        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.initialData.forEach(data => {
            const node = new ImageTreeFolderNode(data, this);
            this.rootNodes.push(node);
            this.container.appendChild(node.element);
        });
    }

    filter(term) {
        const visibleNodes = new Set();
        this.rootNodes.forEach(node => node.filter(term.toLowerCase(), visibleNodes));
    }
}


// --- End of new Image Tree for Right Sidebar ---


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
        imgElement.src = this.image.path.replace('app/', '');
        imgElement.alt = this.image.name;

        // Add tooltip events
        imgElement.addEventListener('mouseover', (e) => {
            tooltip.show(e, imgElement.src);
        });
        imgElement.addEventListener('mouseout', (e) => {
            tooltip.hide(e);
        });

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

class TreeBuilder {
    constructor() {
        this.imageSearch = document.getElementById('image-search');
        this.treeDisplay = document.getElementById('tree-display');
        this.treeList = document.getElementById('tree-list');
        this.images = JSON.parse(document.getElementById('images-data').textContent);
        this.savedTrees = [];
        this.rootNode = new Node({ id: 'root', name: 'Root' }, this);
        this.selectedNode = null;
        this.rootSelected = false;

        // New Image Tree initialization
        const initialTreeData = JSON.parse(document.getElementById('initial-tree-data').textContent);
        this.imageTree = new ImageTree('image-sidebar-tree', initialTreeData, (image) => this.handleImageClick(image));

        this.treeDisplay.addEventListener('click', (e) => {
            if (e.target === this.treeDisplay) {
                this.deselectAllNodes();
            }
        });

        const saveBtn = document.getElementById('save-tree-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveTree());
        }

        const importBtn = document.getElementById('import-json-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importTreeFromJSON());
        }

        const exportBtn = document.getElementById('export-json-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportTreeToJSON());
        }

        const loadBtn = document.getElementById('load-tree-btn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadTree());
        }

        if (this.imageSearch) {
            this.imageSearch.addEventListener('input', () => this.filterImages());
        }

        const rootBtn = document.getElementById('root-btn');
        if (rootBtn) {
            rootBtn.addEventListener('click', () => this.selectRoot());
        }

        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteSelectedNode());
        }

        this.loadSavedTrees();
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
            // If no node is selected, add to the root
            this.rootNode.addChild(newNode);
            this.selectNode(newNode);
        }
        this.renderTree();
    }

    selectNode(node) {
        this.deselectAllNodes();
        this.selectedNode = node;
        if (this.selectedNode) {
            this.selectedNode.element.querySelector('.node-content').classList.add('selected');
        }
    }

    deselectAllNodes() {
        if (this.selectedNode) {
            this.selectedNode.element.querySelector('.node-content').classList.remove('selected');
            this.selectedNode = null;
        }
        this.rootSelected = false;
        this.treeDisplay.classList.remove('root-selected');
    }

    selectRoot() {
        this.deselectAllNodes();
        this.rootSelected = true;
        this.treeDisplay.classList.add('root-selected');
    }

    deleteSelectedNode() {
        if (!this.selectedNode) {
            alert('Please select a node to delete.');
            return;
        }

        if (confirm('Are you sure you want to delete the selected node and all its children?')) {
            this.removeNode(this.rootNode, this.selectedNode);
            this.selectedNode = null;
            const treeData = this.getTreeAsJSON();
            this.rebuildTreeFromJSON(treeData);
        }
    }

    removeNode(parent, nodeToRemove) {
        if (!parent) {
            return;
        }
        parent.children = parent.children.filter(child => child !== nodeToRemove);
        parent.children.forEach(child => this.removeNode(child, nodeToRemove));
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
        const buildNode = (node) => {
            const nodeData = {
                id: node.image.id,
                children: []
            };
            node.children.forEach(child => {
                nodeData.children.push(buildNode(child));
            });
            return nodeData;
        };

        const roots = [];
        this.rootNode.children.forEach(child => {
            roots.push(buildNode(child));
        });

        return {
            roots: roots
        };
    }

    async saveTree() {
        const treeName = document.getElementById('tree-name').value;
        if (!treeName) {
            alert('Please enter a name for the tree.');
            return;
        }

        const isPublic = document.getElementById('tree-is-public').checked;
        const jsonData = this.getTreeAsJSON();

        if (!jsonData || !jsonData.roots || jsonData.roots.length === 0) {
            alert('The tree is empty. Cannot save.');
            return;
        }

        const response = await fetch('/api/tree/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: treeName,
                is_public: isPublic,
                json_data: jsonData,
            }),
        });

        const result = await response.json();
        if (result.status === 'success') {
            alert('Tree saved successfully!');
            // Reload the builder with the saved tree data
            this.rebuildTreeFromJSON(result.tree_data);
            // Refresh the list of saved trees
            this.loadSavedTrees();
        } else {
            // Display specific error messages
            alert(`Error saving tree: ${result.message}`);
        }
    }

    filterImages() {
        const searchTerm = this.imageSearch.value;
        this.imageTree.filter(searchTerm);
    }

    async loadSavedTrees() {
        const response = await fetch('/api/trees/load');
        const data = await response.json();
        this.publicTrees = data.public_trees || [];
        this.userTrees = data.user_trees || [];
        this.renderTreeList();
    }

    renderTreeList() {
        if (!this.treeList) return;
        this.treeList.innerHTML = '';
        this.activeTreeSelect = null; // To keep track of the currently active select element

        const createSelectList = (trees, title, id) => {
            if (trees.length > 0) {
                const titleEl = document.createElement('h6');
                titleEl.textContent = title;
                this.treeList.appendChild(titleEl);

                const select = document.createElement('select');
                select.id = id;
                select.className = 'form-control mb-2 tree-select-list';
                trees.forEach(tree => {
                    const option = document.createElement('option');
                    option.value = tree.id;
                    option.textContent = tree.name;
                    select.appendChild(option);
                });

                // When a user clicks on a select list, it becomes the active one
                select.addEventListener('focus', () => {
                    this.activeTreeSelect = select;
                });

                this.treeList.appendChild(select);
            }
        };

        createSelectList(this.userTrees, 'My Private Trees', 'user-tree-select');
        createSelectList(this.publicTrees, 'Public Trees', 'public-tree-select');

        // Set the default active list if it exists
        if (this.userTrees.length > 0) {
            this.activeTreeSelect = document.getElementById('user-tree-select');
        } else if (this.publicTrees.length > 0) {
            this.activeTreeSelect = document.getElementById('public-tree-select');
        }
    }

    loadTree() {
        if (!this.activeTreeSelect || !this.activeTreeSelect.value) {
            alert('Please select a tree to load.');
            return;
        }

        const treeId = parseInt(this.activeTreeSelect.value, 10);
        const allTrees = (this.userTrees || []).concat(this.publicTrees || []);
        const treeToLoad = allTrees.find(tree => tree.id === treeId);

        if (treeToLoad) {
            const treeData = JSON.parse(treeToLoad.json_data);
            this.rebuildTreeFromJSON(treeData);
        } else {
            alert('Could not find the selected tree.');
        }
    }

    rebuildTreeFromJSON(treeData) {
        this.rootNode = new Node({ id: 'root', name: 'Root' }, this);
        this.selectedNode = null;

        const buildNode = (nodeData) => {
            const image = this.images.find(img => img.id === nodeData.id);
            if (!image) {
                console.error('Image not found for id:', nodeData.id);
                return null;
            }
            const newNode = new Node(image, this);
            if (nodeData.children) {
                nodeData.children.forEach(childData => {
                    const childNode = buildNode(childData);
                    if (childNode) {
                        newNode.addChild(childNode);
                    }
                });
            }
            return newNode;
        };

        if (treeData.roots) {
            treeData.roots.forEach(rootData => {
                const rootNode = buildNode(rootData);
                if (rootNode) {
                    this.rootNode.addChild(rootNode);
                }
            });
        }

        this.renderTree();
    }

    exportTreeToJSON() {
        const jsonData = this.getTreeAsJSON();
        if (!jsonData) {
            alert('The tree is empty.');
            return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "tree.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    importTreeFromJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const treeData = JSON.parse(event.target.result);
                        this.rebuildTreeFromJSON(treeData);
                    } catch (error) {
                        alert('Error parsing JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TreeBuilder();
});
