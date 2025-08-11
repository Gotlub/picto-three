// --- Start of Image Tree for Right Sidebar (reused from builder.js) ---

class ImageTreeNode {
    constructor(data, imageTree) {
        this.data = data;
        this.imageTree = imageTree;
        this.element = this.createElement();
        this.children = [];
        this.parent = null;
        // Make the node draggable
        this.element.setAttribute('draggable', 'true');
        this.element.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            this.imageTree.listBuilder.handleSourceDragStart(e, {
                type: 'image-tree-node',
                data: this.data
            });
        });
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

        // Prevent dragging folders
        nodeElement.setAttribute('draggable', 'false');

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
        this.childrenContainer.innerHTML = '';
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
}

class ImageTree {
    constructor(containerId, initialData, onImageClick, listBuilder) {
        this.container = document.getElementById(containerId);
        this.initialData = initialData;
        this.onImageClick = onImageClick;
        this.listBuilder = listBuilder; // Pass the main controller
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
}

// --- End of Image Tree ---

// --- Start of Tree Viewer (Center Panel, adapted from builder.js) ---
class ReadOnlyNode {
    constructor(image, listBuilder) {
        this.image = image;
        this.listBuilder = listBuilder;
        this.children = [];
        this.parent = null;
        this.description = image.description || '';
        this.element = this.createElement();

        // Make the node draggable for copying
        this.element.setAttribute('draggable', 'true');
        this.element.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            this.listBuilder.handleSourceDragStart(e, {
                type: 'tree-node',
                data: { ...this.image,
                    description: this.description
                }
            });
        });
    }

    addChild(node) {
        node.parent = this;
        this.children.push(node);
    }

    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node');
        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');
        const imgElement = document.createElement('img');
        if (this.image.path) {
            imgElement.src = this.image.path.startsWith('/static') ? this.image.path : this.image.path.replace('app/', '');
        }
        imgElement.alt = this.image.name;
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
            this.listBuilder.selectTreeNode(this);
        });
        return nodeElement;
    }
}

// --- End of Tree Viewer ---

// --- Chained List Item (Bottom Panel) ---
class ChainedListItem {
    constructor(itemData, listBuilder) {
        this.data = itemData; // { image_id, name, path, description }
        this.listBuilder = listBuilder;
        this.element = this.createElement();
    }

    createElement() {
        const itemElement = document.createElement('div');
        itemElement.classList.add('chained-list-item');
        itemElement.dataset.imageId = this.data.image_id;
        itemElement.setAttribute('draggable', 'true');

        const img = document.createElement('img');
        img.src = this.data.path.replace('app/static', '/static');
        img.alt = this.data.name;
        itemElement.appendChild(img);

        const name = document.createElement('p');
        name.textContent = this.data.name;
        itemElement.appendChild(name);

        // Events for selection and reordering
        itemElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.listBuilder.selectChainedListItem(this);
        });

        itemElement.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            this.listBuilder.handleChainedListDragStart(e, this);
        });

        return itemElement;
    }
}


// --- Main Controller ---
class ListBuilder {
    constructor() {
        // General
        this.allImages = JSON.parse(document.getElementById('images-data').textContent);

        // Left Panel
        this.importBtn = document.getElementById('import-list-json-btn');
        this.exportBtn = document.getElementById('export-list-json-btn');
        this.saveBtn = document.getElementById('save-list-btn');
        this.listNameInput = document.getElementById('list-name');
        this.isPublicCheckbox = document.getElementById('list-is-public');
        this.listSearchInput = document.getElementById('list-search');
        this.listContainer = document.getElementById('list-container');
        this.loadListBtn = document.getElementById('load-list-btn');

        // Center Panel
        this.treeDisplay = document.getElementById('tree-display');
        this.nodeDescriptionDisplay = document.getElementById('node-description-display');
        this.treeRoot = new ReadOnlyNode({
            id: 'root',
            name: 'Root'
        }, this);
        this.selectedTreeNode = null;

        // Right Panel
        const initialTreeData = JSON.parse(document.getElementById('initial-tree-data').textContent);
        this.imageTree = new ImageTree('image-sidebar-tree', initialTreeData, (image) => this.selectImage(image), this);
        this.imageDescriptionDisplay = document.getElementById('image-description-display');
        this.selectedImage = null;

        // Bottom Panel
        this.chainedListContainer = document.getElementById('chained-list-container');
        this.deleteLinkBtn = document.getElementById('delete-link-btn');
        this.newChainBtn = document.getElementById('new-chain-btn');
        this.chainedListItems = [];
        this.selectedChainedItem = null;

        // State
        this.draggedSource = null; // What is being dragged from left/center
        this.draggedListItem = null; // What is being dragged within the list
        this.dropIndicator = this.createDropIndicator();

        this.initEventListeners();
        this.loadSavedLists();
        this.loadSavedTreesForViewer();
    }

