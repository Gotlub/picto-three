import ImageTree from './components/ImageTree.js';
import ArasaacSearch from './components/ArasaacSearch.js';

// --- Start of Tree Viewer (Center Panel, adapted from builder.js) ---
class ReadOnlyNode {
    constructor(nodeData, image, listBuilder, isRoot = false) {
        this.nodeData = nodeData;
        this.image = image;
        this.listBuilder = listBuilder;
        this.children = [];
        this.parent = null;
        this.isRoot = isRoot;
        this.isDefaultRoot = (this.isRoot && (image.id === 'root' || (!nodeData || !nodeData.url)));
        this.description = nodeData.description || image.description || '';
        this.element = this.createElement();

        // Make the node draggable for copying
        this.element.setAttribute('draggable', 'true');
        this.element.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            // 1. Fonction récursive pour collecter les données de la branche (inchangée)
            const collectBranchData = (node) => {
                const nodeData = { ...node.image, description: node.description, isRoot: node.isRoot };
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
                const nodeData = { ...this.image, description: this.description, isRoot: this.isRoot };
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
            const imageId = Number(this.image.id);
            if (this.image.path.startsWith('http')) {
                imgElement.src = this.image.path;
            } else if (!isNaN(imageId) && imageId >= 0) {
                imgElement.src = `/pictograms/${imageId}`;
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
        const imageId = Number(this.data.image_id);
        if (this.data.path && (this.data.path.startsWith('http') || this.data.path.startsWith('data:'))) {
            img.src = this.data.path;
        } else if (!isNaN(imageId) && imageId >= 0) {
            img.src = `/pictograms/${imageId}`;
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
        this.saveBtn = document.getElementById('save-list-btn');
        this.listNameInput = document.getElementById('list-name');
        this.isPublicCheckbox = document.getElementById('list-is-public');
        this.listSearchInput = document.getElementById('list-search');
        this.listContainer = document.getElementById('list-container');
        this.loadListBtn = document.getElementById('load-list-btn');

        // Left Panel - Tree Section
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
        this.treeRoot = new ReadOnlyNode(rootData, rootData, this, true);
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
        this.importLocalPicBtn = document.getElementById('import-local-pic-btn');
        this.localPicInput = document.getElementById('local-pic-input');
        this.chainedListItems = [];
        this.selectedChainedItem = null;

        // State
        this.draggedSource = null; // What is being dragged from left/center
        this.draggedListItem = null; // What is being dragged within the list
        this.dropIndicator = this.createDropIndicator();

        // Print UI & State
        this.currentZoom = 1.0;
        this.btnZoomOut = document.getElementById('btn-zoom-out');
        this.btnZoomIn = document.getElementById('btn-zoom-in');
        this.zoomLevelText = document.getElementById('zoom-level-text');
        this.btnRenderPreview = document.getElementById('btn-render-preview');
        this.printPagesWrapper = document.getElementById('print-pages-wrapper');
        this.exportPdfBtn = document.getElementById('export-pdf-btn');

        // Print Settings
        this.printImageSize = document.getElementById('print-image-size');
        this.printSizePx = document.getElementById('print-size-px');
        this.printSizeCm = document.getElementById('print-size-cm');
        this.printBorderWidth = document.getElementById('print-border-width');
        this.printBorderWidthVal = document.getElementById('print-border-width-val');

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

    initTabAccordionSync() {
        const constructAccordion = document.getElementById('collapseConstruct');
        const exportAccordion = document.getElementById('collapseExportPdf');
        const importTabBtn = document.getElementById('import-describe-tab');
        const printTabBtn = document.getElementById('print-tab');

        if (!constructAccordion || !exportAccordion || !importTabBtn || !printTabBtn) return;

        let isSyncing = false;

        // Accordion -> Tabs
        constructAccordion.addEventListener('show.bs.collapse', () => {
            if (isSyncing) return;
            isSyncing = true;
            bootstrap.Tab.getOrCreateInstance(importTabBtn).show();
            isSyncing = false;
        });

        exportAccordion.addEventListener('show.bs.collapse', () => {
            if (isSyncing) return;
            isSyncing = true;
            bootstrap.Tab.getOrCreateInstance(printTabBtn).show();
            isSyncing = false;
        });

        // Tabs -> Accordion
        importTabBtn.addEventListener('show.bs.tab', () => {
            if (isSyncing) return;
            isSyncing = true;
            bootstrap.Collapse.getOrCreateInstance(constructAccordion).show();
            isSyncing = false;
        });

        printTabBtn.addEventListener('show.bs.tab', () => {
            if (isSyncing) return;
            isSyncing = true;
            bootstrap.Collapse.getOrCreateInstance(exportAccordion).show();
            isSyncing = false;
        });
    }

    initEventListeners() {
        this.initSelectionModeListener();
        this.initTabAccordionSync();

        // PDF Export
        this.exportPdfBtn?.addEventListener('click', () => this.exportToPdf());
        
        // Print Tab specific logic
        const printTabBtn = document.getElementById('print-tab');
        const importTabBtn = document.getElementById('import-describe-tab');
        
        if (printTabBtn && importTabBtn) {
            printTabBtn.addEventListener('show.bs.tab', () => {
                if (this.deleteLinkBtn) this.deleteLinkBtn.style.display = 'none';
                if (this.newChainBtn) this.newChainBtn.style.display = 'none';
                if (this.importLocalPicBtn) this.importLocalPicBtn.style.display = 'none';
                this.renderPreview(); // Auto render when switching
            });
            importTabBtn.addEventListener('show.bs.tab', () => {
                if (this.deleteLinkBtn) this.deleteLinkBtn.style.display = 'inline-block';
                if (this.newChainBtn) this.newChainBtn.style.display = 'inline-block';
                if (this.importLocalPicBtn) this.importLocalPicBtn.style.display = 'inline-block';
            });
        }

        // Import Local Picture Events
        this.importLocalPicBtn?.addEventListener('click', () => {
            this.localPicInput?.click();
        });

        this.localPicInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                alert(window.translations.invalidImage);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
                
                const sourceItem = {
                    data: {
                        id: 'local_' + Date.now(),
                        path: dataUrl,
                        name: fileName,
                        description: fileName
                    }
                };
                
                this.addToList(sourceItem);
            };
            reader.readAsDataURL(file);
            
            // Reset input so the same file can be selected again
            this.localPicInput.value = '';
        });

        // Print Accordion <-> Radio Button sync
        const printModesAccordion = document.getElementById('printModesAccordion');
        if (printModesAccordion) {
            printModesAccordion.addEventListener('show.bs.collapse', (e) => {
                if (e.target.id === 'collapseGridMode') {
                    document.getElementById('mode-grid').checked = true;
                } else if (e.target.id === 'collapseChainMode') {
                    document.getElementById('mode-chain').checked = true;
                }
            });
        }

        // Print UI Events
        this.btnZoomOut?.addEventListener('click', () => this.changeZoom(-0.1));
        this.btnZoomIn?.addEventListener('click', () => this.changeZoom(0.1));
        
        this.printImageSize?.addEventListener('input', () => {
            if (this.printSizePx) this.printSizePx.textContent = this.printImageSize.value;
            if (this.printSizeCm) this.printSizeCm.textContent = (this.printImageSize.value / 37.8).toFixed(1);
        });
        
        this.printBorderWidth?.addEventListener('input', () => {
            if (this.printBorderWidthVal) this.printBorderWidthVal.textContent = this.printBorderWidth.value + 'px';
        });

        this.btnRenderPreview?.addEventListener('click', () => this.renderPreview());

        // Left Panel - List
        this.saveBtn?.addEventListener('click', () => this.saveList());
        this.loadListBtn?.addEventListener('click', () => this.loadSelectedList());

        // Left Panel - Tree
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
                        if (!itemData.isRoot && newItemData.name !== "Root") {
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
        if (!this.currentUserId) {
            alert(window.translations.accountRequired);
            return;
        }

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
            this.currentUserId = data.current_user_id;
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
            const rootImageId = rootData.id !== 'root' && rootData.id !== undefined ? rootData.id : rootData.real_id;
            const rootImage = {
                id: rootImageId !== undefined ? rootImageId : 'root',
                real_id: rootData.real_id,
                name: rootData.name || 'Root',
                path: rootData.url || '/static/images/folder-open-bold.png',
                description: rootData.description || rootData.name
            };
            this.treeRoot = new ReadOnlyNode(rootData, rootImage, this, true);

            if (rootData.children) {
                rootData.children.forEach(childData => {
                    const childNode = buildNode(childData);
                    if (childNode) this.treeRoot.addChild(childNode);
                });
            }
        } else if (treeData.roots && treeData.roots.length > 1) {
            const rootDisplayData = { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png', description: 'Root' };
            this.treeRoot = new ReadOnlyNode(rootDisplayData, rootDisplayData, this, true);

            treeData.roots.forEach(rootData => {
                const rootNode = buildNode(rootData);
                if (rootNode) this.treeRoot.addChild(rootNode);
            });
        } else {
            const rootDisplayData = { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png', description: 'Root' };
            this.treeRoot = new ReadOnlyNode(rootDisplayData, rootDisplayData, this, true);
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


    changeZoom(delta) {
        this.currentZoom += delta;
        if (this.currentZoom < 0.3) this.currentZoom = 0.3;
        if (this.currentZoom > 2.0) this.currentZoom = 2.0;
        
        if (this.zoomLevelText) {
            this.zoomLevelText.textContent = Math.round(this.currentZoom * 100) + '%';
        }
        
        if (this.printPagesWrapper) {
            this.printPagesWrapper.style.transform = `scale(${this.currentZoom})`;
        }
    }

    renderPreview() {
        if (!this.printPagesWrapper) return;
        this.printPagesWrapper.innerHTML = '';
        
        if (!this.chainedListItems || this.chainedListItems.length === 0) {
            this.printPagesWrapper.innerHTML = '<div class="text-center p-5 text-white">No images to print.</div>';
            return;
        }

        // 1. Read settings
        const orientRadios = document.querySelector('input[name="print-orientation"]:checked');
        const orientation = orientRadios ? orientRadios.value : 'portrait';
        const imageSize = parseInt(this.printImageSize?.value || 100);
        const borderWidth = parseInt(this.printBorderWidth?.value || 1);
        const colorRadios = document.querySelector('input[name="print-border-color"]:checked');
        const borderColor = colorRadios ? colorRadios.value : '#000000';
        const showText = document.getElementById('print-show-text')?.checked ?? true;
        const textPosition = document.getElementById('print-text-position')?.value || 'bottom';
        const textPlacement = document.getElementById('print-text-placement')?.value || 'outside';
        const textSizeInput = parseInt(document.getElementById('print-text-size')?.value, 10);
        const textSize = isNaN(textSizeInput) ? 14 : textSizeInput;
        
        const modeRadios = document.querySelector('input[name="print-mode"]:checked');
        const mode = modeRadios ? modeRadios.value : 'grid';
        
        const gridMultiplier = parseInt(document.getElementById('print-grid-multiplier')?.value) || 1;
        
        const rawMarginX = parseInt(document.getElementById('print-margin-x')?.value, 10);
        const marginX = isNaN(rawMarginX) ? 10 : rawMarginX;
        
        const rawMarginY = parseInt(document.getElementById('print-margin-y')?.value, 10);
        const marginY = isNaN(rawMarginY) ? 10 : rawMarginY;

        // 2. Prepare items
        let itemsToRender = [];
        if (mode === 'grid') {
            for (const item of this.chainedListItems) {
                for (let i = 0; i < gridMultiplier; i++) {
                    itemsToRender.push(item);
                }
            }
        } else {
            itemsToRender = [...this.chainedListItems];
        }

        // 3. Mathematical Pagination
        // A4 pixels at 96 DPI
        const A4_PORTRAIT_W = 794;
        const A4_PORTRAIT_H = 1123;
        const pageWidth = orientation === 'portrait' ? A4_PORTRAIT_W : A4_PORTRAIT_H;
        const pageHeight = orientation === 'portrait' ? A4_PORTRAIT_H : A4_PORTRAIT_W;
        
        const pagePadding = 40; // ~10mm global margin
        const availWidth = pageWidth - 2 * pagePadding;
        const availHeight = pageHeight - 2 * pagePadding;

        // Estimate item dimensions
        const textHeight = showText ? (textSize + 10) : 0; // ~textSize+10px for text block
        let itemTotalW = imageSize + 2 * borderWidth;
        let itemTotalH = imageSize + 2 * borderWidth;
        
        if (textPlacement === 'outside') {
            itemTotalH += textHeight;
        }
        
        if (mode === 'grid') {
            // Little default gap for grid breathing room
            const gap = 5;
            itemTotalW += gap;
            itemTotalH += gap;
        } else {
            // Chained list uses explicit margins
            itemTotalW += marginX;
            itemTotalH += marginY;
        }

        // Calculate columns and rows
        let cols, rows;
        if (mode === 'chain' && orientation === 'portrait') {
            // Fill vertically first
            rows = Math.max(1, Math.floor(availHeight / itemTotalH));
            cols = Math.max(1, Math.floor(availWidth / itemTotalW));
        } else {
            // Fill horizontally first
            cols = Math.max(1, Math.floor(availWidth / itemTotalW));
            rows = Math.max(1, Math.floor(availHeight / itemTotalH));
        }
        const itemsPerPage = Math.max(1, cols * rows); // at least 1 item per page

        // 4. Generate DOM
        for (let i = 0; i < itemsToRender.length; i += itemsPerPage) {
            const chunk = itemsToRender.slice(i, i + itemsPerPage);
            
            const pageDiv = document.createElement('div');
            pageDiv.className = `a4-page ${orientation}`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'page-content';
            contentDiv.style.padding = `${pagePadding}px`;
            contentDiv.style.display = 'flex';
            contentDiv.style.flexWrap = 'wrap';
            contentDiv.style.alignContent = 'flex-start';
            
            if (mode === 'grid') {
                contentDiv.style.gap = '5px';
            } else {
                contentDiv.style.columnGap = `${marginX}px`;
                contentDiv.style.rowGap = `${marginY}px`;
                if (orientation === 'portrait') {
                    contentDiv.style.flexDirection = 'column';
                }
            }

            chunk.forEach(item => {
                const itemContainer = document.createElement('div');
                itemContainer.style.display = 'flex';
                itemContainer.style.flexDirection = 'column';
                itemContainer.style.alignItems = 'center';
                itemContainer.style.width = `${imageSize + 2*borderWidth}px`;
                
                const imgContainer = document.createElement('div');
                imgContainer.style.border = `${borderWidth}px solid ${borderColor}`;
                imgContainer.style.width = `${imageSize + 2*borderWidth}px`;
                imgContainer.style.height = `${imageSize + 2*borderWidth}px`;
                imgContainer.style.display = 'flex';
                imgContainer.style.justifyContent = 'center';
                imgContainer.style.alignItems = 'center';
                imgContainer.style.backgroundColor = 'white';
                imgContainer.style.overflow = 'hidden';
                imgContainer.style.position = 'relative';

                 const img = document.createElement('img');
                 const imageId = Number(item.data.image_id);
                 if (item.data.path && item.data.path.startsWith('http')) {
                     img.src = item.data.path;
                 } else if (!isNaN(imageId) && imageId >= 0) {
                     img.src = `/pictograms/${imageId}`;
                 } else if (item.data.path) {
                     img.src = item.data.path.startsWith('/') || item.data.path.startsWith('data:')
                                 ? item.data.path 
                                 : '/pictograms/' + item.data.path;
                 } else {
                     img.src = '/static/images/prohibit-bold.png';
                 }
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.objectFit = 'contain';
                
                const textSpan = document.createElement('span');
                textSpan.textContent = item.data.description || item.data.name || '';
                textSpan.style.fontSize = `${textSize}px`;
                textSpan.style.fontFamily = 'sans-serif';
                textSpan.style.textAlign = 'center';
                textSpan.style.width = '100%';
                textSpan.style.whiteSpace = 'nowrap';
                textSpan.style.overflow = 'hidden';
                textSpan.style.textOverflow = 'ellipsis';
                textSpan.style.display = 'block';
                textSpan.style.height = `${textSize + 10}px`;
                textSpan.style.lineHeight = `${textSize + 6}px`;
                textSpan.style.padding = '2px';

                if (textPlacement === 'inside') {
                    // Place text inside the image container, over the image
                    textSpan.style.position = 'absolute';
                    textSpan.style.left = '0';
                    textSpan.style.right = '0';
                    textSpan.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                    
                    if (textPosition === 'top') {
                        textSpan.style.top = '0';
                    } else {
                        textSpan.style.bottom = '0';
                    }
                    
                    imgContainer.appendChild(img);
                    if (showText) imgContainer.appendChild(textSpan);
                    itemContainer.appendChild(imgContainer);
                } else {
                    // Place text outside
                    imgContainer.appendChild(img);
                    
                    if (showText && textPosition === 'top') {
                        itemContainer.appendChild(textSpan);
                    }
                    
                    itemContainer.appendChild(imgContainer);
                    
                    if (showText && textPosition === 'bottom') {
                        itemContainer.appendChild(textSpan);
                    }
                }

                contentDiv.appendChild(itemContainer);
            });
            
            pageDiv.appendChild(contentDiv);
            this.printPagesWrapper.appendChild(pageDiv);
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

            // 1. Read settings exactly as in renderPreview
            const orientRadios = document.querySelector('input[name="print-orientation"]:checked');
            const orientation = orientRadios ? orientRadios.value : 'portrait';
            const imageSize = parseInt(this.printImageSize?.value || 100);
            const borderWidth = parseInt(this.printBorderWidth?.value || 1);
            const colorRadios = document.querySelector('input[name="print-border-color"]:checked');
            const borderColor = colorRadios ? colorRadios.value : '#000000';
            const showText = document.getElementById('print-show-text')?.checked ?? true;
            const textPosition = document.getElementById('print-text-position')?.value || 'bottom';
            const textPlacement = document.getElementById('print-text-placement')?.value || 'outside';
            const textSizeInput = parseInt(document.getElementById('print-text-size')?.value, 10);
            const textSize = isNaN(textSizeInput) ? 14 : textSizeInput;
            
            const modeRadios = document.querySelector('input[name="print-mode"]:checked');
            const mode = modeRadios ? modeRadios.value : 'grid';
            
            const gridMultiplier = parseInt(document.getElementById('print-grid-multiplier')?.value) || 1;
            const rawMarginX = parseInt(document.getElementById('print-margin-x')?.value, 10);
            const marginX = isNaN(rawMarginX) ? 10 : rawMarginX;
            const rawMarginY = parseInt(document.getElementById('print-margin-y')?.value, 10);
            const marginY = isNaN(rawMarginY) ? 10 : rawMarginY;

            // 2. Initialize document matching A4 px exactly (96 DPI equivalent layout)
            const doc = new jsPDF({
                orientation: orientation,
                unit: 'px',
                format: [794, 1123]
            });

            // 3. Prepare items
            let itemsToRender = [];
            if (mode === 'grid') {
                for (const item of this.chainedListItems) {
                    for (let i = 0; i < gridMultiplier; i++) {
                        itemsToRender.push(item);
                    }
                }
            } else {
                itemsToRender = [...this.chainedListItems];
            }

            // 4. Mathematical Pagination
            const A4_PORTRAIT_W = 794;
            const A4_PORTRAIT_H = 1123;
            const pageWidth = orientation === 'portrait' ? A4_PORTRAIT_W : A4_PORTRAIT_H;
            const pageHeight = orientation === 'portrait' ? A4_PORTRAIT_H : A4_PORTRAIT_W;
            
            const pagePadding = 40;
            const availWidth = pageWidth - 2 * pagePadding;
            const availHeight = pageHeight - 2 * pagePadding;

            const textHeight = showText ? (textSize + 10) : 0;
            let itemTotalW = imageSize + 2 * borderWidth;
            let itemTotalH = imageSize + 2 * borderWidth;
            
            if (textPlacement === 'outside') {
                itemTotalH += textHeight;
            }
            
            if (mode === 'grid') {
                const gap = 5;
                itemTotalW += gap;
                itemTotalH += gap;
            } else {
                itemTotalW += marginX;
                itemTotalH += marginY;
            }

            let cols, rows;
            if (mode === 'chain' && orientation === 'portrait') {
                rows = Math.max(1, Math.floor(availHeight / itemTotalH));
                cols = Math.max(1, Math.floor(availWidth / itemTotalW));
            } else {
                cols = Math.max(1, Math.floor(availWidth / itemTotalW));
                rows = Math.max(1, Math.floor(availHeight / itemTotalH));
            }
            const itemsPerPage = Math.max(1, cols * rows);

            const loadImage = (src, imgId) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);

                    let fullSrc = src;
                    const imageId = Number(imgId);
                    if (src && src.startsWith('http')) {
                        // Keep HTTP URL
                    } else if (!isNaN(imageId) && imageId >= 0) {
                        fullSrc = `/pictograms/${imageId}`;
                    } else if (src.startsWith('data:')) {
                        // Keep data URI
                    } else if (!src.startsWith('/')) {
                        fullSrc = '/pictograms/' + src;
                    }
                    img.src = fullSrc;
                });
            };

            let currentPage = 1;
            for (let i = 0; i < itemsToRender.length; i++) {
                const pageIndex = Math.floor(i / itemsPerPage);
                if (pageIndex + 1 > currentPage) {
                    doc.addPage();
                    currentPage++;
                }

                const indexOnPage = i % itemsPerPage;
                let col, row;
                if (mode === 'chain' && orientation === 'portrait') {
                    col = Math.floor(indexOnPage / rows);
                    row = indexOnPage % rows;
                } else {
                    row = Math.floor(indexOnPage / cols);
                    col = indexOnPage % cols;
                }

                const x = pagePadding + col * itemTotalW;
                const y = pagePadding + row * itemTotalH;

                const item = itemsToRender[i];
                const imgElement = await loadImage(item.data.path, item.data.image_id);

                let imgBoxX = x;
                let imgBoxY = y;
                if (showText && textPlacement === 'outside' && textPosition === 'top') {
                    imgBoxY += textHeight;
                }
                
                // Draw Border / Background
                if (borderWidth > 0) {
                    doc.setDrawColor(borderColor);
                    doc.setLineWidth(borderWidth);
                    doc.setFillColor('#ffffff');
                    doc.rect(imgBoxX, imgBoxY, imageSize + 2 * borderWidth, imageSize + 2 * borderWidth, 'FD');
                } else {
                    doc.setFillColor('#ffffff');
                    doc.rect(imgBoxX, imgBoxY, imageSize, imageSize, 'F');
                }

                // Draw Image
                if (imgElement) {
                    const innerSize = imageSize;
                    const iw = imgElement.naturalWidth || imgElement.width || 1;
                    const ih = imgElement.naturalHeight || imgElement.height || 1;
                    const scale = Math.min(innerSize / iw, innerSize / ih);
                    const w = iw * scale;
                    const h = ih * scale;
                    
                    const ix = imgBoxX + borderWidth + (innerSize - w) / 2;
                    const iy = imgBoxY + borderWidth + (innerSize - h) / 2;
                    
                    doc.addImage(imgElement, 'PNG', ix, iy, w, h);
                }

                // Draw Text
                if (showText) {
                    const textStr = item.data.description || item.data.name || '';
                    doc.setFontSize(textSize);
                    doc.setTextColor('#000000');
                    
                    if (textPlacement === 'inside') {
                        doc.setFillColor('#ffffff'); // Solid white background for text readability
                        const rectHeight = textSize + 6;
                        const rectY = textPosition === 'top' ? imgBoxY : imgBoxY + imageSize + 2 * borderWidth - rectHeight;
                        doc.rect(imgBoxX + borderWidth, rectY + borderWidth, imageSize, rectHeight, 'F');
                        
                        const textX = imgBoxX + borderWidth + imageSize / 2;
                        const textY = textPosition === 'top' ? imgBoxY + borderWidth + textSize : imgBoxY + imageSize + 2 * borderWidth - 4;
                        const splitTextInside = doc.splitTextToSize(textStr, imageSize);
                        doc.text(splitTextInside[0], textX, textY, { align: 'center' });
                    } else {
                        const textX = imgBoxX + (imageSize + 2 * borderWidth) / 2;
                        let textY;
                        if (textPosition === 'top') {
                            textY = y + textSize + 4;
                        } else {
                            textY = imgBoxY + imageSize + 2 * borderWidth + textSize + 4;
                        }
                        const splitTextOutside = doc.splitTextToSize(textStr, imageSize + 2 * borderWidth);
                        doc.text(splitTextOutside[0], textX, textY, { align: 'center' });
                    }
                }
            }

            doc.save('pictograms-list.pdf');

        } catch (error) {
            console.error(error);
            alert('An error occurred during PDF generation.');
        } finally {
            this.exportPdfBtn.innerHTML = originalBtnText;
            this.exportPdfBtn.disabled = false;
        }
    }

}

document.addEventListener('DOMContentLoaded', () => {
    new ListBuilder();
});
