class BaseNode {
    constructor(data, bank) {
        this.data = data;
        this.bank = bank;
        this.element = this.createElement();
        this.children = [];

        if (this.data.children) {
            this.data.children.forEach(childData => {
                let childNode;
                if (childData.type === 'folder') {
                    childNode = new FolderNode(childData, bank);
                } else {
                    childNode = new ImageNode(childData, bank);
                }
                this.children.push(childNode);
            });
        }
    }

    createElement() {
        // To be implemented by subclasses
        throw new Error("createElement must be implemented by subclass");
    }
}

class FolderNode extends BaseNode {
    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node', 'folder-node');
        nodeElement.dataset.id = this.data.id;

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const icon = document.createElement('img');
        icon.src = '/static/images/folder-bold.png'; // As requested
        contentElement.appendChild(icon);

        const nameElement = document.createElement('span');
        nameElement.textContent = this.data.name;
        contentElement.appendChild(nameElement);

        nodeElement.appendChild(contentElement);

        contentElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bank.selectNode(this);
        });

        nodeElement.addEventListener('click', (e) => {
            if (e.target === nodeElement) {
                e.stopPropagation();
                this.bank.selectNode(this);
            }
        });

        return nodeElement;
    }
}

class ImageNode extends BaseNode {
    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node', 'image-node');
        nodeElement.dataset.id = this.data.id;

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        // Retrieve by ID if valid, else by path
        const imageId = Number(this.data.id);
        if (this.data.path && this.data.path.startsWith('http')) {
            imgElement.src = this.data.path;
        } else if (!isNaN(imageId) && imageId >= 0) {
            imgElement.src = `/pictograms/${imageId}`;
        } else {
            imgElement.src = `/pictograms/${this.data.path}`;
        }
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

        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bank.selectNode(this);
        });

        return nodeElement;
    }
}


class PictogramBank {
    constructor() {
        this.display = document.getElementById('pictogram-display');
        try {
            this.initialData = JSON.parse(document.getElementById('pictogram-data').textContent);
        } catch (e) {
            console.error("Erreur de parsing des données initiales:", e);
            this.initialData = { id: 1, name: "Root", type: "folder", children: [] };
        }
        const fileChosen = document.getElementById('file-chosen');
        fileChosen.dataset.defaultText = fileChosen.textContent;

        this.rootNode = new FolderNode(this.initialData, this);
        this.selectedNode = null;
        this.rootSelected = false;
        this.selectedImageThumbnail = null;

        this.initEventListeners();
        this.renderTree();
        this.updateImportSectionState();
    }

