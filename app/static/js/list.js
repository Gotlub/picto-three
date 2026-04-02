import ImageTree from './components/ImageTree.js';
import ArasaacSearch from './components/ArasaacSearch.js';

// --- Start of Tree Viewer (Center Panel, adapted from builder.js) ---
class ReadOnlyNode {
    constructor(nodeData, image, listBuilder) {
        this.nodeData = nodeData;
        this.image = image;
        this.listBuilder = listBuilder;
        this.children = [];
        this.parent = null;
        this.description = nodeData.description || image.description || '';
        this.element = this.createElement();

        // Make the node draggable for copying
        this.element.setAttribute('draggable', 'true');
        this.element.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            // 1. Fonction récursive pour collecter les données de la branche (inchangée)
            const collectBranchData = (node) => {
                const nodeData = { ...node.image, description: node.description };
                let branch = [nodeData];
                if (node.children && node.children.length > 0) {
                    node.children.forEach(child => {
                        branch = branch.concat(collectBranchData(child));
                    });
                }
                return branch;
            };

            // 2. Collecte des données
            let branchData;
            if (this.listBuilder.selectionMode === 'branch') {
                // Comportement actuel : copier toute la branche
                branchData = collectBranchData(this);
            } else {
                // Nouveau comportement : copier uniquement le nœud sélectionné
                const nodeData = { ...this.image, description: this.description };
                branchData = [nodeData];
            }

            // 3. Préparation de la charge utile (payload)
            const payload = {
                type: 'tree-branch', // Nouveau type pour identifier une branche complète
                data: branchData
            };

            // 4. Appel de la fonction de ListBuilder pour démarrer le drag
            this.listBuilder.handleSourceDragStart(e, payload);
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
            // Path can be a new relative path or an old absolute one during transition
            // or an external URL from Arasaac
            if (this.image.path.startsWith('http')) {
                imgElement.src = this.image.path;
            } else if (this.image.path.startsWith('/')) {
                imgElement.src = this.image.path; // It's already a full URL
            } else {
                imgElement.src = `/pictograms/${this.image.path}`; // It's a relative path
            }
        }
        imgElement.alt = this.image.name;
        contentElement.appendChild(imgElement);
        const nameElement = document.createElement('span');
        nameElement.textContent = this.nodeData.description || this.image.name;
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
        // The path from the backend is now relative, so we build the URL for the new endpoint.
        // Unless it is an external URL (Arasaac)
        if (this.data.path.startsWith('http')) {
            img.src = this.data.path;
        } else {
            // Backward compatibility or local relative paths
            // Adjust if path already starts with / or not
            if (this.data.path.startsWith('/')) {
                img.src = this.data.path;
            } else {
                img.src = `/pictograms/${this.data.path}`;
            }
        }
        img.alt = this.data.name;
        itemElement.appendChild(img);

        const description = document.createElement('p');
        description.textContent = this.data.description || '';
        itemElement.appendChild(description);

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
        // Left Panel - List Section
        this.importBtn = document.getElementById('import-list-json-btn');
        this.exportBtn = document.getElementById('export-list-json-btn');
        this.saveBtn = document.getElementById('save-list-btn');
        this.listNameInput = document.getElementById('list-name');
        this.isPublicCheckbox = document.getElementById('list-is-public');
        this.listSearchInput = document.getElementById('list-search');
        this.listContainer = document.getElementById('list-container');
        this.loadListBtn = document.getElementById('load-list-btn');

        // Left Panel - Tree Section
        this.importTreeBtn = document.getElementById('import-tree-json-btn');
        this.treeContainer = document.getElementById('tree-container');
        this.loadTreeBtn = document.getElementById('load-tree-btn');
        this.treeSearchInput = document.getElementById('tree-search');

        // Right Panel - Image Search
        this.imageSearchInput = document.getElementById('image-search');


        // Center Panel
        this.selectionModeRadios = document.querySelectorAll('input[name="selectionMode"]');
        this.selectionMode = 'branch'; // 'branch' est la valeur par défaut car cochée en HTML
        this.treeDisplay = document.getElementById('tree-display');
        const rootData = {
            id: 'root',
            name: 'Root',
            path: '/static/images/folder-open-bold.png',
        };
        this.treeRoot = new ReadOnlyNode(rootData, rootData, this);
        this.selectedTreeNode = null;

        // Right Panel
        this.imageTree = new ImageTree('image-sidebar-tree');
        this.selectedLinkDescription = document.getElementById('selected-link-description');

        // Initialize Arasaac Search
        this.arasaacSearch = new ArasaacSearch('arasaac-search-container', (e, payload) => {
            this.handleSourceDragStart(e, payload);
        });

