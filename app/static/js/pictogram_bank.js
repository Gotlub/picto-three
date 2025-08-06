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
        icon.src = '/static/images/pictograms/public/bold/folder-bold.png'; // As requested
        contentElement.appendChild(icon);

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

class ImageNode extends BaseNode {
    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node', 'image-node');
        nodeElement.dataset.id = this.data.id;

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        const newSrc = this.data.path.slice(4);
        console.log(`Original path: ${this.data.path}, New src: ${newSrc}`);
        imgElement.src = newSrc;
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
        this.initialData = JSON.parse(document.getElementById('pictogram-data').textContent);

        this.rootNode = new FolderNode(this.initialData, this);
        this.selectedNode = null;
        this.rootSelected = false;

        this.initEventListeners();
        this.renderTree();
    }

    initEventListeners() {
        document.getElementById('create-folder-btn').addEventListener('click', () => this.createFolder());
        document.getElementById('upload-image-btn').addEventListener('click', () => this.uploadImage());
        document.getElementById('delete-btn').addEventListener('click', () => this.deleteSelected());
        document.getElementById('root-btn').addEventListener('click', () => this.selectRoot());
        document.getElementById('export-image-btn').addEventListener('click', () => this.exportImage());

        this.display.addEventListener('click', (e) => {
            if (e.target === this.display) {
                this.deselectAllNodes();
            }
        });
    }

    selectNode(node) {
        this.deselectAllNodes();
        this.selectedNode = node;
        if (this.selectedNode) {
            this.selectedNode.element.querySelector('.node-content').classList.add('selected');
        }

        document.getElementById('delete-btn').disabled = this.selectedNode.data.parent_id === null; // Cannot delete root
        const exportBtn = document.getElementById('export-image-btn');
        exportBtn.disabled = !(this.selectedNode instanceof ImageNode);
    }

    deselectAllNodes() {
        if (this.selectedNode) {
            this.selectedNode.element.querySelector('.node-content').classList.remove('selected');
        }
        this.selectedNode = null;
        this.rootSelected = false;
        document.getElementById('delete-btn').disabled = true;
        document.getElementById('export-image-btn').disabled = true;
    }

    selectRoot() {
        this.deselectAllNodes();
        this.rootSelected = true;
        this.rootNode.element.querySelector('.node-content').classList.add('selected');
        this.selectedNode = this.rootNode;
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
        console.log(`Total items before creation: ${totalItems}`);
        if (totalItems >= 500) {
            alert('You have reached the maximum limit of 500 items (folders and images).');
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

        const response = await fetch('/api/folder/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parent_id: parentId }),
        });

        const result = await response.json();
        if (result.status === 'success') {
            const newFolderNode = new FolderNode(result.folder, this);
            this.addNodeToTree(newFolderNode, parentId);
            folderNameInput.value = '';
        } else {
            alert(`Error creating folder: ${result.message}`);
        }
    }

    async uploadImage() {
        const totalItems = this.countItems(this.rootNode);
        console.log(`Total items before upload: ${totalItems}`);
        if (totalItems >= 500) {
            alert('You have reached the maximum limit of 500 items (folders and images).');
            return;
        }

        const fileInput = document.getElementById('image-upload-file');
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a file to upload.');
            return;
        }

        if (file.size > 500 * 1024) {
            alert('The image size cannot exceed 500 KB.');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file type. Please upload a valid image file (.jpg, .jpeg, .png, .gif, .bmp, .webp).');
            return;
        }

        let parentId;
        if (this.selectedNode && this.selectedNode instanceof FolderNode) {
            parentId = this.selectedNode.data.id;
        } else if (this.selectedNode && this.selectedNode instanceof ImageNode) {
            parentId = this.selectedNode.data.folder_id;
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

        const response = await fetch('/api/image/upload', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        if (result.status === 'success') {
            const newImageNode = new ImageNode(result.image, this);
            this.addNodeToTree(newImageNode, parentId);
            fileInput.value = '';
        } else {
            alert(`Error uploading image: ${result.message}`);
        }
    }

    async deleteSelected() {
        if (!this.selectedNode) {
            alert('Please select an item to delete.');
            return;
        }

        if (confirm('Are you sure you want to delete the selected item? This action cannot be undone.')) {
            const response = await fetch('/api/item/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: this.selectedNode.data.id, type: this.selectedNode.data.type }),
            });

            const result = await response.json();
            if (result.status === 'success') {
                window.location.href = '/pictogram-bank';
            } else {
                alert(`Error deleting item: ${result.message}`);
            }
        }
    }

    exportImage() {
        if (!this.selectedNode || !(this.selectedNode instanceof ImageNode)) {
            alert('Please select an image to export.');
            return;
        }

        const imagePath = this.selectedNode.data.path.slice(4);
        console.log(`Exporting image with path: ${imagePath}`);
        const link = document.createElement('a');
        link.href = imagePath;
        link.download = imagePath;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    addNodeToTree(newNode, parentId) {
        const parentNode = this.findNodeById(this.rootNode, parentId);
        if (parentNode) {
            parentNode.children.push(newNode);
            this.renderTree();
        }
    }

    removeNodeFromTree(nodeToRemove) {
        const parentNode = this.findNodeById(this.rootNode, nodeToRemove.data.parent_id);
        if (parentNode) {
            parentNode.children = parentNode.children.filter(child => child.data.id !== nodeToRemove.data.id);
            this.renderTree();
        }
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
        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('children');
        node.children.forEach(child => {
            childrenContainer.appendChild(child.element);
            if (child.children.length > 0) {
                this.renderChildren(child);
            }
        });
        node.element.appendChild(childrenContainer);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PictogramBank();
});