    initEventListeners() {
        document.getElementById('create-folder-btn').addEventListener('click', () => this.createFolder());
        document.getElementById('upload-image-btn').addEventListener('click', () => this.uploadImage());
        document.getElementById('bank-delete-btn').addEventListener('click', () => this.deleteSelected());
        document.getElementById('export-image-btn').addEventListener('click', () => this.exportImage());
        document.getElementById('image-upload-file').addEventListener('change', (e) => {
            const fileChosen = document.getElementById('file-chosen');
            const isReplaceMode = this.selectedNode && (this.selectedNode instanceof ImageNode);
            if (e.target.files.length > 0) {
                const filename = e.target.files[0].name;
                fileChosen.textContent = filename;
                
                // Automatically suggest description (filename without extension)
                // only if not in replace mode, or if description is currently empty
                const descInput = document.getElementById('image-description');
                if (descInput && (!isReplaceMode || !descInput.value.trim())) {
                    const lastDotIndex = filename.lastIndexOf('.');
                    const nameWithoutExt = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
                    descInput.value = nameWithoutExt;
                }
            } else {
                fileChosen.textContent = fileChosen.dataset.defaultText;
                const descInput = document.getElementById('image-description');
                if (descInput && !isReplaceMode) {
                    descInput.value = '';
                }
            }
        });
        document.getElementById('save-image-changes-btn').addEventListener('click', () => this.saveImageChanges());

        const replaceFileInput = document.getElementById('replace-image-file');
        if (replaceFileInput) {
            replaceFileInput.addEventListener('change', (e) => {
                const replaceFileChosen = document.getElementById('replace-file-chosen');
                const replaceBtn = document.getElementById('replace-image-btn');
                if (e.target.files.length > 0) {
                    if (replaceFileChosen) replaceFileChosen.textContent = e.target.files[0].name;
                    if (replaceBtn) replaceBtn.disabled = false;
                } else {
                    if (replaceFileChosen) replaceFileChosen.textContent = 'No file chosen';
                    if (replaceBtn) replaceBtn.disabled = true;
                }
            });
        }

        const replaceBtn = document.getElementById('replace-image-btn');
        if (replaceBtn) {
            replaceBtn.addEventListener('click', () => this.replaceImageFile());
        }

        const refreshBtn = document.getElementById('bank-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }

        if (this.display) {
            this.display.addEventListener('click', (e) => {
                if (!e.target.closest('.node-content')) {
                    this.deselectAllNodes();
                }
            });
        }

        document.addEventListener('click', (e) => {
            const isClickInsideDisplay = this.display && this.display.contains(e.target);
            const isClickInsideSidebar = e.target.closest('.sidebar');
            const isClickInsideModal = e.target.closest('.modal');
            if (!isClickInsideDisplay && !isClickInsideSidebar && !isClickInsideModal) {
                this.deselectAllNodes();
            }
        });
    }

    updateImportSectionState() {
        const importSectionTitle = document.getElementById('import-section-title');
        const importThumbContainer = document.getElementById('import-current-thumbnail-container');
        const importThumbImg = document.getElementById('import-current-thumbnail-img');
        const importCurrentName = document.getElementById('import-current-name');
        const importCurrentDesc = document.getElementById('import-current-desc');
        const uploadBtn = document.getElementById('upload-image-btn');
        const uploadLabel = document.getElementById('image-upload-label');
        const descInput = document.getElementById('image-description');
        const fileInput = document.getElementById('image-upload-file');
        const fileChosen = document.getElementById('file-chosen');

        const isImage = this.selectedNode && (this.selectedNode instanceof ImageNode);

        if (isImage) {
            const imageId = Number(this.selectedNode.data.id);
            const imageName = this.selectedNode.data.name || '';
            const imageDesc = this.selectedNode.data.description || '';
            const timestamp = Date.now();
            const thumbUrl = (!isNaN(imageId) && imageId >= 0)
                ? `/pictogramsmin/${imageId}?t=${timestamp}`
                : `/pictogramsmin/${this.selectedNode.data.path}?t=${timestamp}`;

            this.selectedImageThumbnail = thumbUrl;

            if (importSectionTitle) {
                const replacePrefix = importSectionTitle.dataset.replaceTitle || 'Replace Image';
                importSectionTitle.textContent = `${replacePrefix} : ${imageName}`;
            }
            if (importThumbContainer && importThumbImg) {
                importThumbContainer.classList.remove('d-none');
                importThumbContainer.classList.add('d-flex');
                importThumbContainer.style.setProperty('display', 'flex', 'important');
                importThumbImg.src = thumbUrl;
                if (importCurrentName) importCurrentName.textContent = imageName;
                if (importCurrentDesc) importCurrentDesc.textContent = imageDesc;
            }
            if (descInput) {
                descInput.value = imageDesc;
            }
            if (uploadBtn) {
                uploadBtn.textContent = uploadBtn.dataset.replaceText || 'Replace Image';
                uploadBtn.classList.remove('btn-secondary');
                uploadBtn.classList.add('btn-warning');
            }
            if (uploadLabel) {
                uploadLabel.textContent = uploadLabel.dataset.replaceLabel || 'Choose replacement file';
            }
        } else {
            // Folder selected, or no selection (Import Image mode) -> Reset miniature variable and hide thumbnail
            this.selectedImageThumbnail = null;

            if (importSectionTitle) {
                importSectionTitle.textContent = importSectionTitle.dataset.importTitle || 'Import Image';
            }
            if (importThumbContainer) {
                importThumbContainer.classList.remove('d-flex');
                importThumbContainer.classList.add('d-none');
                importThumbContainer.style.setProperty('display', 'none', 'important');
            }
            if (importThumbImg) {
                importThumbImg.removeAttribute('src');
                importThumbImg.src = '';
            }
            if (importCurrentName) {
                importCurrentName.textContent = '';
            }
            if (importCurrentDesc) {
                importCurrentDesc.textContent = '';
            }
            if (uploadBtn) {
                uploadBtn.textContent = uploadBtn.dataset.uploadText || 'Upload';
                uploadBtn.classList.remove('btn-warning');
                uploadBtn.classList.add('btn-secondary');
            }
            if (uploadLabel) {
                uploadLabel.textContent = uploadLabel.dataset.importLabel || 'Upload from disk';
            }
            if (descInput) {
                descInput.value = '';
            }
            if (fileInput) {
                fileInput.value = '';
            }
            if (fileChosen) {
                fileChosen.textContent = fileChosen.dataset.defaultText || 'No file chosen';
            }
        }
    }

    selectNode(node) {
        if (this.selectedNode === node) {
            this.deselectAllNodes();
            return;
        }

        this.deselectAllNodes();
        this.selectedNode = node;
        if (this.selectedNode) {
            this.selectedNode.element.querySelector('.node-content').classList.add('selected');
        }

        const deleteBtn = document.getElementById('bank-delete-btn');
        const exportBtn = document.getElementById('export-image-btn');
        const editSection = document.getElementById('edit-image-section');
        
        // Defensive selections for optional containers
        const descContainer = document.getElementById('edit-description-container');
        const publicContainer = document.getElementById('edit-public-container');
        const saveChangesBtn = document.getElementById('save-image-changes-btn');
        const sectionTitle = document.getElementById('edit-section-title');
        const previewContainer = document.getElementById('edit-image-preview-container');
        const previewImg = document.getElementById('edit-image-preview');
        const replaceContainer = document.getElementById('replace-image-container');
        const replaceFileInput = document.getElementById('replace-image-file');
        const replaceFileChosen = document.getElementById('replace-file-chosen');
        const replaceBtn = document.getElementById('replace-image-btn');

        if (this.selectedNode) {
            const isRoot = this.selectedNode.data.parent_id === null;
            if (isRoot) {
                // Root is a folder but cannot be edited or deleted
                if (editSection) editSection.style.display = 'none';
                if (exportBtn) exportBtn.disabled = true;
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                    if (previewImg) {
                        previewImg.removeAttribute('src');
                        previewImg.src = '';
                    }
                }
                if (replaceContainer) replaceContainer.style.display = 'none';
            } else if (this.selectedNode instanceof ImageNode) {
                if (exportBtn) exportBtn.disabled = false;
                if (editSection) editSection.style.display = 'block';
                if (descContainer) descContainer.style.display = 'block';
                if (publicContainer) publicContainer.style.display = 'block';
                if (saveChangesBtn) saveChangesBtn.style.display = 'block';
                if (sectionTitle) sectionTitle.textContent = sectionTitle.dataset.imageTitle;

                const imageId = Number(this.selectedNode.data.id);
                if (previewContainer && previewImg) {
                    previewContainer.style.display = 'block';
                    const timestamp = Date.now();
                    previewImg.src = (!isNaN(imageId) && imageId >= 0)
                        ? `/pictogramsmin/${imageId}?t=${timestamp}`
                        : `/pictogramsmin/${this.selectedNode.data.path}?t=${timestamp}`;
                }
                if (replaceContainer) {
                    replaceContainer.style.display = 'block';
                    if (replaceFileInput) replaceFileInput.value = '';
                    if (replaceFileChosen) replaceFileChosen.textContent = 'No file chosen';
                    if (replaceBtn) replaceBtn.disabled = true;
                }
                if (!isNaN(imageId) && imageId >= 0) {
                    this.loadImageUsage(imageId);
                }
                
                const descInput = document.getElementById('edit-image-description');
                if (descInput) descInput.value = this.selectedNode.data.description || '';
                
                const publicCheckbox = document.getElementById('edit-image-public');
                if (publicCheckbox) publicCheckbox.checked = !!this.selectedNode.data.is_public;
                
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.style.display = 'block';
                }
            } else if (this.selectedNode instanceof FolderNode) {
                if (exportBtn) exportBtn.disabled = true;
                if (editSection) editSection.style.display = 'block';
                if (descContainer) descContainer.style.display = 'none';
                if (publicContainer) publicContainer.style.display = 'none';
                if (saveChangesBtn) saveChangesBtn.style.display = 'none';
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                    if (previewImg) {
                        previewImg.removeAttribute('src');
                        previewImg.src = '';
                    }
                }
                if (replaceContainer) replaceContainer.style.display = 'none';
                if (sectionTitle) sectionTitle.textContent = sectionTitle.dataset.folderTitle;
                
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.style.display = 'block';
                }
            }
        } else {
            if (editSection) editSection.style.display = 'none';
            if (exportBtn) exportBtn.disabled = true;
            if (previewContainer) {
                previewContainer.style.display = 'none';
                if (previewImg) {
                    previewImg.removeAttribute('src');
                    previewImg.src = '';
                }
            }
            if (replaceContainer) replaceContainer.style.display = 'none';
        }

        this.updateImportSectionState();
    }

    deselectAllNodes() {
        if (this.selectedNode) {
            this.selectedNode.element.querySelector('.node-content').classList.remove('selected');
        }
        this.selectedNode = null;
        this.rootSelected = false;
        this.selectedImageThumbnail = null;
        document.getElementById('bank-delete-btn').disabled = true;
        document.getElementById('export-image-btn').disabled = true;
        document.getElementById('edit-image-section').style.display = 'none';
        const previewContainer = document.getElementById('edit-image-preview-container');
        if (previewContainer) {
            previewContainer.style.display = 'none';
            const previewImg = document.getElementById('edit-image-preview');
            if (previewImg) {
                previewImg.removeAttribute('src');
                previewImg.src = '';
            }
        }
        const replaceContainer = document.getElementById('replace-image-container');
        if (replaceContainer) replaceContainer.style.display = 'none';

        this.updateImportSectionState();
    }

    selectRoot() {
        this.deselectAllNodes();
        this.rootSelected = true;
        this.rootNode.element.querySelector('.node-content').classList.add('selected');
        this.selectedNode = this.rootNode;
        this.updateImportSectionState();
    }

    countItems(node) {
        let count = 1; // Count the node itself
        for (const child of node.children) {
            count += this.countItems(child);
        }
        return count;
    }

    async createFolder() {
        const totalItems = this.countItems(this.rootNode);
        const maxItems = window.MAX_ITEMS_LIMIT || 500;
        if (totalItems >= maxItems) {
            alert(`You have reached the maximum limit of ${maxItems} items (folders and images).`);
            return;
        }

        const folderNameInput = document.getElementById('new-folder-name');
        const name = folderNameInput.value.trim();
        if (!name) {
            alert('Please enter a folder name.');
            return;
        }

        let parentId;
        if (this.selectedNode && this.selectedNode instanceof FolderNode) {
            parentId = this.selectedNode.data.id;
        } else if (this.selectedNode && this.selectedNode instanceof ImageNode) {
            parentId = this.selectedNode.data.folder_id;
        }
        else {
            alert('Please select a parent folder.');
            return;
        }

        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
        try {
            const response = await fetch('/api/folder/create', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ name, parent_id: parentId }),
            });

            if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

            const result = await response.json();
            if (result.status === 'success') {
                const newFolderNode = new FolderNode(result.folder, this);
                this.addNodeToTree(newFolderNode, parentId);
                folderNameInput.value = '';
            } else {
                alert(`Error creating folder: ${result.message}`);
            }
        } catch (e) {
            console.error('Erreur création de dossier:', e);
            alert('La création a échoué. Vérifiez votre connexion.');
        }
    }

    async uploadImage() {
        const fileInput = document.getElementById('image-upload-file');
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a file to upload.');
            return;
        }

        const maxKb = window.MAX_IMAGE_SIZE_KB || 5000;
        if (file.size > maxKb * 1024) {
            alert(`The image size cannot exceed ${maxKb} KB.`);
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file type. Please upload a valid image file (.jpg, .jpeg, .png, .gif, .bmp, .webp).');
            return;
        }

        const isReplaceMode = this.selectedNode && (this.selectedNode instanceof ImageNode);

        if (isReplaceMode) {
            if (!confirm('Are you sure you want to replace this image? This action cannot be undone.')) {
                return;
            }

            const imageId = this.selectedNode.data.id;
            const descriptionInput = document.getElementById('image-description');
            const description = descriptionInput ? descriptionInput.value.trim() : '';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('description', description);

            const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
            const uploadBtn = document.getElementById('upload-image-btn');
            if (uploadBtn) uploadBtn.disabled = true;

            try {
                const response = await fetch(`/api/image/${imageId}/replace`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Erreur serveur: ${response.status}`);
                }

                const result = await response.json();
                if (result.status === 'success') {
                    this.selectedNode.data.path = result.image.path;
                    this.selectedNode.data.name = result.image.name;
                    this.selectedNode.data.description = result.image.description;
                    this.selectedNode.data.updated_at = result.image.updated_at;
                    this.selectedNode.data.image_hash = result.image.image_hash;

                    // Update image in the tree element with cache buster
                    const timestamp = Date.now();
                    const treeImg = this.selectedNode.element.querySelector('img');
                    if (treeImg) {
                        treeImg.src = `/pictogramsmin/${imageId}?t=${timestamp}`;
                    }
                    const treeSpan = this.selectedNode.element.querySelector('span');
                    if (treeSpan) {
                        treeSpan.textContent = result.image.name;
                    }

                    // Reset file input
                    fileInput.value = '';
                    const fileChosen = document.getElementById('file-chosen');
                    if (fileChosen) {
                        fileChosen.textContent = fileChosen.dataset.defaultText || 'No file chosen';
                    }

                    // Update the sidebar state
                    this.updateImportSectionState();

                    // Notify other tabs and components (Tree Builder, ImageTree, etc.)
                    window.dispatchEvent(new CustomEvent('pictogram:replaced', {
                        detail: {
                            imageId: Number(imageId),
                            name: result.image.name,
                            description: result.image.description,
                            path: result.image.path,
                            timestamp: timestamp
                        }
                    }));

                    alert(result.message || 'Image replaced successfully!');
                } else {
                    alert(`Error replacing image: ${result.message}`);
                }
            } catch (e) {
                console.error('Erreur remplacement image:', e);
                alert(e.message || 'Le remplacement a échoué. Vérifiez votre connexion.');
            } finally {
                if (uploadBtn) uploadBtn.disabled = false;
            }
            return;
        }

        // Standard Upload Mode (into folder)
        const totalItems = this.countItems(this.rootNode);
        const maxItems = window.MAX_ITEMS_LIMIT || 500;
        if (totalItems >= maxItems) {
            alert(`You have reached the maximum limit of ${maxItems} items (folders and images).`);
            return;
        }

        let parentId;
        if (this.selectedNode && this.selectedNode instanceof FolderNode) {
            parentId = this.selectedNode.data.id;
        } else {
            alert('Please select a parent folder.');
            return;
        }

        const descriptionInput = document.getElementById('image-description');
        const description = descriptionInput.value.trim();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', parentId);
        formData.append('description', description);

        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
        try {
            const response = await fetch('/api/image/upload', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData,
            });

            if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

            const result = await response.json();
            if (result.status === 'success') {
                const newImageNode = new ImageNode(result.image, this);
                this.addNodeToTree(newImageNode, parentId);
                fileInput.value = '';
                const fileChosen = document.getElementById('file-chosen');
                if (fileChosen) fileChosen.textContent = fileChosen.dataset.defaultText || 'No file chosen';
                if (descriptionInput) descriptionInput.value = '';
                this.updateImportSectionState();
            } else {
                alert(`Error uploading image: ${result.message}`);
            }
        } catch (e) {
            console.error('Erreur upload:', e);
            alert('Le téléchargement a échoué. Vérifiez votre connexion.');
        }
    }

    async deleteSelected() {
        if (!this.selectedNode) {
            alert('Please select an item to delete.');
            return;
        }

        if (confirm('Are you sure you want to delete the selected item? This action cannot be undone.')) {
            const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
            try {
                const response = await fetch('/api/item/delete', {
                    method: 'DELETE',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({ id: this.selectedNode.data.id, type: this.selectedNode.data.type }),
                });

                if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

                const result = await response.json();
                if (result.status === 'success') {
                    this.removeNodeFromTree(this.selectedNode);
                    this.deselectAllNodes();
                } else {
                    alert(`Error deleting item: ${result.message}`);
                }
            } catch (e) {
                console.error('Erreur suppression:', e);
                alert('La suppression a échoué. Vérifiez votre connexion.');
            }
        }
    }

    exportImage() {
        if (!this.selectedNode || !(this.selectedNode instanceof ImageNode)) {
            alert('Please select an image to export.');
            return;
        }

        const relativePath = this.selectedNode.data.path;
        const imageId = Number(this.selectedNode.data.id);
        const imageUrl = (relativePath && relativePath.startsWith('http')) ? relativePath : ((!isNaN(imageId) && imageId >= 0) ? `/pictograms/${imageId}` : `/pictograms/${relativePath}`);

        const link = document.createElement('a');
        link.href = imageUrl;
        const rawFilename = relativePath.split('/').pop() || 'image.png';
        link.download = rawFilename.replace(/[^a-zA-Z0-9.\-_]/g, ''); // Fix: Prevent malicious filename setups
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async saveImageChanges() {
        if (!this.selectedNode || !(this.selectedNode instanceof ImageNode)) {
            alert('Please select an image to save.');
            return;
        }

        const imageId = this.selectedNode.data.id;
        const description = document.getElementById('edit-image-description').value;

        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
        try {
            const response = await fetch(`/api/image/${imageId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    description: description,
                }),
            });

            if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

            const result = await response.json();
            if (result.status === 'success') {
                this.selectedNode.data.description = result.image.description;
                this.selectedNode.data.is_public = result.image.is_public;
                alert('Image updated successfully!');
            } else {
                alert(`Error updating image: ${result.message}`);
            }
        } catch (e) {
            console.error('Erreur modification:', e);
            alert('La modification a échoué. Vérifiez votre connexion.');
        }
    }

    async loadImageUsage(imageId) {
        const usageContainer = document.getElementById('edit-image-usage');
        if (!usageContainer) return;
        usageContainer.textContent = '...';
        try {
            const response = await fetch(`/api/image/${imageId}/usage`);
            if (!response.ok) {
                usageContainer.textContent = '';
                return;
            }
            const result = await response.json();
            if (result.status === 'success') {
                usageContainer.textContent = '';
                if (result.count === 0) {
                    usageContainer.textContent = '🌱 Non utilisé dans vos arbres';
                } else {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-secondary mb-1';
                    badge.textContent = `🌳 Utilisé dans ${result.count} arbre(s)`;
                    usageContainer.appendChild(badge);

                    const div = document.createElement('div');
                    div.className = 'text-truncate';
                    div.textContent = result.trees.map(t => t.name).join(', ');
                    usageContainer.appendChild(div);
                }
            }
        } catch {
            usageContainer.textContent = '';
        }
    }

    async replaceImageFile() {
        if (!this.selectedNode || !(this.selectedNode instanceof ImageNode)) {
            alert('Veuillez sélectionner une image à remplacer.');
            return;
        }

        const fileInput = document.getElementById('replace-image-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert('Veuillez choisir un nouveau fichier image.');
            return;
        }

        const file = fileInput.files[0];
        const maxBytes = (window.MAX_IMAGE_SIZE_KB || 5000) * 1024;
        if (file.size > maxBytes) {
            alert(`Le fichier dépasse la taille maximale autorisée (${window.MAX_IMAGE_SIZE_KB || 5000} KB).`);
            return;
        }

        const imageId = this.selectedNode.data.id;
        const formData = new FormData();
        formData.append('file', file);

        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
        const replaceBtn = document.getElementById('replace-image-btn');
        if (replaceBtn) replaceBtn.disabled = true;

        try {
            const response = await fetch(`/api/image/${imageId}/replace`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Erreur serveur: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                this.selectedNode.data.path = result.image.path;
                this.selectedNode.data.name = result.image.name;
                this.selectedNode.data.updated_at = result.image.updated_at;
                this.selectedNode.data.image_hash = result.image.image_hash;

                // Update preview image with cache buster
                const previewImg = document.getElementById('edit-image-preview');
                const timestamp = Date.now();
                if (previewImg) {
                    previewImg.src = `/pictogramsmin/${imageId}?t=${timestamp}`;
                }
                // Update image in the tree element
                const treeImg = this.selectedNode.element.querySelector('img');
                if (treeImg) {
                    treeImg.src = `/pictogramsmin/${imageId}?t=${timestamp}`;
                }

                // Reset file input
                fileInput.value = '';
                const replaceFileChosen = document.getElementById('replace-file-chosen');
                if (replaceFileChosen) replaceFileChosen.textContent = 'No file chosen';

                // Notify other tabs and components (Tree Builder, ImageTree, etc.)
                window.dispatchEvent(new CustomEvent('pictogram:replaced', {
                    detail: {
                        imageId: Number(imageId),
                        name: result.image.name,
                        description: this.selectedNode.data.description || '',
                        path: result.image.path,
                        timestamp: timestamp
                    }
                }));

                alert(result.message || 'Image remplacée avec succès !');
            } else {
                alert(`Erreur lors du remplacement : ${result.message}`);
            }
        } catch (e) {
            console.error('Erreur remplacement image:', e);
            alert(e.message || 'Le remplacement a échoué. Vérifiez votre connexion.');
        } finally {
            if (replaceBtn) replaceBtn.disabled = false;
        }
    }

    addNodeToTree(newNode, parentId) {
        const parentNode = this.findNodeById(this.rootNode, parentId);
        if (parentNode) {
            parentNode.children.push(newNode);
            this.renderTree();
        }
    }

    removeNodeFromTree(nodeToRemove) {
        const removeChild = (parent) => {
            const originalLength = parent.children.length;
            parent.children = parent.children.filter(child => child.data.id !== nodeToRemove.data.id || child.data.type !== nodeToRemove.data.type);
            if (parent.children.length < originalLength) {
                return true;
            }
            for (const child of parent.children) {
                if (child.children && child.children.length > 0) {
                    if (removeChild(child)) {
                        return true;
                    }
                }
            }
            return false;
        };

        removeChild(this.rootNode);
        this.renderTree();
    }

    findNodeById(node, id) {
        if (node.data.id === id) {
            return node;
        }
        for (const child of node.children) {
            const found = this.findNodeById(child, id);
            if (found) {
                return found;
            }
        }
        return null;
    }

    renderTree() {
        this.display.innerHTML = '';
        this.display.appendChild(this.rootNode.element);
        this.renderChildren(this.rootNode);
    }

    renderChildren(node) {
        const oldContainer = node.element.querySelector('.children');
        if (oldContainer) {
            oldContainer.remove();
        }

        if (node.children.length === 0) {
            return;
        }

        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('children');
        node.children.forEach(child => {
            childrenContainer.appendChild(child.element);
            this.renderChildren(child);
        });
        node.element.appendChild(childrenContainer);
    }

    async refresh() {
        const refreshBtn = document.getElementById('bank-refresh-btn');
        if (refreshBtn) {
            refreshBtn.classList.add('spin');
        }

        try {
            const response = await fetch('/api/pictograms');
            if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
            
            const newData = await response.json();
            this.initialData = newData;
            
            this.deselectAllNodes();
            
            this.rootNode = new FolderNode(this.initialData, this);
            this.renderTree();
        } catch (e) {
            console.error('Erreur lors du rafraîchissement de la banque:', e);
            alert('Le rafraîchissement a échoué. Vérifiez votre connexion.');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('spin');
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PictogramBank();
});