    createDropIndicator() {
        const indicator = document.createElement('div');
        indicator.classList.add('drop-indicator');
        return indicator;
    }

    initEventListeners() {
        // Left Panel
        this.saveBtn?.addEventListener('click', () => this.saveList());
        this.loadListBtn?.addEventListener('click', () => this.loadSelectedList());
        this.importBtn?.addEventListener('click', () => this.importListFromJSON());
        this.exportBtn?.addEventListener('click', () => this.exportListToJSON());


        // Bottom Panel
        this.deleteLinkBtn.addEventListener('click', () => this.deleteSelectedLink());
        this.newChainBtn.addEventListener('click', () => this.clearChain());

        // Drag and drop for the container
        this.chainedListContainer.addEventListener('dragover', (e) => this.handleChainedListDragOver(e));
        this.chainedListContainer.addEventListener('dragleave', (e) => this.handleChainedListDragLeave(e));
        this.chainedListContainer.addEventListener('drop', (e) => this.handleChainedListDrop(e));
    }

    // --- Source Selection (Center and Right panels) ---
    selectTreeNode(node) {
        // Deselect others
        if (this.selectedTreeNode) this.selectedTreeNode.element.querySelector('.node-content').classList.remove('selected');
        this.selectedImage = null;
        const allImageNodes = document.querySelectorAll('#image-sidebar-tree .node-content.selected');
        allImageNodes.forEach(n => n.classList.remove('selected'));


        this.selectedTreeNode = node;
        node.element.querySelector('.node-content').classList.add('selected');
        this.nodeDescriptionDisplay.value = node.description;
    }

    selectImage(imageData) {
        // Deselect others
        if (this.selectedTreeNode) this.selectedTreeNode.element.querySelector('.node-content').classList.remove('selected');
        this.selectedTreeNode = null;
        const allImageNodes = document.querySelectorAll('#image-sidebar-tree .node-content.selected');
        allImageNodes.forEach(n => n.classList.remove('selected'));

        this.selectedImage = imageData;
        const imageNode = document.querySelector(`#image-sidebar-tree .image[data-id='${imageData.id}'] .node-content`);
        if (imageNode) imageNode.classList.add('selected');
        this.imageDescriptionDisplay.value = imageData.description || '';
    }

    // --- Drag from Source to List ---
    handleSourceDragStart(e, source) {
        this.draggedSource = source;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', source.data.id);
    }

    // --- Chained List (Bottom Panel) Logic ---
    selectChainedListItem(itemToSelect) {
        if (this.selectedChainedItem) {
            this.selectedChainedItem.element.classList.remove('selected');
        }
        this.selectedChainedItem = itemToSelect;
        this.selectedChainedItem.element.classList.add('selected');
    }

    addToList(sourceItem) {
        const newItemData = {
            image_id: sourceItem.data.id,
            name: sourceItem.data.name,
            path: sourceItem.data.path,
            description: sourceItem.data.description || ""
        };
        const newListItem = new ChainedListItem(newItemData, this);
        this.chainedListItems.push(newListItem);
        this.renderChainedList();
    }

