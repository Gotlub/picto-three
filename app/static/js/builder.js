// --- Start of new Image Tree for Right Sidebar ---

class ImageTreeNode {
    constructor(data, imageTree) {
        this.data = data;
        this.imageTree = imageTree;
        this.element = this.createElement();
        this.children = [];
        this.parent = null;
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

        return nodeElement;
    }

    toggle() {
        this.expanded = !this.expanded;
        if (this.expanded) {
            this.icon.src = '/static/images/folder-open-bold.png';
            this.childrenContainer.style.display = '';
            if (!this.childrenLoaded) {
                this.loadChildren();
            }
        } else {
            this.icon.src = '/static/images/folder-bold.png';
            this.childrenContainer.style.display = 'none';
        }
    }

    async loadChildren() {
        if (this.childrenLoaded) return;

        const response = await fetch(`/api/folder/contents?parent_id=${this.data.id}`);
        const childrenData = await response.json();

        this.childrenLoaded = true;
        this.childrenContainer.innerHTML = ''; // Clear any loading indicator

        if (childrenData.length === 0) {
            const noItems = document.createElement('div');
            noItems.classList.add('image-tree-node', 'info');
            noItems.textContent = 'Empty folder';
            this.childrenContainer.appendChild(noItems);
        } else {
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

    filter(term, visibleNodes) {
        const nameMatch = this.data.name.toLowerCase().includes(term);
        let childrenMatch = false;

        this.children.forEach(child => {
            if (child.filter(term, visibleNodes)) {
                childrenMatch = true;
            }
        });

        if (nameMatch || childrenMatch) {
            this.element.style.display = '';
            visibleNodes.add(this);
            if (childrenMatch && !this.expanded) {
                 this.toggle();
            }
        } else {
            this.element.style.display = 'none';
        }
        return nameMatch || childrenMatch;
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
        // The path from the backend is now relative to the pictograms folder,
        // so we build the URL for the new pictogram-serving endpoint.
        imgElement.src = `/pictograms/${this.data.path}`;
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

        contentElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.imageTree.onImageClick(this.data);
        });

        return nodeElement;
    }

    filter(term, visibleNodes) {
        const nameMatch = this.data.name.toLowerCase().includes(term);
        if (nameMatch) {
            this.element.style.display = '';
            visibleNodes.add(this);
        } else {
            this.element.style.display = 'none';
        }
        return nameMatch;
    }
}

class ImageTree {
    constructor(containerId, initialData, onImageClick) {
        this.container = document.getElementById(containerId);
        this.initialData = initialData;
        this.onImageClick = onImageClick;
        this.rootNodes = [];
        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.initialData.forEach(data => {
            const theNode = new ImageTreeFolderNode(data, this);
            this.rootNodes.push(theNode);
            this.container.appendChild(theNode.element);
        });
    }

    filter(term) {
        const visibleNodes = new Set();
        this.rootNodes.forEach(theNode => theNode.filter(term.toLowerCase(), visibleNodes));
    }
}


// --- End of new Image Tree for Right Sidebar ---


class BuilderNode {
    constructor(image, builder) {
        this.image = image;
        this.builder = builder;
        this.children = [];
        this.parent = null;
        this.description = image.description || '';
        this.element = this.createElement(builder);
    }

    addChild(theNode) {
        theNode.parent = this;
        this.children.push(theNode);
    }

