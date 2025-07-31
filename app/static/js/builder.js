document.addEventListener('DOMContentLoaded', function() {
    const imageSidebar = document.getElementById('image-sidebar');
    const treeDisplay = document.getElementById('tree-display');

    // The images data is embedded in the HTML
    const imagesData = JSON.parse(document.getElementById('images-data').textContent);

    console.log('Builder script loaded.');
    console.log('Image data:', imagesData);
    console.log('Image sidebar element:', imageSidebar);
    console.log('Tree display element:', treeDisplay);

    // The rest of the logic for the tree builder will go here.

    /**
     * Represents a node in the tree. (Composite Pattern: Component)
     * Each node can have children, which are also Node objects.
     */
    class Node {
        /**
         * @param {object} image - The image data associated with this node.
         * @param {Node|null} parent - The parent node. Null for the root.
         */
        constructor(image, parent = null) {
            this.image = image;
            this.parent = parent;
            this.children = [];
            this.element = this.createElement(); // The HTML element for this node
        }

        /**
         * Adds a child node to this node.
         * @param {Node} node - The child node to add.
         */
        addChild(node) {
            this.children.push(node);
        }

        /**
         * Removes a child node from this node.
         * @param {Node} node - The child node to remove.
         */
        removeChild(node) {
            this.children = this.children.filter(child => child !== node);
        }

        /**
         * Creates the HTML element for this node.
         * @returns {HTMLElement}
         */
        createElement() {
            const div = document.createElement('div');
            div.classList.add('node');

            if (this.image) {
                const img = document.createElement('img');
                img.src = this.image.path;
                img.alt = this.image.name;
                img.title = this.image.name;
                img.dataset.imageId = this.image.id;
                div.appendChild(img);
            } else {
                // Placeholder for root or empty nodes
                div.classList.add('node-placeholder');
                div.textContent = '+';
            }

            return div;
        }
    }

    /**
     * Manages the entire tree structure. (Composite Pattern: Composite)
     */
    class Tree {
        /**
         * @param {HTMLElement} displayElement - The HTML element where the tree will be rendered.
         */
        constructor(displayElement) {
            this.root = new Node(null); // The root node is a placeholder without an image
            this.displayElement = displayElement;
            this.selectedNode = this.root;
        }

        /**
         * Renders the entire tree from the root.
         */
        render() {
            this.displayElement.innerHTML = ''; // Clear the current display
            const rootElement = this.renderNode(this.root);
            this.displayElement.appendChild(rootElement);
        }

        /**
         * Recursively renders a node and its children.
         * @param {Node} node - The node to render.
         * @returns {HTMLElement}
         */
        renderNode(node) {
            const nodeContainer = document.createElement('div');
            nodeContainer.classList.add('node-container');

            // Add the node's own element (the image or placeholder)
            nodeContainer.appendChild(node.element);

            // Create a container for the children and render them
            if (node.children.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.classList.add('children-container');
                node.children.forEach(child => {
                    const childElement = this.renderNode(child);
                    childrenContainer.appendChild(childElement);
                });
                nodeContainer.appendChild(childrenContainer);
            }

            return nodeContainer;
        }
    }

    // --- Main ---
    const pictogramTree = new Tree(treeDisplay);
    pictogramTree.render();
});
