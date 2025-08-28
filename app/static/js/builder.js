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
        icon.src = '/static/images/folder-bold.png';
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
            this.icon.src = '/static/images/folder-open-bold.png';
            this.childrenContainer.style.display = '';
            if (!this.childrenLoaded) {
                this.loadChildren();
            }
        } else {
            this.icon.src = '/static/images/folder-bold.png';
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
        // The path from the backend is now relative to the pictograms folder,
        // so we build the URL for the new pictogram-serving endpoint.
        imgElement.src = `/pictograms/${this.data.path}`;
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
            const theNode = new ImageTreeFolderNode(data, this);
            this.rootNodes.push(theNode);
            this.container.appendChild(theNode.element);
        });
    }

    filter(term) {
        const visibleNodes = new Set();
        this.rootNodes.forEach(theNode => theNode.filter(term.toLowerCase(), visibleNodes));
    }
}


// --- End of new Image Tree for Right Sidebar ---


class BuilderNode {
    constructor(image, builder) {
        this.image = image;
        this.builder = builder;
        this.children = [];
        this.parent = null;
        this.description = image.description || '';
        this.element = this.createElement(builder);
    }

    addChild(theNode) {
        theNode.parent = this;
        this.children.push(theNode);
    }

    createElement(builder) {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node');
        nodeElement.setAttribute('draggable', this.image.id !== 'root');

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        if (this.image.path) {
            if (this.image.path.startsWith('/')) {
                imgElement.src = this.image.path;
            } else {
                imgElement.src = `/pictograms/${this.image.path}`;
            }
        }
        imgElement.alt = this.image.name;

        imgElement.addEventListener('mouseover', (e) => tooltip.show(e, imgElement.src));
        imgElement.addEventListener('mouseout', (e) => tooltip.hide(e));

        contentElement.appendChild(imgElement);

        const nameElement = document.createElement('span');
        nameElement.textContent = this.image.name;
        contentElement.appendChild(nameElement);

        nodeElement.appendChild(contentElement);

        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('children');
        nodeElement.appendChild(childrenContainer);

        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation();
            builder.selectNode(this);
        });

        nodeElement.addEventListener('dragstart', (e) => builder.handleDragStart(e, this));
        nodeElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            builder.handleDragOver(e, this);
        });
        nodeElement.addEventListener('dragleave', (e) => builder.handleDragLeave(e, this));
        nodeElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            builder.handleDrop(e, this);
        });
        nodeElement.addEventListener('dragend', (e) => builder.handleDragEnd(e, this));

        return nodeElement;
    }
}

