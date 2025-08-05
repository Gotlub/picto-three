class Node {
    constructor(image, builder) {
        this.image = image;
        this.builder = builder;
        this.children = [];
        this.element = this.createElement(builder);
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
        this.imageSidebar = document.getElementById('image-sidebar');
        this.imageSearch = document.getElementById('image-search');
        this.treeDisplay = document.getElementById('tree-display');
        this.treeList = document.getElementById('tree-list');
        this.images = JSON.parse(document.getElementById('images-data').textContent);
        this.savedTrees = [];
        this.root = null;
        this.selectedNode = null;
        this.rootSelected = false;
        this.init();
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

    init() {
        this.images.forEach(image => {
            const imageItem = this.imageSidebar.querySelector(`[data-image-id='${image.id}']`);
            if (imageItem) {
                imageItem.addEventListener('click', () => this.handleImageClick(image));
            }
        });
    }

    handleImageClick(image) {
        const newNode = new Node(image, this);
        if (this.rootSelected) {
            // This is a simplified approach to adding a new root.
            // A more robust implementation would handle multiple roots.
            if (!this.root) {
                this.root = newNode;
            } else {
                // For simplicity, we'll just replace the root.
                // A better approach might be to create a new tree or add to a list of roots.
                this.root = newNode;
            }
            this.selectNode(this.root);
            this.rootSelected = false;
            this.treeDisplay.classList.remove('root-selected');
        } else if (!this.root) {
            this.root = newNode;
            this.selectNode(this.root);
        } else if (this.selectedNode) {
            this.selectedNode.addChild(newNode);
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
        this.updateSidebar();
    }

    deselectAllNodes() {
        if (this.selectedNode) {
            this.selectedNode.element.querySelector('.node-content').classList.remove('selected');
            this.selectedNode = null;
        }
        this.rootSelected = false;
        this.treeDisplay.classList.remove('root-selected');
        this.updateSidebar();
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
            if (this.selectedNode === this.root) {
                this.root = null;
            } else {
                this.removeNode(this.root, this.selectedNode);
            }
            this.selectedNode = null;
            this.renderTree();
        }
    }

    removeNode(parent, nodeToRemove) {
        if (!parent) {
            return;
        }
        parent.children = parent.children.filter(child => child !== nodeToRemove);
        parent.children.forEach(child => this.removeNode(child, nodeToRemove));
    }

    updateSidebar() {
        const sidebarImages = this.imageSidebar.querySelectorAll('img');
        if (this.selectedNode) {
            sidebarImages.forEach(img => {
                if (img.dataset.imageId !== this.selectedNode.image.id.toString()) {
                    img.classList.add('grayscale');
                } else {
                    img.classList.remove('grayscale');
                }
            });
        } else {
            sidebarImages.forEach(img => {
                img.classList.remove('grayscale');
            });
        }
    }

    renderTree() {
        this.treeDisplay.innerHTML = '';
        if (this.root) {
            this.treeDisplay.appendChild(this.root.element);
            this.renderChildren(this.root, this.root.element);
        }
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
        if (!this.root) {
            return null;
        }

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

        const allNodes = new Set();
        const childNodes = new Set();
        const traverseForAllNodes = (node) => {
            if (!node) return;
            allNodes.add(node);
            node.children.forEach(child => {
                childNodes.add(child);
                traverseForAllNodes(child);
            });
        };
        traverseForAllNodes(this.root);

        const roots = [];
        allNodes.forEach(node => {
            if (!childNodes.has(node)) {
                roots.push(buildNode(node));
            }
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

        if (!jsonData) {
            alert('The tree is empty.');
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
        } else {
            alert(`Error saving tree: ${result.message}`);
        }
    }

    filterImages() {
        const searchTerm = this.imageSearch.value.toLowerCase();
        const imageItems = this.imageSidebar.querySelectorAll('.image-item');

        imageItems.forEach(item => {
            const name = item.dataset.imageName.toLowerCase();
            const path = item.dataset.imagePath.toLowerCase();
            if (name.includes(searchTerm) || path.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async loadSavedTrees() {
        const response = await fetch('/api/trees/load');
        this.savedTrees = await response.json();
        this.renderTreeList();
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
        const select = document.getElementById('tree-select');
        if (!select) return;

        const treeId = parseInt(select.value, 10);
        const treeToLoad = this.savedTrees.find(tree => tree.id === treeId);

        if (treeToLoad) {
            const treeData = JSON.parse(treeToLoad.json_data);
            this.rebuildTreeFromJSON(treeData);
        }
    }

    rebuildTreeFromJSON(treeData) {
        this.root = null;
        this.selectedNode = null;

        const buildNode = (nodeData) => {
            const image = this.images.find(img => img.id === nodeData.id);
            if (!image) {
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

        if (treeData.roots && treeData.roots.length > 0) {
            // For now, we only support one root visually.
            // This can be extended later to support multiple root nodes on the canvas.
            this.root = buildNode(treeData.roots[0]);
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