        // Bottom Panel
        this.chainedListContainer = document.getElementById('chained-list-container');
        this.scrollListLeftBtn = document.getElementById('scroll-list-left');
        this.scrollListRightBtn = document.getElementById('scroll-list-right');
        this.deleteLinkBtn = document.getElementById('delete-link-btn');
        this.newChainBtn = document.getElementById('new-chain-btn');
        this.chainedListItems = [];
        this.selectedChainedItem = null;

        // State
        this.draggedSource = null; // What is being dragged from left/center
        this.draggedListItem = null; // What is being dragged within the list
        this.dropIndicator = this.createDropIndicator();

        // PDF Export elements
        this.exportPdfBtn = document.getElementById('export-pdf-btn');
        this.pdfImageSizeSlider = document.getElementById('pdf-image-size');
        this.pdfImageSizeValue = document.getElementById('pdf-image-size-value');
        
        // Quick Themes
        this.themePecsBtn = document.getElementById('theme-pecs');
        this.themeStripBtn = document.getElementById('theme-strip');
        this.themeFlashcardBtn = document.getElementById('theme-flashcard');

        this.initEventListeners();
        this.loadSavedLists();
        this.loadSavedTrees();
    }

    initSelectionModeListener() {
        this.selectionModeRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                this.selectionMode = event.target.value;
                console.log('Selection mode changed to:', this.selectionMode); // Pour le débogage
            });
        });
    }

    createDropIndicator() {
        const indicator = document.createElement('div');
        indicator.classList.add('drop-indicator');
        return indicator;
    }

    initEventListeners() {
        this.initSelectionModeListener();

        // PDF Export
        this.exportPdfBtn?.addEventListener('click', () => this.exportToPdf());
        this.pdfImageSizeSlider?.addEventListener('input', () => {
            if (this.pdfImageSizeValue) {
                this.pdfImageSizeValue.textContent = this.pdfImageSizeSlider.value;
            }
        });

        // Quick Themes
        this.themePecsBtn?.addEventListener('click', () => this.applyPdfTheme('pecs'));
        this.themeStripBtn?.addEventListener('click', () => this.applyPdfTheme('strip'));
        this.themeFlashcardBtn?.addEventListener('click', () => this.applyPdfTheme('flashcard'));

        // Left Panel - List
        this.saveBtn?.addEventListener('click', () => this.saveList());
        this.loadListBtn?.addEventListener('click', () => this.loadSelectedList());
        this.importBtn?.addEventListener('click', () => this.importListFromJSON());
        this.exportBtn?.addEventListener('click', () => this.exportListToJSON());

        // Left Panel - Tree
        this.importTreeBtn?.addEventListener('click', () => this.importTreeFromJSON());
        this.loadTreeBtn?.addEventListener('click', () => this.loadSelectedTree());
        this.treeSearchInput?.addEventListener('input', () => this.filterTrees());

        // Right Panel - Image Search
        this.imageSearchInput?.addEventListener('input', () => this.filterImages());

        // Right Panel - Description Editor
        this.selectedLinkDescription?.addEventListener('input', () => this.updateSelectedLinkDescription());

        // Bottom Panel
        this.deleteLinkBtn.addEventListener('click', () => this.deleteSelectedLink());
        this.newChainBtn.addEventListener('click', () => this.clearChain());

        // Drag and drop for the container
        this.chainedListContainer.addEventListener('dragover', (e) => this.handleChainedListDragOver(e));
        this.chainedListContainer.addEventListener('dragleave', (e) => this.handleChainedListDragLeave(e));
        this.chainedListContainer.addEventListener('drop', (e) => this.handleChainedListDrop(e));

        //Center Panel - unlight the branch
        // Bottom Panel Scroll Buttons
        this.scrollListLeftBtn?.addEventListener('click', () => {
            this.chainedListContainer.scrollBy({ left: -300, behavior: 'smooth' });
        });

        this.scrollListRightBtn?.addEventListener('click', () => {
            this.chainedListContainer.scrollBy({ left: 300, behavior: 'smooth' });
        });

        // Add scroll event listener to update button visibility dynamically
        this.chainedListContainer?.addEventListener('scroll', () => this.updateScrollButtonsVisibility());
        window.addEventListener('resize', () => this.updateScrollButtonsVisibility());

        // Add class to body during drag to disable scroll arrow pointer events
        document.addEventListener('dragstart', () => document.body.classList.add('is-dragging-list-item'));
        document.addEventListener('dragend', () => document.body.classList.remove('is-dragging-list-item'));

        document.addEventListener('click', (e) => {
            const isClickInsideTree = this.treeDisplay.contains(e.target);
            if (isClickInsideTree) {
                return;
            }

            // Otherwise, deselect any selected node.
            this.deselectAllNodes();
        });
    }

    selectTreeNode(theNode) {
        this.deselectAllNodes();
        this.selectedNode = theNode;

        const applyHighlight = (n) => {
            if (n.element) {
                const content = n.element.querySelector('.node-content');
                if (content) {
                    content.classList.add('selected');
                }
            }
            if (this.selectionMode === 'branch') {
                n.children.forEach(applyHighlight);
            }
        };

        if (this.selectedNode) {
            applyHighlight(this.selectedNode);
            if (this.selectedNode.element) {
                this.selectedNode.element.classList.add('is-selected');
            }
        }
    }

    deselectAllNodes() {
        this.selectedTreeNode = null;
        const selectedElements = this.treeDisplay.querySelectorAll('.node-content.selected');
        selectedElements.forEach(el => {
            el.classList.remove('selected');
        });
        const selectedNodes = this.treeDisplay.querySelectorAll('.node.is-selected');
        selectedNodes.forEach(el => {
            el.classList.remove('is-selected');
        });
        this.selectedNode = null;
        const allImageNodes = document.querySelectorAll('#image-sidebar-tree .node-content.selected');
        allImageNodes.forEach(n => n.classList.remove('selected'));
    }

    // --- Source Selection (Center and Right panels) ---
    /*
    selectTreeNode(node) {
        // Deselect others
        if (this.selectedTreeNode) this.selectedTreeNode.element.querySelector('.node-content').classList.remove('selected');
        this.selectedImage = null;
        const allImageNodes = document.querySelectorAll('#image-sidebar-tree .node-content.selected');
        allImageNodes.forEach(n => n.classList.remove('selected'));

        
        this.selectedTreeNode = node;
        node.element.querySelector('.node-content').classList.add('selected');
        // No description box for tree nodes anymore
    }*/

    // --- Drag from Source to List ---
    handleSourceDragStart(e, source) {
        this.draggedSource = source;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify(source));
        const fallbackId = Array.isArray(source.data) ? source.data[0].id : source.data.id;
        e.dataTransfer.setData('text/plain', fallbackId);
    }

    // --- Chained List (Bottom Panel) Logic ---
    selectChainedListItem(itemToSelect) {
        if (this.selectedChainedItem) {
            this.selectedChainedItem.element.classList.remove('selected');
        }
        this.selectedChainedItem = itemToSelect;
        this.selectedChainedItem.element.classList.add('selected');

        // Update and enable the description box
        this.selectedLinkDescription.value = this.selectedChainedItem.data.description || '';
        this.selectedLinkDescription.disabled = false;
    }

    updateSelectedLinkDescription() {
        if (this.selectedChainedItem) {
            this.selectedChainedItem.data.description = this.selectedLinkDescription.value;
            // Update the p element in real-time
            const descriptionElement = this.selectedChainedItem.element.querySelector('p');
            if (descriptionElement) {
                descriptionElement.textContent = this.selectedLinkDescription.value;
            }
        }
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
        this.selectedLinkDescription.value = '';
        this.selectedLinkDescription.disabled = true;
        this.renderChainedList();
    }

    clearChain() {
        if (confirm('Are you sure you want to clear the entire chain?')) {
            this.chainedListItems = [];
            this.selectedChainedItem = null;
            this.selectedLinkDescription.value = '';
            this.selectedLinkDescription.disabled = true;
            this.renderChainedList();
        }
    }

    renderChainedList() {
        this.chainedListContainer.innerHTML = '';
        this.chainedListItems.forEach(item => {
            this.chainedListContainer.appendChild(item.element);
        });
        // Delay overflow check to allow DOM to update
        setTimeout(() => this.updateScrollButtonsVisibility(), 50);
    }

    updateScrollButtonsVisibility() {
        if (!this.chainedListContainer || !this.scrollListLeftBtn || !this.scrollListRightBtn) return;

        const container = this.chainedListContainer;

        // Check if list is scrollable
        const isScrollable = container.scrollWidth > container.clientWidth;

        if (isScrollable) {
            // Show/hide left button
            if (container.scrollLeft > 0) {
                this.scrollListLeftBtn.classList.remove('d-none');
            } else {
                this.scrollListLeftBtn.classList.add('d-none');
            }

            // Show/hide right button
            if (Math.ceil(container.scrollLeft + container.clientWidth) >= container.scrollWidth) {
                this.scrollListRightBtn.classList.add('d-none');
            } else {
                this.scrollListRightBtn.classList.remove('d-none');
            }
        } else {
            // Not scrollable, hide both
            this.scrollListLeftBtn.classList.add('d-none');
            this.scrollListRightBtn.classList.add('d-none');
        }
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

        // --- Auto-scroll horizontal logic ---
        const rect = container.getBoundingClientRect();
        const threshold = 50; // pixels from the edge to trigger scroll
        const scrollSpeed = 15;

        if (e.clientX - rect.left < threshold) {
            container.scrollLeft -= scrollSpeed;
        } else if (rect.right - e.clientX < threshold) {
            container.scrollLeft += scrollSpeed;
        }
        // ------------------------------------

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

        if (this.draggedListItem) { // Reordering an existing item
            this.draggedListItem.element.classList.remove('dragging');
            const oldIndex = this.chainedListItems.indexOf(this.draggedListItem);

            this.chainedListItems.splice(oldIndex, 1);

            const newIndexForReorder = afterElement ? this.chainedListItems.indexOf(afterElement) : this.chainedListItems.length;
            this.chainedListItems.splice(newIndexForReorder, 0, this.draggedListItem);

            this.draggedListItem = null;
        } else { // Ajout d'un ou plusieurs nouveaux items
            const dragDataString = e.dataTransfer.getData('application/json');
            let dragData = null;

            if (dragDataString) {
                try {
                    dragData = JSON.parse(dragDataString);
                } catch (err) {
                    console.error("Could not parse drag data: ", err);
                }
            }

            // Si on a bien des données au format JSON
            if (dragData) {
                // CAS 1 : C'est une branche complète
                if (dragData.type === 'tree-branch' && Array.isArray(dragData.data)) {
                    dragData.data.forEach(itemData => {
                        const newItemData = {
                            image_id: itemData.id,
                            name: itemData.name,
                            path: itemData.path,
                            description: itemData.description || ""
                        };
                        if (newItemData.name !== "Root") {
                            const newListItem = new ChainedListItem(newItemData, this);
                            // On insère l'item et on incrémente l'index pour le suivant
                            this.chainedListItems.splice(newIndex + 1, 0, newListItem);
                        }
                    });
                }
                // CAS 2 : C'est un nœud simple (comportement original) ou une image Arasaac
                else if (dragData.type === 'image-tree-node' || dragData.type === 'tree-node') {
                    const sourceData = dragData.data;
                    const newItemData = {
                        image_id: sourceData.id,
                        name: sourceData.name,
                        path: sourceData.path,
                        description: sourceData.description || ""
                    };
                    const newListItem = new ChainedListItem(newItemData, this);
                    this.chainedListItems.splice(newIndex, 0, newListItem);
                }
                else if (dragData.type === 'arasaac-image') {
                    const sourceData = dragData.data;
                    const newItemData = {
                        image_id: sourceData.id, // ID Arasaac
                        name: sourceData.name,
                        path: sourceData.path, // Full URL
                        description: sourceData.description || ""
                    };
                    const newListItem = new ChainedListItem(newItemData, this);
                    this.chainedListItems.splice(newIndex, 0, newListItem);
                }
            }
            this.draggedSource = null;
        }
        this.renderChainedList();
    }


    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.chained-list-item:not(.dragging)')];

        const afterElementDOM = draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // offset is the distance from the cursor to the center of the element.
            // A negative offset means the cursor is to the left of the center.
            const offset = x - box.left - box.width / 2;

            // We are looking for the element with the smallest negative offset,
            // which means it's the first element to the right of the cursor.
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;

        if (afterElementDOM) {
            // We have the DOM element, now find the corresponding ChainedListItem class instance
            return this.chainedListItems.find(item => item.element === afterElementDOM);
        } else {
            return null; // Dropping at the end of the list
        }
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

        const existingList = this.userLists.find(list => list.list_name === listName);
        let proceed = true;

        if (existingList) {
            proceed = confirm("A list with this name already exists. Do you want to overwrite it?");
        }

        if (!proceed) {
            return; // Stop if the user cancels
        }

        const payload = this.chainedListItems.map(item => {
            let imageId = item.data.image_id;
            let imageUrl = item.data.path;
            let imageName = item.data.name;

            if (imageUrl && imageUrl.startsWith('http')) {
                imageId = -1;
            }

            return {
                image_id: imageId,
                url: imageUrl,
                name: imageName,
                description: item.data.description
            };
        });
        const isPublic = this.isPublicCheckbox.checked;

        const csrfTokenNode = document.querySelector('input[name="csrf_token"]');
        if (!csrfTokenNode) {
            alert('Erreur de sécurité : token CSRF manquant. Rechargez la page.');
            return;
        }
        const csrfToken = csrfTokenNode.value;

        try {
            const response = await fetch('/api/lists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    list_name: listName,
                    is_public: isPublic,
                    payload: payload
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur serveur: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                const message = existingList ? 'Updated' : 'Created';
                alert(message);
                this.loadSavedLists(); // Refresh the list
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (e) {
            console.error('Erreur sauvegarde:', e);
            alert('La sauvegarde a échoué. Vérifiez votre connexion et réessayez.');
        }
    }

    async loadSavedLists() {
        try {
            const response = await fetch('/api/lists');
            if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
            const data = await response.json();
            this.publicLists = Array.isArray(data.public_lists) ? data.public_lists : [];
            this.userLists = Array.isArray(data.user_lists) ? data.user_lists : [];
        } catch (e) {
            console.error('Impossible de charger les listes:', e);
            alert('Impossible de charger les listes sauvegardées.');
            this.publicLists = [];
            this.userLists = [];
        }
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
        let selectedOption = null;
        const selectLists = this.listContainer.querySelectorAll('select');
        for (const select of selectLists) {
            if (select.selectedIndex > -1) {
                selectedOption = select.options[select.selectedIndex];
                break;
            }
        }

        if (!selectedOption) {
            alert('Please select a list to load.');
            return;
        }
        try {
            const listData = JSON.parse(selectedOption.dataset.listData);
            this.rebuildListFromData(listData);
        } catch (e) {
            console.error('Erreur de lecture de la liste:', e);
            alert('Données de liste corrompues.');
        }
    }

    rebuildListFromData(listData) {
        this.chainedListItems = []; // Clear existing list
        const payload = JSON.parse(listData.payload);

        this.chainedListItems = payload.map(itemData => {
            let imageInfo;

            if (itemData.url) {
                // Unified format or Arasaac
                imageInfo = {
                    id: itemData.image_id, // Could be -1 or specific ID
                    name: itemData.name || 'Unknown',
                    path: itemData.url,
                };
            } else {
                // Legacy format (fallback to ID lookup)
                imageInfo = null;
            }

            if (!imageInfo) {
                console.warn(`Image with ID ${itemData.image_id} is not accessible. Using a placeholder.`);
                imageInfo = {
                    id: itemData.image_id,
                    name: 'Image inaccessible',
                    path: '/static/images/prohibit-bold.png',
                };
            }

            // Combine found/placeholder info with description from payload
            const finalData = {
                ...imageInfo,
                image_id: imageInfo.id,
                description: itemData.description
            };
            return new ChainedListItem(finalData, this);
        });

        this.renderChainedList();
    }

    exportListToJSON() {
        if (this.chainedListItems.length === 0) {
            alert('The list is empty.');
            return;
        }

        let filename = prompt("Enter a filename for your JSON export:", "list.json");
        if (!filename) {
            return; // User cancelled
        }
        if (!filename.endsWith('.json')) {
            filename += '.json';
        }

        const payload = this.chainedListItems.map(item => {
            let imageId = item.data.image_id;
            let imageUrl = item.data.path;
            let imageName = item.data.name;

            if (imageUrl && imageUrl.startsWith('http')) {
                imageId = -1;
            }

            return {
                image_id: imageId,
                url: imageUrl,
                name: imageName,
                description: item.data.description
            };
        });
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
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
                        if (!Array.isArray(payload)) {
                            alert('Format de fichier invalide (doit être un tableau).');
                            return;
                        }
                        this.rebuildListFromData({ payload: JSON.stringify(payload) });
                    } catch {
                        alert('Error parsing JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }


    // --- Tree Viewer Loading (Center Panel) ---
    async loadSavedTrees() {
        try {
            const response = await fetch('/api/trees/load');
            if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
            const data = await response.json();
            this.publicTrees = Array.isArray(data.public_trees) ? data.public_trees : [];
            this.userTrees = Array.isArray(data.user_trees) ? data.user_trees : [];
        } catch (e) {
            console.error('Impossible de charger les arbres:', e);
            alert('Impossible de charger les arbres sauvegardés.');
            this.publicTrees = [];
            this.userTrees = [];
        }
        this.renderLoadableTrees();
    }

    renderLoadableTrees() {
        this.treeContainer.innerHTML = '';
        this.activeTreeSelect = null;

        const selectLists = []; // Array to hold the select elements

        const createSelectList = (trees, title) => {
            if (trees.length > 0) {
                const titleEl = document.createElement('h6');
                titleEl.textContent = title;
                this.treeContainer.appendChild(titleEl);

                const select = document.createElement('select');
                select.className = 'form-control mb-2 tree-select-list';
                select.setAttribute('size', '5');
                trees.forEach(tree => {
                    const option = document.createElement('option');
                    option.value = tree.id;
                    option.textContent = tree.username ? `${tree.username} - ${tree.name}` : tree.name;
                    option.dataset.treeData = tree.json_data;
                    select.appendChild(option);
                });
                this.treeContainer.appendChild(select);
                selectLists.push(select); // Add the created select to our array
            }
        };

        createSelectList(this.userTrees, 'My Private Trees');
        createSelectList(this.publicTrees, 'Public Trees');

        // Add event listeners to each select list for mutual exclusion
        selectLists.forEach(currentSelect => {
            currentSelect.addEventListener('click', () => {
                // When a select is clicked, deselect items in all other lists
                selectLists.forEach(otherSelect => {
                    if (otherSelect !== currentSelect) {
                        otherSelect.selectedIndex = -1;
                    }
                });
            });
        });
    }

    filterTrees() {
        const searchTerm = this.treeSearchInput.value.toLowerCase();
        const treeLists = this.treeContainer.querySelectorAll('.tree-select-list');

        treeLists.forEach(select => {
            Array.from(select.options).forEach(option => {
                const optionText = option.textContent.toLowerCase();
                option.style.display = optionText.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    filterImages() {
        const searchTerm = this.imageSearchInput.value;
        this.imageTree.filter(searchTerm);
    }

    loadSelectedTree() {
        let selectedOption = null;
        const selectLists = this.treeContainer.querySelectorAll('select.tree-select-list');
        for (const select of selectLists) {
            if (select.selectedIndex > -1) {
                selectedOption = select.options[select.selectedIndex];
                break;
            }
        }

        if (!selectedOption) {
            alert('Please select a tree to load.');
            return;
        }
        try {
            const treeData = JSON.parse(selectedOption.dataset.treeData);
            this.rebuildTreeViewer(treeData);
        } catch (e) {
            console.error('Erreur de chargement de l\'arbre:', e);
            alert("Données corrompues.");
        }
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
                        this.rebuildTreeViewer(treeData);
                    } catch {
                        alert('Error parsing JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    rebuildTreeViewer(treeData) {
        // Find the root if it exists in the new array structure
        const buildNode = (nodeData) => {
            let image;

            // Handle Arasaac / External Images / Unified Format
            if (nodeData.url) {
                image = {
                    id: nodeData.id !== undefined ? nodeData.id : nodeData.real_id,
                    real_id: nodeData.real_id,
                    name: nodeData.name || 'External Image',
                    path: nodeData.url,
                    description: nodeData.description || nodeData.name
                };
            } else {
                image = null;
            }
            
            if (!image) {
                console.warn(`Image with ID ${nodeData.id} is not accessible. Using a placeholder.`);
                image = {
                    id: nodeData.id !== undefined ? nodeData.id : -1,
                    name: 'Image inaccessible',
                    path: '/static/images/prohibit-bold.png',
                    description: 'This image is private or has been deleted.'
                };
            }

            const newNode = new ReadOnlyNode(nodeData, image, this);

            if (nodeData.children) {
                nodeData.children.forEach(childData => {
                    const childNode = buildNode(childData);
                    if (childNode) newNode.addChild(childNode);
                });
            }
            return newNode;
        };

        if (treeData.roots && treeData.roots.length === 1) {
            const rootData = treeData.roots[0];
            const rootImage = {
                id: 'root',
                real_id: rootData.id !== undefined ? rootData.id : rootData.real_id,
                name: rootData.name || 'Root',
                path: rootData.url || '/static/images/folder-open-bold.png',
                description: rootData.description || rootData.name
            };
            this.treeRoot = new ReadOnlyNode(rootData, rootImage, this);

            if (rootData.children) {
                rootData.children.forEach(childData => {
                    const childNode = buildNode(childData);
                    if (childNode) this.treeRoot.addChild(childNode);
                });
            }
        } else if (treeData.roots && treeData.roots.length > 1) {
            const rootDisplayData = { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png', description: 'Root' };
            this.treeRoot = new ReadOnlyNode(rootDisplayData, rootDisplayData, this);

            treeData.roots.forEach(rootData => {
                const rootNode = buildNode(rootData);
                if (rootNode) this.treeRoot.addChild(rootNode);
            });
        } else {
            const rootDisplayData = { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png', description: 'Root' };
            this.treeRoot = new ReadOnlyNode(rootDisplayData, rootDisplayData, this);
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

    applyPdfTheme(themeName) {
        const setLayout = (mode, orient, size, padX, padY) => {
            document.getElementById('pdf-layout-mode').value = mode;
            document.querySelector(`input[name="pdf-orientation"][value="${orient}"]`).checked = true;
            document.getElementById('pdf-image-size').value = size;
            document.getElementById('pdf-image-size-value').textContent = size;
            document.getElementById('pdf-padding-x').value = padX;
            document.getElementById('pdf-padding-y').value = padY;
        };
        const setStyle = (bColor, bWidth, bRadius, bg, shadow) => {
            document.getElementById('pdf-border-color').value = bColor;
            document.getElementById('pdf-border-width').value = bWidth;
            document.getElementById('pdf-border-radius').value = bRadius;
            document.getElementById('pdf-bg-color').value = bg;
            document.getElementById('pdf-show-shadow').checked = shadow;
        };
        const setText = (show, pos, align, font, size, color) => {
            document.getElementById('pdf-show-text').checked = show;
            document.getElementById('pdf-text-position').value = pos;
            document.getElementById('pdf-font-family').value = font;
            document.getElementById('pdf-font-size').value = size;
            document.getElementById('pdf-text-color').value = color;
        };

        if (themeName === 'pecs') {
            setLayout('grid', 'portrait', 120, 2, 2);
            setStyle('#cccccc', 1, 0, '#ffffff', false);
            setText(true, 'bottom', 'center', 'Helvetica', 10, '#000000');
        } else if (themeName === 'strip') {
            setLayout('strip', 'landscape', 150, 15, 10);
            setStyle('#000000', 2, 10, '#ffffff', false);
            setText(true, 'bottom', 'center', 'Helvetica', 12, '#000000');
        } else if (themeName === 'flashcard') {
            setLayout('grid', 'portrait', 400, 20, 20);
            setStyle('#000000', 1, 15, '#f8f9fa', true);
            setText(true, 'bottom', 'center', 'Helvetica', 24, '#000000');
        }
    }

    async exportToPdf() {
        if (this.chainedListItems.length === 0) {
            alert('The list is empty. Add images to the list before exporting.');
            return;
        }

        const originalBtnText = this.exportPdfBtn.innerHTML;
        this.exportPdfBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
        this.exportPdfBtn.disabled = true;

        try {
            const { jsPDF } = window.jspdf;
            
            // Extract options
            const layoutMode = document.getElementById('pdf-layout-mode').value;
            const orientation = document.querySelector('input[name="pdf-orientation"]:checked').value;
            const imageSize = parseInt(document.getElementById('pdf-image-size').value, 10);
            const paddingX = parseInt(document.getElementById('pdf-padding-x').value, 10);
            const paddingY = parseInt(document.getElementById('pdf-padding-y').value, 10);
            
            const borderColor = document.getElementById('pdf-border-color').value;
            const borderWidth = parseInt(document.getElementById('pdf-border-width').value, 10);
            const borderRadius = parseInt(document.getElementById('pdf-border-radius').value, 10);
            const bgColor = document.getElementById('pdf-bg-color').value;
            const showShadow = document.getElementById('pdf-show-shadow').checked;

            const showText = document.getElementById('pdf-show-text').checked;
            const textPosition = document.getElementById('pdf-text-position').value;
            const fontFamily = document.getElementById('pdf-font-family').value;
            const fontSize = parseInt(document.getElementById('pdf-font-size').value, 10);
            const textColor = document.getElementById('pdf-text-color').value;

            // Initialize document
            const doc = new jsPDF({
                orientation: orientation,
                unit: 'pt',
                format: 'a4'
            });

            const margin = 50;
            const itemSpacing = 10;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const textAllowance = showText ? (fontSize + 5) : 0;
            const boxWidth = imageSize + (paddingX * 2);
            const boxHeight = imageSize + (paddingY * 2) + textAllowance;

            let cursorX = margin;
            let cursorY = margin; // Note: jsPDF runs top-down unlike reportlab

            // Helper to elegantly load images respecting CORS and relative path resolution
            const loadImage = (src) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                    
                    let fullSrc = src;
                    if (!src.startsWith('http') && !src.startsWith('/')) {
                        fullSrc = '/pictograms/' + src;
                    }
                    img.src = fullSrc;
                });
            };

            for (const item of this.chainedListItems) {
                const imgElement = await loadImage(item.data.path);
                if (!imgElement) continue;

                // Pagination & Row wrapping
                if (layoutMode === 'chain') {
                    if (cursorY + boxHeight > pageHeight - margin) {
                        doc.addPage();
                        cursorY = margin;
                    }
                    cursorX = (pageWidth - boxWidth) / 2; // Fixed centering
                } else if (layoutMode === 'strip') {
                    if (item === this.chainedListItems[0]) cursorY = (pageHeight - boxHeight) / 2;
                    if (cursorX + boxWidth > pageWidth - margin) {
                        doc.addPage();
                        cursorX = margin;
                    }
                } else { 
                    if (cursorX + boxWidth > pageWidth - margin) {
                        cursorX = margin;
                        cursorY += boxHeight + itemSpacing;
                    }
                    if (cursorY + boxHeight > pageHeight - margin) {
                        doc.addPage();
                        cursorX = margin;
                        cursorY = margin;
                    }
                }

                // 1. Draw Shadow
                if (showShadow) {
                    doc.setFillColor('#cccccc');
                    doc.roundedRect(cursorX + 3, cursorY + 3, boxWidth, boxHeight, borderRadius, borderRadius, 'F');
                }

                // 2. Draw Background and Border
                doc.setFillColor(bgColor);
                let rectStyle = 'F';
                if (borderWidth > 0) {
                    doc.setDrawColor(borderColor);
                    doc.setLineWidth(borderWidth);
                    rectStyle = 'FD'; // Fill and stroke
                }
                doc.roundedRect(cursorX, cursorY, boxWidth, boxHeight, borderRadius, borderRadius, rectStyle);

                // 3. Draw Image
                const imgAreaWidth = boxWidth - (paddingX * 2);
                const imgAreaHeight = boxHeight - (paddingY * 2) - textAllowance;
                
                if (imgAreaWidth > 0 && imgAreaHeight > 0) {
                    const iw = imgElement.naturalWidth || imgElement.width || 1;
                    const ih = imgElement.naturalHeight || imgElement.height || 1;
                    const scale = Math.min(imgAreaWidth / iw, imgAreaHeight / ih);
                    const w = iw * scale;
                    const h = ih * scale;
                    
                    const ix = cursorX + paddingX + (imgAreaWidth - w) / 2;
                    let iy = cursorY + paddingY;
                    if (showText && textPosition === 'top') {
                        iy += textAllowance; 
                    }
                    
                    // Always try 'PNG' or 'JPEG' fallback is done by jsPDF
                    doc.addImage(imgElement, 'PNG', ix, iy, w, h);
                }

                // 4. Draw Text
                if (showText && item.data.description) {
                    doc.setFont(fontFamily);
                    doc.setFontSize(fontSize);
                    doc.setTextColor(textColor);
                    
                    const tx = cursorX + boxWidth / 2;
                    let ty = cursorY + paddingY; 
                    if (textPosition === 'top') {
                        ty += fontSize;
                    } else {
                        ty = cursorY + boxHeight - paddingY - 2; 
                    }
                    doc.text(item.data.description, tx, ty, { align: 'center' });
                }

                // Advance cursor for next item
                if (layoutMode === 'chain') {
                    cursorY += boxHeight + itemSpacing;
                } else {
                    cursorX += boxWidth + itemSpacing;
                }
            }

            // Save straight to browser avoiding the backend
            doc.save('pictogram_list.pdf');

        } catch (error) {
            console.error('Error exporting to PDF:', error);
            alert(`An error occurred: ${error.message}`);
        } finally {
            this.exportPdfBtn.innerHTML = originalBtnText;
            this.exportPdfBtn.disabled = false;
        }
    }
}

function updateContainerHeight() {
    const header = document.querySelector('nav.navbar');
    const footer = document.querySelector('footer.footer');
    const mainContent = document.querySelector('main.content');
    const listPageContainer = document.getElementById('list-page-container');

    if (!header || !footer || !mainContent || !listPageContainer) {
        return;
    }

    const mainContentStyles = window.getComputedStyle(mainContent);
    const mainMarginTop = parseInt(mainContentStyles.marginTop, 10) || 0;
    const mainMarginBottom = parseInt(mainContentStyles.marginBottom, 10) || 0;

    const headerHeight = header.offsetHeight;
    const footerHeight = footer.offsetHeight;

    const availableHeight = Math.max(0, window.innerHeight - headerHeight - footerHeight - mainMarginTop - mainMarginBottom);

    listPageContainer.style.height = `${availableHeight}px`;
}

document.addEventListener('DOMContentLoaded', () => {
    new ListBuilder();
    updateContainerHeight();
    window.addEventListener('resize', updateContainerHeight);
});
