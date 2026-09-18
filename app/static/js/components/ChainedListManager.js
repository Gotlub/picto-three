import { NotificationService } from '../services/NotificationService.js';

/**
 * ChainedListItem - Élément visuel de la liste séquentielle de pictogrammes
 */
export class ChainedListItem {
    constructor(itemData, manager) {
        this.data = itemData; // { image_id, name, path, description }
        this.manager = manager;
        this.element = this.createElement();
    }

    createElement() {
        const itemElement = document.createElement('div');
        itemElement.classList.add('chained-list-item');
        itemElement.dataset.imageId = this.data.image_id;
        itemElement.setAttribute('draggable', 'true');

        const img = document.createElement('img');
        const imageId = Number(this.data.image_id);
        if (this.data.path && (this.data.path.startsWith('http') || this.data.path.startsWith('data:'))) {
            img.src = this.data.path;
        } else if (!isNaN(imageId) && imageId >= 0) {
            img.src = `/pictograms/${imageId}`;
        } else if (this.data.path) {
            if (this.data.path.startsWith('/')) {
                img.src = this.data.path;
            } else {
                img.src = `/pictograms/${this.data.path}`;
            }
        }
        img.alt = this.data.name || '';
        itemElement.appendChild(img);

        const description = document.createElement('p');
        description.textContent = this.data.description || '';
        itemElement.appendChild(description);

        // Événements pour sélection et drag & drop
        itemElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.manager.selectItem(this);
        });

        itemElement.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            this.manager.handleChainedListDragStart(e, this);
        });

        return itemElement;
    }
}

/**
 * ChainedListManager - Gestionnaire de la liste chaînée inférieure (affichage, DnD, sélection, importation locale)
 */
export class ChainedListManager {
    constructor({
        container = typeof document !== 'undefined' ? document.getElementById('chained-list-container') : null,
        scrollListLeftBtn = typeof document !== 'undefined' ? document.getElementById('scroll-list-left') : null,
        scrollListRightBtn = typeof document !== 'undefined' ? document.getElementById('scroll-list-right') : null,
        deleteLinkBtn = typeof document !== 'undefined' ? document.getElementById('delete-link-btn') : null,
        newChainBtn = typeof document !== 'undefined' ? document.getElementById('new-chain-btn') : null,
        importLocalPicBtn = typeof document !== 'undefined' ? document.getElementById('import-local-pic-btn') : null,
        localPicInput = typeof document !== 'undefined' ? document.getElementById('local-pic-input') : null,
        selectedLinkDescription = typeof document !== 'undefined' ? document.getElementById('selected-link-description') : null
    } = {}) {
        this.container = container;
        this.scrollListLeftBtn = scrollListLeftBtn;
        this.scrollListRightBtn = scrollListRightBtn;
        this.deleteLinkBtn = deleteLinkBtn;
        this.newChainBtn = newChainBtn;
        this.importLocalPicBtn = importLocalPicBtn;
        this.localPicInput = localPicInput;
        this.selectedLinkDescription = selectedLinkDescription;

        this.items = [];
        this.selectedItem = null;
        this.draggedSource = null;
        this.draggedListItem = null;
        this.dropIndicator = this.createDropIndicator();

        this.initEventListeners();
    }

    createDropIndicator() {
        if (typeof document === 'undefined') return null;
        const indicator = document.createElement('div');
        indicator.classList.add('drop-indicator');
        return indicator;
    }

