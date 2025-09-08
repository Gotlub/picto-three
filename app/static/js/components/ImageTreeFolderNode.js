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


    toggle() {
        this.expanded = !this.expanded;
        if (this.expanded) {
            this.icon.src = '/static/images/folder-open-bold.png';
            this.childrenContainer.style.display = '';
            // Lazy load images
            this.children.forEach(child => {
                if (child instanceof this.nodeTypes.IMAGE) {
                    child.load();
                }
            });
        } else {
            this.icon.src = '/static/images/folder-bold.png';
            this.childrenContainer.style.display = 'none';
        }
    }

    buildChildrenFromData() {
        if (this.children.length > 0) return; // Already built

        if (this.childrenData.length === 0) {
            const noItems = document.createElement('div');
            noItems.classList.add('image-tree-node', 'info');
            noItems.textContent = 'Empty folder';
            this.childrenContainer.appendChild(noItems);
        } else {
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
            if (child.filter(term, visibleNodes)) {
                childrenMatch = true;
            }
        });

        let refMatch = false;
        if (this.children.length === 0) {
            refMatch = this.imageRefs.some(img => img.name.toLowerCase().includes(term));
        }

        const match = nameMatch || childrenMatch || refMatch;

        if (match) {
            this.element.style.display = '';
            visibleNodes.add(this);
        } else {
            this.element.style.display = 'none';
        }
        return match;
    }
}