class TreeBuilder {
    constructor() {
        this.imageSearch = document.getElementById('image-search');
        this.treeDisplay = document.getElementById('tree-display');
        this.nodeDescriptionTextarea = document.getElementById('node-description');
        this.images = JSON.parse(document.getElementById('images-data').textContent);
        this.savedTrees = [];
        this.rootNode = new BuilderNode({ id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' }, this);
        this.selectedNode = null;
        this.draggedNode = null;

        if (this.nodeDescriptionTextarea) {
            this.nodeDescriptionTextarea.disabled = true;
            this.nodeDescriptionTextarea.addEventListener('input', () => {
                if (this.selectedNode) {
                    this.selectedNode.description = this.nodeDescriptionTextarea.value;
                }
            });
        }

        const initialTreeData = JSON.parse(document.getElementById('initial-tree-data').textContent);
        this.imageTree = new ImageTree('image-sidebar-tree', initialTreeData, (image) => this.handleImageClick(image));

        this.addEventListeners();
        this.loadSavedTrees();
        this.updateVisualizeButtonState();
        this.restoreStateFromSession();
    }

    addEventListeners() {
        document.addEventListener('click', (e) => {
            const isClickInsideTree = this.treeDisplay.contains(e.target);
            if (!isClickInsideTree && !e.target.closest('.sidebar')) {
                this.deselectAllNodes();
            }
        });

        document.getElementById('save-tree-btn')?.addEventListener('click', () => this.saveTree());
        document.getElementById('import-json-btn')?.addEventListener('click', () => this.importTreeFromJSON());
        document.getElementById('export-json-btn')?.addEventListener('click', () => this.exportTreeToJSON());
        document.getElementById('load-tree-btn')?.addEventListener('click', () => this.loadTree());
        document.getElementById('image-search')?.addEventListener('input', () => this.filterImages());
        document.getElementById('delete-btn')?.addEventListener('click', () => this.deleteSelectedNode());

        const newTreeBtn = document.getElementById('new-tree-btn');
        if (newTreeBtn) {
            newTreeBtn.addEventListener('click', () => {
                if (this.rootNode.children.length > 0 && confirm('You have an unsaved tree. Are you sure you want to leave?')) {
                    window.location.href = '/builder';
                } else if (this.rootNode.children.length === 0) {
                    window.location.href = '/builder';
                }
            });
        }

        document.getElementById('tree-search')?.addEventListener('input', () => this.filterTrees());

        // --- FINAL RELOAD STRATEGY ---
        const visualizeBtn = document.getElementById('visualize-tree-btn');
        const treeVisualizerModal = document.getElementById('tree-visualizer-modal');

        if (visualizeBtn && treeVisualizerModal) {
            visualizeBtn.addEventListener('click', () => {
                // The tree drawing is now handled by a separate script in the modal
                // Or rather, the modal will be populated by a script that runs on its own
                // For now, just showing the modal is enough before the reload logic.
                // But we need to pass the data.
                const treeData = this.getTreeAsJSON();
                sessionStorage.setItem('treeToVisualize', JSON.stringify(treeData));
                const modal = new bootstrap.Modal(treeVisualizerModal);
                modal.show();
            });

            treeVisualizerModal.addEventListener('hidden.bs.modal', () => {
                // When the modal is closed, save the main tree's state and reload the page.
                if (this.rootNode.children.length > 0) {
                    const treeData = this.getTreeAsJSON();
                    sessionStorage.setItem('treeBuilderState', JSON.stringify(treeData));
                }
                window.location.reload();
            });
        }
    }

    restoreStateFromSession() {
        const savedState = sessionStorage.getItem('treeBuilderState');
        if (savedState) {
            try {
                const treeData = JSON.parse(savedState);
                this.rebuildTreeFromJSON(treeData);
            } catch (e) {
                console.error("Failed to parse or restore tree state from session storage.", e);
            } finally {
                sessionStorage.removeItem('treeBuilderState');
            }
        }
    }

    updateVisualizeButtonState() {
        const visualizeBtn = document.getElementById('visualize-tree-btn');
        if (visualizeBtn) {
            visualizeBtn.disabled = this.rootNode.children.length === 0;
        }
    }

    handleImageClick(image) {
        const newNode = new BuilderNode(image, this);
        const parentNode = this.selectedNode || this.rootNode;
        parentNode.addChild(newNode);
        this.selectNode(newNode);
        this.renderTree();
    }

    isDescendant(potentialDescendant, potentialAncestor) {
        return potentialAncestor.children.some(child =>
            child === potentialDescendant || this.isDescendant(potentialDescendant, child)
        );
    }

    handleDragStart(e, theNode) {
        if (theNode.image.id === 'root') {
            e.preventDefault();
            return;
        }
        this.draggedNode = theNode;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', theNode.image.id);

        setTimeout(() => {
            if (theNode.element) {
                theNode.element.classList.add('dragging');
            }
        }, 0);
    }

    handleDragOver(e, targetNode) {
        if (targetNode !== this.draggedNode) {
            const targetContent = targetNode.element.querySelector('.node-content');
            if (targetContent) {
                targetContent.classList.add('drag-over');
            }
        }
    }

    handleDragLeave(e, targetNode) {
        const targetContent = targetNode.element.querySelector('.node-content');
        if (targetContent) {
            targetContent.classList.remove('drag-over');
        }
    }

    handleDrop(e, targetNode) {
        this.handleDragLeave(e, targetNode);

        const draggedNode = this.draggedNode;

        if (!draggedNode || targetNode === draggedNode || this.isDescendant(targetNode, draggedNode)) {
            if (this.isDescendant(targetNode, draggedNode)) {
                alert("You cannot move a node into one of its own children.");
            }
            return;
        }

        const oldParent = draggedNode.parent;
        if (oldParent) {
            oldParent.children = oldParent.children.filter(child => child !== draggedNode);
        }

        targetNode.addChild(draggedNode);
        this.renderTree();
    }

    handleDragEnd(e) {
        if (this.draggedNode && this.draggedNode.element) {
            this.draggedNode.element.classList.remove('dragging');
        }
        this.draggedNode = null;
        document.querySelectorAll('.node-content.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    selectNode(theNode) {
        this.deselectAllNodes();
        this.selectedNode = theNode;

        const applyHighlight = (n) => {
            if (n.element) {
                const content = n.element.querySelector('.node-content');
                if (content) {
                    content.classList.add('selected');
                }
            }
            n.children.forEach(applyHighlight);
        };

        if (this.selectedNode) {
            applyHighlight(this.selectedNode);
            if (this.selectedNode.element) {
                this.selectedNode.element.classList.add('is-selected');
            }
        }

        if (this.nodeDescriptionTextarea) {
            if (this.selectedNode) {
                this.nodeDescriptionTextarea.value = this.selectedNode.description || '';
                this.nodeDescriptionTextarea.disabled = false;
            } else {
                this.nodeDescriptionTextarea.value = '';
                this.nodeDescriptionTextarea.disabled = true;
            }
        }
    }

    deselectAllNodes() {
        this.treeDisplay.querySelectorAll('.node-content.selected').forEach(el => el.classList.remove('selected'));
        this.treeDisplay.querySelectorAll('.node.is-selected').forEach(el => el.classList.remove('is-selected'));
        this.selectedNode = null;
        if (this.nodeDescriptionTextarea) {
            this.nodeDescriptionTextarea.value = '';
            this.nodeDescriptionTextarea.disabled = true;
        }
    }

    deleteSelectedNode() {
        if (!this.selectedNode || this.selectedNode.image.id === 'root') {
            alert(this.selectedNode ? 'You cannot delete the root node.' : 'Please select a node to delete.');
            return;
        }

        if (confirm('Are you sure you want to delete the selected branch?')) {
            const parent = this.selectedNode.parent;
            if (parent) {
                parent.children = parent.children.filter(child => child !== this.selectedNode);
                this.selectedNode = null;
                this.renderTree();
            }
        }
    }

    renderTree() {
        this.treeDisplay.innerHTML = '';
        if (this.rootNode && this.rootNode.element) {
            this.treeDisplay.appendChild(this.rootNode.element);
            this.renderChildren(this.rootNode);
        }
        this.updateVisualizeButtonState();
    }

    renderChildren(theNode) {
        const childrenContainer = theNode.element.querySelector('.children');
        if (!childrenContainer) return;

        childrenContainer.innerHTML = '';

        theNode.children.forEach(child => {
            if (child.element) {
                childrenContainer.appendChild(child.element);
                this.renderChildren(child);
            }
        });
    }

    getTreeAsJSON() {
        const buildNode = (theNode) => {
            const nodeData = {
                id: theNode.image.id,
                description: theNode.description,
                children: []
            };
            theNode.children.forEach(child => {
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

        const existingTree = this.userTrees.find(tree => tree.name === treeName);
        let proceed = true;

        if (existingTree) {
            proceed = confirm("A tree with this name already exists. Do you want to overwrite it?");
        }

        if (!proceed) {
            return;
        }

        const response = await fetch('/api/tree/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: treeName,
                is_public: isPublic,
                json_data: jsonData,
            }),
        });

        const result = await response.json();
        if (result.status === 'success') {
            const message = existingTree ? 'Updated' : 'Created';
            alert(message);
            this.rootNode.children = [];
            this.rebuildTreeFromJSON(result.tree_data);
            this.loadSavedTrees();
        } else {
            alert(`Error saving tree: ${result.message}`);
        }
    }

    filterImages() {
        const searchTerm = this.imageSearch.value;
        this.imageTree.filter(searchTerm);
    }

    filterTrees() {
        const searchTerm = this.treeSearch.value.toLowerCase();
        document.querySelectorAll('.tree-select-list').forEach(select => {
            Array.from(select.options).forEach(option => {
                option.style.display = option.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
            });
        });
    }

    async loadSavedTrees() {
        const response = await fetch('/api/trees/load');
        const data = await response.json();
        this.publicTrees = data.public_trees || [];
        this.userTrees = data.user_trees || [];
        this.renderTreeList();
    }

    renderTreeList() {
        const treeList = document.getElementById('tree-list');
        if (!treeList) return;
        treeList.innerHTML = '';
        this.activeTreeSelect = null;

        const createSelectList = (trees, title, id) => {
            if (trees.length > 0) {
                const titleEl = document.createElement('h6');
                titleEl.textContent = title;
                treeList.appendChild(titleEl);

                const select = document.createElement('select');
                select.id = id;
                select.className = 'form-control mb-2 tree-select-list';
                trees.forEach(tree => {
                    const option = document.createElement('option');
                    option.value = tree.id;
                    option.textContent = (id === 'user-tree-select' || !tree.username) ? tree.name : `${tree.username} - ${tree.name}`;
                    select.appendChild(option);
                });

                select.addEventListener('focus', () => { this.activeTreeSelect = select; });
                treeList.appendChild(select);
            }
        };

        createSelectList(this.userTrees, 'My Private Trees', 'user-tree-select');
        createSelectList(this.publicTrees, 'Public Trees', 'public-tree-select');

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
            this.rebuildTreeFromJSON(JSON.parse(treeToLoad.json_data));
        } else {
            alert('Could not find the selected tree.');
        }
    }

    rebuildTreeFromJSON(treeData) {
        this.rootNode.children = [];
        this.selectedNode = this.rootNode;

        const buildNode = (nodeData) => {
            let image = this.images.find(img => img.id === nodeData.id);
            if (!image) {
                image = { id: nodeData.id, name: 'Image inaccessible', path: '/static/images/prohibit-bold.png', description: 'This image is private or has been deleted.' };
                console.warn(`Image with ID ${nodeData.id} is not accessible. Using a placeholder.`);
            }

            const newNode = new BuilderNode(image, this);
            if (nodeData.description) {
                newNode.description = nodeData.description;
            }

            if (nodeData.children) {
                nodeData.children.forEach(childData => {
                    const childNode = buildNode(childData);
                    if (childNode) newNode.addChild(childNode);
                });
            }
            return newNode;
        };

        if (treeData.roots) {
            treeData.roots.forEach(rootData => {
                const rootNode = buildNode(rootData);
                if (rootNode) this.rootNode.addChild(rootNode);
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
        document.body.appendChild(downloadAnchorNode);
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
                        this.rebuildTreeFromJSON(JSON.parse(event.target.result));
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