    deleteSelectedLink() {
        if (!this.selectedChainedItem) {
            alert('Please select a link to delete.');
            return;
        }
        this.chainedListItems = this.chainedListItems.filter(item => item !== this.selectedChainedItem);
        this.selectedChainedItem = null;
        this.renderChainedList();
    }

    clearChain() {
        if (confirm('Are you sure you want to clear the entire chain?')) {
            this.chainedListItems = [];
            this.selectedChainedItem = null;
            this.renderChainedList();
        }
    }

    renderChainedList() {
        this.chainedListContainer.innerHTML = '';
        this.chainedListItems.forEach(item => {
            this.chainedListContainer.appendChild(item.element);
        });
    }

    // --- Reordering Logic for Chained List ---
    handleChainedListDragStart(e, item) {
        this.draggedListItem = item;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.element.classList.add('dragging'), 0);
    }

    handleChainedListDragOver(e) {
        e.preventDefault();
        const container = this.chainedListContainer;
        const afterElement = this.getDragAfterElement(container, e.clientX);
        if (this.draggedListItem) { // Reordering
            if (afterElement == null) {
                container.appendChild(this.dropIndicator);
            } else {
                container.insertBefore(this.dropIndicator, afterElement.element);
            }
        } else if (this.draggedSource) { // Dropping new item
             if (afterElement == null) {
                container.appendChild(this.dropIndicator);
            } else {
                container.insertBefore(this.dropIndicator, afterElement.element);
            }
        }
    }

    handleChainedListDragLeave(e) {
       if (e.target === this.chainedListContainer) {
            this.removeDropIndicator();
       }
    }

    removeDropIndicator() {
         if (this.dropIndicator.parentNode) {
            this.dropIndicator.parentNode.removeChild(this.dropIndicator);
        }
    }


    handleChainedListDrop(e) {
        e.preventDefault();
        this.removeDropIndicator();

        const afterElement = this.getDragAfterElement(this.chainedListContainer, e.clientX);
        const newIndex = afterElement ? this.chainedListItems.indexOf(afterElement) : this.chainedListItems.length;


        if (this.draggedListItem) { // Reordering existing item
            this.draggedListItem.element.classList.remove('dragging');
            const oldIndex = this.chainedListItems.indexOf(this.draggedListItem);
            this.chainedListItems.splice(oldIndex, 1);
            this.chainedListItems.splice(newIndex > oldIndex ? newIndex -1 : newIndex, 0, this.draggedListItem);
            this.draggedListItem = null;

        } else if (this.draggedSource) { // Adding new item from source
            const newItemData = {
                image_id: this.draggedSource.data.id,
                name: this.draggedSource.data.name,
                path: this.draggedSource.data.path,
                description: this.draggedSource.data.description || ""
            };
            const newListItem = new ChainedListItem(newItemData, this);
            this.chainedListItems.splice(newIndex, 0, newListItem);
            this.draggedSource = null;
        }

        this.renderChainedList();
    }


    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.chained-list-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return {
                    offset: offset,
                    element: child
                };
            } else {
                return closest;
            }
        }, {
            offset: Number.NEGATIVE_INFINITY
        }).element?.closest('.chained-list-item')
          ?.listBuilderItem; // How to get the class instance back?
          // Let's find it in the array instead.
          const afterEl =  [...container.querySelectorAll('.chained-list-item:not(.dragging)')].reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;

        if (!afterEl) return null;
        return this.chainedListItems.find(item => item.element === afterEl);
    }


    // --- API Calls ---
    async saveList() {
        const listName = this.listNameInput.value;
        if (!listName) {
            alert('Please enter a name for the list.');
            return;
        }
        if (this.chainedListItems.length === 0) {
            alert('Cannot save an empty list.');
            return;
        }

        const payload = this.chainedListItems.map(item => ({
            image_id: item.data.image_id,
            description: item.data.description
        }));
        const isPublic = this.isPublicCheckbox.checked;

        const response = await fetch('/api/lists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                list_name: listName,
                is_public: isPublic,
                payload: payload
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            alert('List saved successfully!');
            this.loadSavedLists(); // Refresh the list
        } else {
            alert(`Error: ${result.message}`);
        }
    }

    async loadSavedLists() {
        const response = await fetch('/api/lists');
        const data = await response.json();
        this.publicLists = data.public_lists || [];
        this.userLists = data.user_lists || [];
        this.renderLoadableLists();
    }

    renderLoadableLists() {
        this.listContainer.innerHTML = '';
        this.activeListSelect = null;

        const createSelectList = (lists, title) => {
            if (lists.length > 0) {
                const titleEl = document.createElement('h6');
                titleEl.textContent = title;
                this.listContainer.appendChild(titleEl);

                const select = document.createElement('select');
                select.className = 'form-control mb-2';
                select.setAttribute('size', '5');
                lists.forEach(list => {
                    const option = document.createElement('option');
                    option.value = list.id;
                    option.textContent = list.username ? `${list.username} - ${list.list_name}` : list.list_name;
                    option.dataset.listData = JSON.stringify(list);
                    select.appendChild(option);
                });
                this.listContainer.appendChild(select);
            }
        };

        createSelectList(this.userLists, 'My Private Lists');
        createSelectList(this.publicLists, 'Public Lists');
    }

    loadSelectedList() {
        const selectedOption = this.listContainer.querySelector('option:checked');
        if (!selectedOption) {
            alert('Please select a list to load.');
            return;
        }
        const listData = JSON.parse(selectedOption.dataset.listData);
        this.rebuildListFromData(listData);
    }

    rebuildListFromData(listData) {
        const payload = JSON.parse(listData.payload);
        this.chainedListItems = payload.map(itemData => {
            const imageInfo = this.allImages.find(img => img.id === itemData.image_id);
            if (!imageInfo) {
                // Handle missing image case
                return new ChainedListItem({
                    image_id: itemData.image_id,
                    name: "Deleted Image",
                    path: "/static/images/placeholder.png", // A placeholder image
                    description: itemData.description
                }, this);
            }
            return new ChainedListItem({
                ...imageInfo,
                image_id: imageInfo.id,
                description: itemData.description
            }, this);
        });
        this.renderChainedList();
    }

    exportListToJSON() {
        if (this.chainedListItems.length === 0) {
            alert('The list is empty.');
            return;
        }
        const payload = this.chainedListItems.map(item => ({
            image_id: item.data.image_id,
            description: item.data.description
        }));
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "list.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    importListFromJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const payload = JSON.parse(event.target.result);
                        this.rebuildListFromData({ payload: JSON.stringify(payload) });
                    } catch (error) {
                        alert('Error parsing JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }


    // --- Tree Viewer Loading (Center Panel) ---
    async loadSavedTreesForViewer() {
        const response = await fetch('/api/trees/load');
        const data = await response.json();
        const allTrees = (data.user_trees || []).concat(data.public_trees || []);
        if (allTrees.length > 0) {
            // For simplicity, just load the first available tree.
            // A dropdown could be added here to select which tree to view.
            const treeData = JSON.parse(allTrees[0].json_data);
            this.rebuildTreeViewer(treeData);
        }
    }

    rebuildTreeViewer(treeData) {
        this.treeRoot.children = []; // Clear existing
        const buildNode = (nodeData) => {
            const image = this.allImages.find(img => img.id === nodeData.id);
            if (!image) return null;
            const newNode = new ReadOnlyNode({ ...image, description: nodeData.description }, this);
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
                if (rootNode) this.treeRoot.addChild(rootNode);
            });
        }
        this.renderTreeViewer();
    }

    renderTreeViewer() {
        this.treeDisplay.innerHTML = '';
        this.treeDisplay.appendChild(this.treeRoot.element);
        this.renderTreeChildren(this.treeRoot);
    }

    renderTreeChildren(node) {
        const childrenContainer = node.element.querySelector('.children');
        if (!childrenContainer) return;
        childrenContainer.innerHTML = '';
        node.children.forEach(child => {
            childrenContainer.appendChild(child.element);
            this.renderTreeChildren(child);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ListBuilder();
});