    initEventListeners() {
        this.deleteLinkBtn?.addEventListener('click', () => this.deleteSelectedLink());
        this.newChainBtn?.addEventListener('click', () => this.clearChain());
        this.selectedLinkDescription?.addEventListener('input', () => this.updateSelectedLinkDescription());

        this.importLocalPicBtn?.addEventListener('click', () => {
            this.localPicInput?.click();
        });

        this.localPicInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                const msg = (typeof window !== 'undefined' && window.translations && window.translations.invalidImage)
                    ? window.translations.invalidImage
                    : 'Please select a valid image.';
                NotificationService.alert(msg);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                const fileName = file.name.replace(/\.[^/.]+$/, '');

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
            this.localPicInput.value = '';
        });

        if (this.container) {
            this.container.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.container.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            this.container.addEventListener('drop', (e) => this.handleDrop(e));
            this.container.addEventListener('scroll', () => this.updateScrollButtonsVisibility());
        }

        this.scrollListLeftBtn?.addEventListener('click', () => {
            this.container?.scrollBy({ left: -300, behavior: 'smooth' });
        });

        this.scrollListRightBtn?.addEventListener('click', () => {
            this.container?.scrollBy({ left: 300, behavior: 'smooth' });
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => this.updateScrollButtonsVisibility());
        }

        if (typeof document !== 'undefined') {
            document.addEventListener('dragstart', () => document.body.classList.add('is-dragging-list-item'));
            document.addEventListener('dragend', () => document.body.classList.remove('is-dragging-list-item'));
        }
    }

    addToList(sourceItem) {
        const newItemData = {
            image_id: sourceItem.data.id,
            name: sourceItem.data.name,
            path: sourceItem.data.path,
            description: sourceItem.data.description || ''
        };
        const newListItem = new ChainedListItem(newItemData, this);
        this.items.push(newListItem);
        this.renderChainedList();
    }

    selectItem(item) {
        if (this.selectedItem) {
            this.selectedItem.element.classList.remove('selected');
        }

        this.selectedItem = item;
        this.selectedItem.element.classList.add('selected');

        if (this.selectedLinkDescription) {
            this.selectedLinkDescription.value = this.selectedItem.data.description || '';
            this.selectedLinkDescription.disabled = false;
        }
    }

    updateSelectedLinkDescription() {
        if (this.selectedItem && this.selectedLinkDescription) {
            this.selectedItem.data.description = this.selectedLinkDescription.value;
            const descriptionElement = this.selectedItem.element.querySelector('p');
            if (descriptionElement) {
                descriptionElement.textContent = this.selectedLinkDescription.value;
            }
        }
    }

    deleteSelectedLink() {
        if (!this.selectedItem) {
            NotificationService.alert('Please select a link to delete.');
            return;
        }
        this.items = this.items.filter(item => item !== this.selectedItem);
        this.selectedItem = null;
        if (this.selectedLinkDescription) {
            this.selectedLinkDescription.value = '';
            this.selectedLinkDescription.disabled = true;
        }
        this.renderChainedList();
    }

    clearChain() {
        if (NotificationService.confirm('Are you sure you want to clear the entire chain?')) {
            this.items = [];
            this.selectedItem = null;
            if (this.selectedLinkDescription) {
                this.selectedLinkDescription.value = '';
                this.selectedLinkDescription.disabled = true;
            }
            this.renderChainedList();
        }
    }

    renderChainedList() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.items.forEach(item => {
            this.container.appendChild(item.element);
        });
        setTimeout(() => this.updateScrollButtonsVisibility(), 50);
    }

    updateScrollButtonsVisibility() {
        if (!this.container || !this.scrollListLeftBtn || !this.scrollListRightBtn) return;
        const container = this.container;
        const isScrollable = container.scrollWidth > container.clientWidth;

        if (isScrollable) {
            if (container.scrollLeft > 0) {
                this.scrollListLeftBtn.classList.remove('d-none');
            } else {
                this.scrollListLeftBtn.classList.add('d-none');
            }

            if (Math.ceil(container.scrollLeft + container.clientWidth) >= container.scrollWidth) {
                this.scrollListRightBtn.classList.add('d-none');
            } else {
                this.scrollListRightBtn.classList.remove('d-none');
            }
        } else {
            this.scrollListLeftBtn.classList.add('d-none');
            this.scrollListRightBtn.classList.add('d-none');
        }
    }

    handleChainedListDragStart(e, item) {
        this.draggedListItem = item;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.element.classList.add('dragging'), 0);
    }

    handleDragOver(e) {
        e.preventDefault();
        if (!this.container || !this.dropIndicator) return;
        const container = this.container;

        const rect = container.getBoundingClientRect();
        const threshold = 50;
        const scrollSpeed = 15;

        if (e.clientX - rect.left < threshold) {
            container.scrollLeft -= scrollSpeed;
        } else if (rect.right - e.clientX < threshold) {
            container.scrollLeft += scrollSpeed;
        }

        const afterElement = this.getDragAfterElement(container, e.clientX);

        if (this.draggedListItem || this.draggedSource) {
            if (afterElement == null) {
                container.appendChild(this.dropIndicator);
            } else {
                container.insertBefore(this.dropIndicator, afterElement.element);
            }
        }
    }

    handleDragLeave(e) {
        if (e.target === this.container) {
            this.removeDropIndicator();
        }
    }

    removeDropIndicator() {
        if (this.dropIndicator && this.dropIndicator.parentNode) {
            this.dropIndicator.parentNode.removeChild(this.dropIndicator);
        }
    }

    handleDrop(e) {
        e.preventDefault();
        this.removeDropIndicator();

        const afterElement = this.getDragAfterElement(this.container, e.clientX);
        const newIndex = afterElement ? this.items.indexOf(afterElement) : this.items.length;

        if (this.draggedListItem) {
            this.draggedListItem.element.classList.remove('dragging');
            const oldIndex = this.items.indexOf(this.draggedListItem);
            this.items.splice(oldIndex, 1);

            const newIndexForReorder = afterElement ? this.items.indexOf(afterElement) : this.items.length;
            this.items.splice(newIndexForReorder, 0, this.draggedListItem);
            this.draggedListItem = null;
        } else {
            const dragDataString = e.dataTransfer.getData('application/json');
            let dragData = null;

            if (dragDataString) {
                try {
                    dragData = JSON.parse(dragDataString);
                } catch (err) {
                    console.error('Could not parse drag data: ', err);
                }
            }

            if (dragData) {
                if (dragData.type === 'tree-branch' && Array.isArray(dragData.data)) {
                    let insertIndex = newIndex;
                    dragData.data.forEach(itemData => {
                        const rawId = itemData.id;
                        const validId = (rawId !== undefined && rawId !== 'root' && !isNaN(Number(rawId)))
                            ? Number(rawId)
                            : -1;
                        const newItemData = {
                            image_id: validId,
                            name: itemData.name || '',
                            path: itemData.path || '',
                            description: itemData.description || ''
                        };
                        const newListItem = new ChainedListItem(newItemData, this);
                        this.items.splice(insertIndex, 0, newListItem);
                        insertIndex++;
                    });
                } else if (dragData.type === 'image-tree-node' || dragData.type === 'tree-node') {
                    const sourceData = dragData.data;
                    const newItemData = {
                        image_id: sourceData.id,
                        name: sourceData.name,
                        path: sourceData.path,
                        description: sourceData.description || ''
                    };
                    const newListItem = new ChainedListItem(newItemData, this);
                    this.items.splice(newIndex, 0, newListItem);
                } else if (dragData.type === 'arasaac-image') {
                    const sourceData = dragData.data;
                    const newItemData = {
                        image_id: sourceData.id,
                        name: sourceData.name,
                        path: sourceData.path,
                        description: sourceData.description || ''
                    };
                    const newListItem = new ChainedListItem(newItemData, this);
                    this.items.splice(newIndex, 0, newListItem);
                }
            }
            this.draggedSource = null;
        }
        this.renderChainedList();
    }

    getDragAfterElement(container, x) {
        if (!container) return null;
        const draggableElements = [...container.querySelectorAll('.chained-list-item:not(.dragging)')];

        const afterElementDOM = draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;

        if (afterElementDOM) {
            return this.items.find(item => item.element === afterElementDOM);
        }
        return null;
    }

    setSourceDrag(source) {
        this.draggedSource = source;
    }

    setItemsFromPayload(payload) {
        this.items = payload.map(itemData => {
            const imageInfo = {
                id: itemData.image_id,
                name: itemData.name,
                path: itemData.url
            };
            const finalData = {
                path: imageInfo.path,
                name: imageInfo.name,
                image_id: imageInfo.id,
                description: itemData.description
            };
            return new ChainedListItem(finalData, this);
        });
        this.renderChainedList();
    }

    toPayload() {
        return this.items.map(item => {
            const data = item.data || {};
            let imageId = data.image_id;
            const imageUrl = data.path || data.url || '';
            const imageName = data.name || '';

            if (imageUrl && imageUrl.startsWith('http')) {
                imageId = -1;
            } else if (imageId === 'root' || isNaN(Number(imageId)) || Number(imageId) < 0) {
                imageId = -1;
            } else {
                imageId = Number(imageId);
            }

            return {
                image_id: imageId,
                url: imageUrl,
                name: imageName,
                description: data.description || ''
            };
        });
    }
}
