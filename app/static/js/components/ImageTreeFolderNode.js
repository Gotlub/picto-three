import ImageTreeNode from './ImageTreeNode.js';

export default class ImageTreeFolderNode extends ImageTreeNode {
    constructor(data, imageTree, childrenData, nodeTypes) {
        super(data, imageTree);
        this.expanded = false;
        this.children = [];
        this.childrenData = childrenData;
        this.nodeTypes = nodeTypes; // { FOLDER: class, IMAGE: class }
        this.initElement();
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

        // Add refresh button next to folder name
        const refreshBtn = document.createElement('i');
        refreshBtn.classList.add('bi', 'bi-arrow-clockwise', 'refresh-btn', 'ms-2');
        refreshBtn.setAttribute('title', 'Refresh folder');
        refreshBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.refresh();
        });
        contentElement.appendChild(refreshBtn);

        nodeElement.appendChild(contentElement);

        this.childrenContainer = document.createElement('div');
        this.childrenContainer.classList.add('children');
        this.childrenContainer.style.display = 'none';
        nodeElement.appendChild(this.childrenContainer);

        contentElement.addEventListener('click', () => this.toggle());

        this.buildChildrenFromData(); // Build children immediately

        // Prevent dragging folders
        nodeElement.setAttribute('draggable', 'false');

        return nodeElement;
    }

    async expand() {
        this.expanded = true;
        this.icon.src = '/static/images/folder-open-bold.png';
        this.childrenContainer.style.display = '';
    }

    async toggle() {
        if (this.expanded) {
            this.expanded = false;
            this.icon.src = '/static/images/folder-bold.png';
            this.childrenContainer.style.display = 'none';
        } else {
            await this.expand();

            // Lazy load images on first expand
            if (!this.imagesLoaded) {
                await this.refresh();
            } else {
                // Load images that are visible
                this.children.forEach(child => {
                    if (child instanceof this.nodeTypes.IMAGE) {
                        child.load();
                    }
                });
            }
        }
    }

    async refresh() {
        if (this.refreshing) return;
        this.refreshing = true;

        const refreshBtn = this.element.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.classList.add('spin');
        }

        let loadingInfo = null;
        if (this.children.length === 0) {
            loadingInfo = document.createElement('div');
            loadingInfo.classList.add('image-tree-node', 'info');
            loadingInfo.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
            this.childrenContainer.appendChild(loadingInfo);
        }

        try {
            // Keep track of which subfolders were expanded so we can recursively restore and refresh them
            const expandedFolderIds = new Set(
                this.children
                    .filter(child => child instanceof this.nodeTypes.FOLDER && child.expanded)
                    .map(child => child.data.id)
            );

            const response = await fetch(`/api/folder/contents?parent_id=${this.data.id}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch contents for folder ${this.data.id}`);
            }

            const items = await response.json();

            if (loadingInfo) {
                loadingInfo.remove();
                loadingInfo = null;
            }

            this.childrenContainer.replaceChildren();
            this.children = [];

            for (const item of items) {
                let childNode;
                if (item.type === 'folder') {
                    childNode = new this.nodeTypes.FOLDER(item, this.imageTree, [], this.nodeTypes);
                } else if (item.type === 'image') {
                    childNode = new this.nodeTypes.IMAGE(item, this.imageTree);
                }

                if (childNode) {
                    childNode.parent = this;
                    this.children.push(childNode);
                    this.childrenContainer.appendChild(childNode.element);
                }
            }

            this.imagesLoaded = true;

            if (this.children.length === 0) {
                const noItems = document.createElement('div');
                noItems.classList.add('image-tree-node', 'info');
                noItems.textContent = 'Empty folder';
                this.childrenContainer.appendChild(noItems);
            } else {
                this.children.forEach(child => {
                    if (child instanceof this.nodeTypes.IMAGE) {
                        child.load();
                    }
                });
            }

            // Recursively refresh child folders that were expanded
            for (const childNode of this.children) {
                if (childNode instanceof this.nodeTypes.FOLDER && expandedFolderIds.has(childNode.data.id)) {
                    await childNode.expand();
                    await childNode.refresh();
                }
            }

        } catch (e) {
            console.error("Failed to refresh folder:", e);
            if (loadingInfo) {
                loadingInfo.remove();
            }
            if (this.children.length === 0) {
                this.imagesLoaded = false; // allow retry
            }
        } finally {
            this.refreshing = false;
            if (refreshBtn) {
                refreshBtn.classList.remove('spin');
            }
        }
    }

    buildChildrenFromData() {
        if (this.children.length > 0) return; // Already built

        if (this.childrenData && this.childrenData.length > 0) {
            this.childrenData.forEach(childData => {
                let childNode;
                if (childData.type === 'folder') {
                    childNode = new this.nodeTypes.FOLDER(childData.data, this.imageTree, childData.children, this.nodeTypes);
                } else { // type === 'image'
                    childNode = new this.nodeTypes.IMAGE(childData.data, this.imageTree);
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
            //console.log(child);
            if (child.filter(term, visibleNodes)) {
                childrenMatch = true;
            }
        });

        const match = nameMatch || childrenMatch;

        if (match) {
            this.element.style.display = '';
            visibleNodes.add(this);
        } else {
            this.element.style.display = 'none';
        }
        return match;
    }
}