    createElement(builder) {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node');
        nodeElement.setAttribute('draggable', this.image.id !== 'root');

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        if (this.image.path) {
            // Path can be a new relative path (e.g., 'public/foo.png')
            // or an absolute URL for the root node icon (e.g., '/pictograms/public/...')
            if (this.image.path.startsWith('/')) {
                imgElement.src = this.image.path; // It's already a full URL
            } else {
                imgElement.src = `/pictograms/${this.image.path}`; // It's a relative path
            }
        }
        imgElement.alt = this.image.name;


        // Add tooltip events
        imgElement.addEventListener('mouseover', (e) => {
            tooltip.show(e, imgElement.src);
        });
        imgElement.addEventListener('mouseout', (e) => {
            tooltip.hide(e);
        });

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
            builder.selectNode(this);
        });

        // Drag and Drop event listeners
        nodeElement.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            builder.handleDragStart(e, this);
        });
        nodeElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            builder.handleDragOver(e, this);
        });
        nodeElement.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            builder.handleDragLeave(e, this);
        });
        nodeElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            builder.handleDrop(e, this);
        });
        nodeElement.addEventListener('dragend', (e) => {
            e.stopPropagation();
            builder.handleDragEnd(e, this);
        });

        return nodeElement;
    }
}

class TreeBuilder {
    constructor() {
        this.imageSearch = document.getElementById('image-search');
        this.treeDisplay = document.getElementById('tree-display');
        this.leftSidebar = document.querySelector('.col-md-2.sidebar');
        this.rightSidebar = document.querySelector('.col-md-3.sidebar');
        this.treeList = document.getElementById('tree-list');
        this.visualizeTreeBtn = document.getElementById('visualize-tree-btn');
        this.treeVisualizerModal = document.getElementById('tree-visualizer-modal');
        this.exportPdfBtn = document.getElementById('export-pdf-btn');
        this.closeVisualizeBtn = document.getElementById('close-visualizer-btn');
        this.closeVisualizeXBtn = document.getElementById('close-visualizer-x-btn');
        this.nodeDescriptionTextarea = document.getElementById('node-description');
        this.images = JSON.parse(document.getElementById('images-data').textContent);
        this.savedTrees = [];
        this.rootNode = new BuilderNode({ id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' }, this);
        this.selectedNode = null;
        this.draggedNode = null;

        // Zoom & Pan state variables
        this.scale = 1;
        this.panning = false;
        this.pointX = 0;
        this.pointY = 0;
        this.start = { x: 0, y: 0 };

        if (this.nodeDescriptionTextarea) {
            this.nodeDescriptionTextarea.disabled = true;
            this.nodeDescriptionTextarea.addEventListener('input', () => {
                if (this.selectedNode) {
                    this.selectedNode.description = this.nodeDescriptionTextarea.value;
                }
            });
        }

        // New Image Tree initialization
        const initialTreeData = JSON.parse(document.getElementById('initial-tree-data').textContent);
        this.imageTree = new ImageTree('image-sidebar-tree', initialTreeData, (image) => this.handleImageClick(image));

        document.addEventListener('click', (e) => {
            const deleteBtn = document.getElementById('delete-btn');
            const isClickOnDelete = deleteBtn ? deleteBtn.contains(e.target) : false;
            const isClickInsideTree = this.treeDisplay.contains(e.target);
            const isClickInsideDescription = this.nodeDescriptionTextarea ? this.nodeDescriptionTextarea.contains(e.target) : false;
            const isClickInsideDropdown = e.target.closest('.dropdown');

            // If the click is inside any of the builder's interactive areas or a dropdown menu, do nothing.
            if (isClickOnDelete || isClickInsideTree || isClickInsideDescription || isClickInsideDropdown) {
                return;
            }

            // Otherwise, deselect any selected node.
            this.deselectAllNodes();
        });

        const saveBtn = document.getElementById('save-tree-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveTree());
        }

        const importBtn = document.getElementById('import-json-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importTreeFromJSON());
        }

        const exportBtn = document.getElementById('export-json-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportTreeToJSON());
        }

        const loadBtn = document.getElementById('load-tree-btn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadTree());
        }

        if (this.imageSearch) {
            this.imageSearch.addEventListener('input', () => this.filterImages());
        }

        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteSelectedNode());
        }

        const newTreeBtn = document.getElementById('new-tree-btn');
        if (newTreeBtn) {
            newTreeBtn.addEventListener('click', (e) => {
                if (this.rootNode.children.length > 0) {
                    if (confirm('You have an unsaved tree. Are you sure you want to leave?')) {
                        window.location.href = '/builder';
                    }
                } else {
                    window.location.href = '/builder';
                }
            });
        }

        this.treeSearch = document.getElementById('tree-search');
        if (this.treeSearch) {
            this.treeSearch.addEventListener('input', () => this.filterTrees());
        }

        if (this.visualizeTreeBtn) {
            this.visualizeTreeBtn.addEventListener('click', () => {
                // The actual drawing is triggered by the modal's 'shown' event
                const modal = new bootstrap.Modal(this.treeVisualizerModal);
                modal.show();
            });
        }

        if (this.treeVisualizerModal) {
            this.treeVisualizerModal.addEventListener('shown.bs.modal', () => {
                // --- DESTRUCTION ET NETTOYAGE ---
                if (this.treantChart) {
                    this.treantChart.destroy();
                }
                const canvas = document.getElementById('tree-canvas');
                if (canvas) {
                    canvas.innerHTML = '';
                }

                // Reset zoom and pan state each time the modal is opened
                this.scale = 1;
                this.panning = false;
                this.pointX = 0;
                this.pointY = 0;
                this.start = { x: 0, y: 0 };

                // Recréer l'arbre
                this.drawTreeVisualization();
            });
        }

        if (this.closeVisualizeBtn) {
            this.closeVisualizeBtn.addEventListener('click', this.reloadBuilderWithCurrentTree.bind(this));
        }

        if (this.closeVisualizeXBtn) {
            this.closeVisualizeXBtn.addEventListener('click', this.reloadBuilderWithCurrentTree.bind(this));
        }

        this.loadSavedTrees();
        this.updateVisualizeButtonState();

        const viewportContainer = document.querySelector('#tree-visualizer-container');
        if (viewportContainer) {
            let scrollTimeout;
            viewportContainer.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(this.resizeAndCenterTree.bind(this), 150);
            });
        }

        this.initPanAndZoom();

        const treeDataFromPostElement = document.getElementById('tree-data-from-post');
        if (treeDataFromPostElement && treeDataFromPostElement.textContent) {
            try {
                const treeData = JSON.parse(treeDataFromPostElement.textContent);
                if (treeData) {
                    this.rebuildTreeFromJSON(treeData);
                }
            } catch (e) {
                console.error("Could not parse tree_data_from_post", e);
            }
        }

        // Use event delegation for the export button, as it's in a modal
        $(document).on('click', '#export-pdf-vectoriel', async function () {
            const btn = $(this);
            btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Exporting...');

            try {
                await exportToVectorPdf();
            } catch (error) {
                console.error("Erreur lors de l'export PDF:", error);
                alert("L'export PDF a échoué. Cause : " + error.message);
            } finally {
                btn.prop('disabled', false).html('Export to PDF');
            }
        });
    }

    resizeAndCenterTree() {
        const canvas = document.getElementById("tree-canvas");
        const treantContainer = canvas.querySelector(".Treant");
        const viewport = document.getElementById("tree-visualizer-container");

        if (!canvas || !treantContainer || !viewport) return;

        const nodes = treantContainer.querySelectorAll('.treant-node');
        if (nodes.length === 0) return;

        // 1. Find the real dimensions of the tree content
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        nodes.forEach(node => {
            const nodeLeft = node.offsetLeft;
            const nodeTop = node.offsetTop;
            const nodeRight = nodeLeft + node.offsetWidth;
            const nodeBottom = nodeTop + node.offsetHeight;

            if (nodeLeft < minX) minX = nodeLeft;
            if (nodeTop < minY) minY = nodeTop;
            if (nodeRight > maxX) maxX = nodeRight;
            if (nodeBottom > maxY) maxY = nodeBottom;
        });
        const treeWidth = maxX - minX;
        const treeHeight = maxY - minY;

        // 2. Get the dimensions of the visible area (the viewport)
        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        const padding = 30;

        // 3. Set the canvas size
        // It must be at least the size of the viewport, or larger if the tree is larger.
        const canvasWidth = Math.max(treeWidth + padding, viewportWidth);
        const canvasHeight = Math.max(treeHeight + padding, viewportHeight);
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';

        // 4. Calculate the offset to center the tree and set state
        // This positions the top-left of the tree content inside the canvas.
        let offsetX = -minX + (padding / 2);
        let offsetY = -minY + (padding / 2);

        // If the tree is smaller than the viewport, add an offset to center it.
        if (treeWidth < viewportWidth) {
            offsetX += (viewportWidth - treeWidth) / 2;
        }
        if (treeHeight < viewportHeight) {
            offsetY += (viewportHeight - treeHeight) / 2;
        }

        this.pointX = offsetX;
        this.pointY = offsetY;
        this.scale = 1; // Reset scale on recenter/redraw

        this.setTransform();
    }

    setTransform() {
        const canvas = document.getElementById('tree-canvas');
        if (canvas) {
            canvas.style.transformOrigin = '0 0';
            canvas.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
        }
    }

    initPanAndZoom() {
        const treeContainer = document.getElementById('tree-visualizer-container');
        if (!treeContainer) return;

        treeContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                const newScale = Math.min(Math.max(0.5, this.scale + delta), 4);
                this.scale = newScale;
                this.setTransform();
            }
        });

        treeContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.panning = true;
            this.start = { x: e.clientX - this.pointX, y: e.clientY - this.pointY };
            treeContainer.style.cursor = 'grabbing';
        });

        window.addEventListener('mouseup', () => {
            this.panning = false;
            treeContainer.style.cursor = 'grab';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.panning) return;
            this.pointX = (e.clientX - this.start.x);
            this.pointY = (e.clientY - this.start.y);
            this.setTransform();
        });

        // Set initial cursor
        treeContainer.style.cursor = 'grab';
    }

    updateVisualizeButtonState() {
        if (this.visualizeTreeBtn) {
            this.visualizeTreeBtn.disabled = this.rootNode.children.length === 0;
        }
    }

    getTreeForVisualization() {
        const buildTreantNode = (builderNode) => {
            const treantNode = {
                text: { name: builderNode.image.name },
                image: builderNode.image.path.startsWith('/') ? builderNode.image.path : `/pictograms/${builderNode.image.path}`,
                children: []
            };

            // To include the description in the node, we can use innerHTML
            // The 'name' from the text property will be the title attribute of the container div
            const description = builderNode.description || builderNode.image.name;
            treantNode.innerHTML = `
                <div class="node-content-wrapper">
                    <img src="${treantNode.image}" />
                    <p class="node-name">${description}</p>
                </div>
            `;


            builderNode.children.forEach(child => {
                treantNode.children.push(buildTreantNode(child));
            });

            return treantNode;
        };

        const nodeStructure = {
            children: this.rootNode.children.map(buildTreantNode)
        };

        // If there is more than one root branch, create an invisible pseudo-node to be the common parent.
        if (nodeStructure.children.length > 1) {
            return {
                pseudo: true,
                children: nodeStructure.children
            };
        }

        return nodeStructure.children[0];
    }

    reloadBuilderWithCurrentTree(event) {
        event.preventDefault();

        const treeData = this.getTreeAsJSON();
        const treeDataString = JSON.stringify(treeData);
        const csrfToken = document.querySelector('input[name="csrf_token"]').value;

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/builder';

        const treeInput = document.createElement('input');
        treeInput.type = 'hidden';
        treeInput.name = 'tree_data';
        treeInput.value = treeDataString;

        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = 'csrf_token';
        csrfInput.value = csrfToken;

        form.appendChild(treeInput);
        form.appendChild(csrfInput);
        document.body.appendChild(form);
        form.submit();
    }

    drawTreeVisualization() {
        const treantTree = this.getTreeForVisualization();

        if (!treantTree) {
            console.error("Cannot visualize an empty tree.");
            return;
        }

        const chart_config = {
            chart: {
                container: "#tree-canvas",
                connectors: {
                    type: "step"
                },
                node: {
                    collapsable: true,
                    HTMLclass: 'treant-node'
                },
                scrollbar: "fancy",
                nodeDragDrop: false
            },
            nodeStructure: treantTree
        };

        // Destroy previous chart instance if it exists, to avoid errors on re-draw
        if (this.treantChart) {
            this.treantChart.destroy();
        }
        this.treantChart = new Treant(chart_config, null, $);

        setTimeout(this.resizeAndCenterTree.bind(this), 500);
    }

    handleImageClick(image) {
        const newNode = new BuilderNode(image, this);
        const parentNode = this.selectedNode || this.rootNode;
        parentNode.addChild(newNode);
        this.selectNode(newNode); // Select the new node
        this.renderTree();
    }

    isDescendant(potentialDescendant, potentialAncestor) {
        return potentialAncestor.children.some(child =>
            child === potentialDescendant || this.isDescendant(potentialDescendant, child)
        );
    }

    handleDragStart(e, theNode) {
        if (theNode.image.id === 'root') {
            e.preventDefault();
            return;
        }
        this.draggedNode = theNode;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', theNode.image.id); // Required for Firefox

        setTimeout(() => {
            if (theNode.element) {
                theNode.element.classList.add('dragging');
            }
        }, 0);
    }

    handleDragOver(e, targetNode) {
        if (targetNode !== this.draggedNode) {
            const targetContent = targetNode.element.querySelector('.node-content');
            if (targetContent) {
                targetContent.classList.add('drag-over');
            }
        }
    }

    handleDragLeave(e, targetNode) {
        const targetContent = targetNode.element.querySelector('.node-content');
        if (targetContent) {
            targetContent.classList.remove('drag-over');
        }
    }

    handleDrop(e, targetNode) {
        this.handleDragLeave(e, targetNode);

        const draggedNode = this.draggedNode;

        if (!draggedNode || targetNode === draggedNode || this.isDescendant(targetNode, draggedNode)) {
            if (this.isDescendant(targetNode, draggedNode)) {
                alert("You cannot move a node into one of its own children.");
            }
            return;
        }

        const oldParent = draggedNode.parent;
        if (oldParent) {
            oldParent.children = oldParent.children.filter(child => child !== draggedNode);
        }

        targetNode.addChild(draggedNode);
        this.renderTree();
    }

    handleDragEnd(e) {
        if (this.draggedNode && this.draggedNode.element) {
            this.draggedNode.element.classList.remove('dragging');
        }
        this.draggedNode = null;
        document.querySelectorAll('.node-content.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    selectNode(theNode) {
        this.deselectAllNodes();
        this.selectedNode = theNode;

        const applyHighlight = (n) => {
            if (n.element) {
                const content = n.element.querySelector('.node-content');
                if (content) {
                    content.classList.add('selected');
                }
            }
            n.children.forEach(applyHighlight);
        };

        if (this.selectedNode) {
            applyHighlight(this.selectedNode);
            if (this.selectedNode.element) {
                this.selectedNode.element.classList.add('is-selected');
            }
        }

        if (this.nodeDescriptionTextarea) {
            if (this.selectedNode) {
                this.nodeDescriptionTextarea.value = this.selectedNode.description || '';
                this.nodeDescriptionTextarea.disabled = false;
            } else {
                this.nodeDescriptionTextarea.value = '';
                this.nodeDescriptionTextarea.disabled = true;
            }
        }
    }

    deselectAllNodes() {
        const selectedElements = this.treeDisplay.querySelectorAll('.node-content.selected');
        selectedElements.forEach(el => {
            el.classList.remove('selected');
        });
        const selectedNodes = this.treeDisplay.querySelectorAll('.node.is-selected');
        selectedNodes.forEach(el => {
            el.classList.remove('is-selected');
        });
        this.selectedNode = null;
        if (this.nodeDescriptionTextarea) {
            this.nodeDescriptionTextarea.value = '';
            this.nodeDescriptionTextarea.disabled = true;
        }
    }

    deleteSelectedNode() {
        if (!this.selectedNode || this.selectedNode.image.id === 'root') {
            alert(this.selectedNode ? 'You cannot delete the root node.' : 'Please select a node to delete.');
            return;
        }

        if (confirm('Are you sure you want to delete the selected branch?')) {
            const parent = this.selectedNode.parent;
            if (parent) {
                parent.children = parent.children.filter(child => child !== this.selectedNode);
                this.selectedNode = null;
                this.renderTree();
            }
        }
    }

    renderTree() {
        this.treeDisplay.innerHTML = '';
        if (this.rootNode && this.rootNode.element) {
            this.treeDisplay.appendChild(this.rootNode.element);
            this.renderChildren(this.rootNode);
        }
        this.updateVisualizeButtonState();
    }

    renderChildren(theNode) {
        const childrenContainer = theNode.element.querySelector('.children');
        if (!childrenContainer) return;

        childrenContainer.innerHTML = '';

        theNode.children.forEach(child => {
            if (child.element) {
                childrenContainer.appendChild(child.element);
                // The children of the child are already rendered within its element,
                // so no need to recurse here. The structure is built once.
                // We just need to append the elements correctly.
                // Wait, my understanding is wrong. The children elements need to be populated.
                // The `renderChildren` needs to be recursive.
                this.renderChildren(child);
            }
        });
    }

    getTreeAsJSON() {
        const buildNode = (theNode) => {
            const nodeData = {
                id: theNode.image.id,
                description: theNode.description,
                children: []
            };
            theNode.children.forEach(child => {
                nodeData.children.push(buildNode(child));
            });
            return nodeData;
        };

        const roots = [];
        this.rootNode.children.forEach(child => {
            roots.push(buildNode(child));
        });

        return {
            roots: roots
        };
    }

    async saveTree() {
        const treeName = document.getElementById('tree-name').value;
        if (!treeName) {
            alert('Please enter a name for the tree.');
            return;
        }

        const isPublic = document.getElementById('tree-is-public').checked;
        const jsonData = this.getTreeAsJSON();

        if (!jsonData || !jsonData.roots || jsonData.roots.length === 0) {
            alert('The tree is empty. Cannot save.');
            return;
        }

        // Check if a tree with the same name exists for the current user
        const existingTree = this.userTrees.find(tree => tree.name === treeName);
        let proceed = true;

        if (existingTree) {
            proceed = confirm("A tree with this name already exists. Do you want to overwrite it?");
        }

        if (!proceed) {
            return; // Stop if the user cancels
        }

        const response = await fetch('/api/tree/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: treeName,
                is_public: isPublic,
                json_data: jsonData,
            }),
        });

        const result = await response.json();
        if (result.status === 'success') {
            const message = existingTree ? 'Updated' : 'Created';
            alert(message);

            // Clear the existing tree before reloading from save
            this.rootNode.children = [];
            // Reload the builder with the saved tree data
            this.rebuildTreeFromJSON(result.tree_data);
            // Refresh the list of saved trees
            this.loadSavedTrees();
        } else {
            // Display specific error messages
            alert(`Error saving tree: ${result.message}`);
        }
    }

    filterImages() {
        const searchTerm = this.imageSearch.value;
        this.imageTree.filter(searchTerm);
    }

    filterTrees() {
        const searchTerm = this.treeSearch.value.toLowerCase();
        const treeLists = document.querySelectorAll('.tree-select-list');

        treeLists.forEach(select => {
            const options = select.options;
            for (let i = 0; i < options.length; i++) {
                const option = options[i];
                const optionText = option.textContent.toLowerCase();
                if (optionText.includes(searchTerm)) {
                    option.style.display = '';
                } else {
                    option.style.display = 'none';
                }
            }
        });
    }

    async loadSavedTrees() {
        const response = await fetch('/api/trees/load');
        const data = await response.json();
        this.publicTrees = data.public_trees || [];
        this.userTrees = data.user_trees || [];
        this.renderTreeList();
    }

    renderTreeList() {
        if (!this.treeList) return;
        this.treeList.innerHTML = '';
        this.activeTreeSelect = null; // To keep track of the currently active select element

        const createSelectList = (trees, title, id) => {
            if (trees.length > 0) {
                const titleEl = document.createElement('h6');
                titleEl.textContent = title;
                this.treeList.appendChild(titleEl);

                const select = document.createElement('select');
                select.id = id;
                select.className = 'form-control mb-2 tree-select-list';
                trees.forEach(tree => {
                    const option = document.createElement('option');
                    option.value = tree.id;

                    // For private trees, just show the tree name. For public, show author.
                    if (id === 'user-tree-select') {
                        option.textContent = tree.name;
                    } else {
                        option.textContent = tree.username ? `${tree.username} - ${tree.name}` : tree.name;
                    }
                    select.appendChild(option);
                });

                // When a user clicks on a select list, it becomes the active one
                select.addEventListener('focus', () => {
                    this.activeTreeSelect = select;
                });

                this.treeList.appendChild(select);
            }
        };

        createSelectList(this.userTrees, 'My Private Trees', 'user-tree-select');
        createSelectList(this.publicTrees, 'Public Trees', 'public-tree-select');

        // Set the default active list if it exists
        if (this.userTrees.length > 0) {
            this.activeTreeSelect = document.getElementById('user-tree-select');
        } else if (this.publicTrees.length > 0) {
            this.activeTreeSelect = document.getElementById('public-tree-select');
        }
    }

    loadTree() {
        if (!this.activeTreeSelect || !this.activeTreeSelect.value) {
            alert('Please select a tree to load.');
            return;
        }

        const treeId = parseInt(this.activeTreeSelect.value, 10);
        const allTrees = (this.userTrees || []).concat(this.publicTrees || []);
        const treeToLoad = allTrees.find(tree => tree.id === treeId);

        if (treeToLoad) {
            const importedData = JSON.parse(treeToLoad.json_data);
            const importMode = document.querySelector('input[name="import_mode"]:checked').value;

            if (importMode === 'replace') {
                this.rebuildTreeFromJSON(importedData);
            } else { // 'add'
                const currentTreeData = this.getTreeAsJSON();

                if (currentTreeData.roots.length > 0 && importedData.roots && importedData.roots.length > 0) {
                    const mergedRoots = currentTreeData.roots.concat(importedData.roots);
                    const mergedTreeData = { roots: mergedRoots };
                    this.rebuildTreeFromJSON(mergedTreeData);
                } else {
                    this.rebuildTreeFromJSON(importedData);
                }
            }
        } else {
            alert('Could not find the selected tree.');
        }
    }

    rebuildTreeFromJSON(treeData) {
        this.rootNode.children = []; // Clear existing tree before importing
        this.selectedNode = this.rootNode; // Select root by default

        const buildNode = (nodeData) => {
            let image = this.images.find(img => img.id === nodeData.id);
            if (!image) {
                console.warn(`Image with ID ${nodeData.id} is not accessible. Using a placeholder.`);
                image = {
                    id: nodeData.id,
                    name: 'Image inaccessible',
                    path: '/static/images/prohibit-bold.png',
                    description: 'This image is private or has been deleted.'
                };
            }

            const newNode = new BuilderNode(image, this);
            if (nodeData.hasOwnProperty('description')) {
                newNode.description = nodeData.description;
            }

            if (nodeData.children) {
                nodeData.children.forEach(childData => {
                    const childNode = buildNode(childData);
                    if (childNode) {
                        newNode.addChild(childNode);
                    }
                });
            }
            return newNode;
        };

        if (treeData.roots) {
            treeData.roots.forEach(rootData => {
                const rootNode = buildNode(rootData);
                if (rootNode) {
                    this.rootNode.addChild(rootNode);
                }
            });
        }

        this.renderTree();
    }

    exportTreeToJSON() {
        const jsonData = this.getTreeAsJSON();
        if (!jsonData) {
            alert('The tree is empty.');
            return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "tree.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
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
                        const importedData = JSON.parse(event.target.result);
                        const importMode = document.querySelector('input[name="import_mode"]:checked').value;

                        if (importMode === 'replace') {
                            this.rebuildTreeFromJSON(importedData);
                        } else { // 'add'
                            const currentTreeData = this.getTreeAsJSON();

                            if (currentTreeData.roots.length > 0 && importedData.roots && importedData.roots.length > 0) {
                                const mergedRoots = currentTreeData.roots.concat(importedData.roots);
                                const mergedTreeData = { roots: mergedRoots };
                                this.rebuildTreeFromJSON(mergedTreeData);
                            } else {
                                this.rebuildTreeFromJSON(importedData);
                            }
                        }
                    } catch (error) {
                        alert('Error parsing JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
}

function imageToDataUrl(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
    });
}

