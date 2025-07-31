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
        const imgElement = document.createElement('img');
        imgElement.src = this.image.path;
        imgElement.alt = this.image.name;
        nodeElement.appendChild(imgElement);
        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling to parent nodes
            builder.selectNode(this);
        });
        return nodeElement;
    }
}

class TreeBuilder {
    constructor() {
        this.imageSidebar = document.getElementById('image-sidebar');
        this.treeDisplay = document.getElementById('tree-display');
        this.images = JSON.parse(document.getElementById('images-data').textContent);
        this.root = null;
        this.selectedNode = null;
        this.init();
    }

    init() {
        this.images.forEach(image => {
            const imgElement = document.createElement('img');
            imgElement.src = image.path;
            imgElement.alt = image.name;
            imgElement.dataset.imageId = image.id;
            // The existing code in builder.html already adds the images to the sidebar,
            // so we don't need to append them again. We just need to add the event listeners.
            const existingImg = this.imageSidebar.querySelector(`[data-image-id='${image.id}']`);
            if (existingImg) {
                existingImg.addEventListener('click', () => this.handleImageClick(image));
            }
        });
    }

    handleImageClick(image) {
        const newNode = new Node(image, this);
        if (!this.root) {
            this.root = newNode;
            this.selectNode(this.root);
        } else if (this.selectedNode) {
            this.selectedNode.addChild(newNode);
            this.selectNode(newNode);
        }
        this.renderTree();
    }

    selectNode(node) {
        if (this.selectedNode) {
            this.selectedNode.element.classList.remove('selected');
        }
        this.selectedNode = node;
        this.selectedNode.element.classList.add('selected');
    }

    renderTree() {
        this.treeDisplay.innerHTML = '';
        if (this.root) {
            this.treeDisplay.appendChild(this.root.element);
            this.renderChildren(this.root, this.root.element);
            if (this.selectedNode) {
                this.selectedNode.element.classList.add('selected');
            }
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
}

document.addEventListener('DOMContentLoaded', () => {
    new TreeBuilder();
});