async function exportToVectorPdf() {
    // Leçon apprise n°2 : Utiliser le bon sélecteur
    const treeContainer = document.querySelector("#tree-visualizer-container .Treant");
    if (!treeContainer || treeContainer.children.length === 0) {
        throw new Error("Le conteneur de l'arbre (#tree-container) est introuvable ou vide.");
    }

    const treantSvg = treeContainer.querySelector("svg");
    const htmlNodes = treeContainer.querySelectorAll(".node");

    const finalSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const containerWidth = treeContainer.scrollWidth;
    const containerHeight = treeContainer.scrollHeight;
    finalSvg.setAttribute('width', containerWidth);
    finalSvg.setAttribute('height', containerHeight);
    finalSvg.setAttribute('viewBox', `0 0 ${containerWidth} ${containerHeight}`);

    const connectors = treantSvg.querySelectorAll('path');
    connectors.forEach(connector => finalSvg.appendChild(connector.cloneNode(true)));

    for (const node of htmlNodes) {
        const x = parseInt(node.style.left, 10);
        const y = parseInt(node.style.top, 10);
        const width = node.offsetWidth;
        const height = node.offsetHeight;

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('transform', `translate(${x}, ${y})`);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', '#fff');
        rect.setAttribute('stroke', '#ccc');
        group.appendChild(rect);

        const imgElement = node.querySelector('img');
        if (imgElement) {
            const dataUrl = await imageToDataUrl(imgElement.src);
            const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            image.setAttribute('href', dataUrl);
            const imgWidth = 50;
            const imgHeight = 50;
            image.setAttribute('width', imgWidth);
            image.setAttribute('height', imgHeight);
            image.setAttribute('x', (width - imgWidth) / 2);
            image.setAttribute('y', 10);
            group.appendChild(image);
        }

        const textElement = node.querySelector('.node-name, .node-title');
        if (textElement) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.textContent = textElement.textContent;
            text.setAttribute('x', width / 2);
            text.setAttribute('y', 80);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', '12');
            text.setAttribute('fill', '#000');
            group.appendChild(text);
        }
        finalSvg.appendChild(group);
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [containerWidth, containerHeight]
    });

    await pdf.svg(finalSvg, {
        x: 0,
        y: 0,
        width: containerWidth,
        height: containerHeight
    });

    pdf.save('picto-tree-vectoriel.pdf');
}

document.addEventListener('DOMContentLoaded', () => {
    const dropdownEl = document.getElementById('navbarDropdown');
    if (dropdownEl) {
        new bootstrap.Dropdown(dropdownEl);
    }
    new TreeBuilder();
});
