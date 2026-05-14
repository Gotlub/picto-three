import ImageTree from './components/ImageTree.js';
import ArasaacSearch from './components/ArasaacSearch.js';


class BuilderNode {
    constructor(image, builder, nodeData = null) {
        this.image = image;
        this.builder = builder;
        this.nodeData = nodeData;
        this.children = [];
        this.parent = null;
        // Prioritize description from saved tree data, fallback to image data.
        this.description = (nodeData && nodeData.description !== undefined) ? nodeData.description : (image.description || '');
        this.isDefaultRoot = (image.id === 'root' && (!nodeData || !nodeData.url));
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
            // or an external URL from Arasaac (e.g. 'https://static.arasaac.org/...')
            if (this.image.path.startsWith('http') || this.image.path.startsWith('/')) {
                imgElement.src = this.image.path; // It's already a full URL or absolute path
            } else {
                imgElement.src = `/pictograms/${this.image.path}`; // It's a relative path
            }
        }
        imgElement.alt = this.image.name;

        // Fallback for missing or broken images
        imgElement.addEventListener('error', function() {
            const fallbackSrc = '/static/images/folder-open-bold.png';
            if (!this.src.endsWith(fallbackSrc)) {
                this.src = fallbackSrc;
            }
        });

        // Add tooltip events
        imgElement.addEventListener('mouseover', (e) => {
            tooltip.show(e, imgElement.src);
        });
        imgElement.addEventListener('mouseout', (e) => {
            tooltip.hide(e);
        });

        contentElement.appendChild(imgElement);

        const nameElement = document.createElement('span');
        nameElement.classList.add('node-name');
        nameElement.textContent = this.description || this.image.name;
        this.nameElement = nameElement;
        contentElement.appendChild(nameElement);

        if (this.image.id === 'root') {
            // For the root node, add a visual indicator that it can be changed
            const hintElement = document.createElement('div');
            hintElement.style.fontSize = '0.7em';
            hintElement.style.color = '#888';
            hintElement.style.marginTop = '4px';

            if (this.isDefaultRoot) {
                hintElement.textContent = 'Drop an image here to set the root';
                nameElement.textContent = 'Choose the root image';
            } else {
                hintElement.textContent = 'Drop here to change root';
            }

            contentElement.appendChild(hintElement);
            // Ensure it's visually distinct before an image is set
            if (this.isDefaultRoot) {
                contentElement.style.border = '2px dashed #007bff';
                contentElement.style.backgroundColor = '#f8f9fa';
            }
        }

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

    updateDescription(newDescription) {
        if (this.nameElement) {
            this.nameElement.textContent = newDescription;
        }
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
        this.savedTrees = [];
        this.rootNode = new BuilderNode({ id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' }, this);
        this.treeDisplay.appendChild(this.rootNode.element);
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
                    const newDescription = this.nodeDescriptionTextarea.value;
                    this.selectedNode.description = newDescription;

                    // As `this.selectedNode` is the BuilderNode instance (the "View"),
                    // we can call its update method directly.
                    this.selectedNode.updateDescription(newDescription);
                }
            });
        }

        // New Image Tree initialization. The click callback is set to null to allow drag-and-drop to work without conflict.
        this.imageTree = new ImageTree('image-sidebar-tree');

        // Initialize Arasaac Search
        this.arasaacSearch = new ArasaacSearch('arasaac-search-container', (e, payload) => {
            this.handleArasaacDragStart(e, payload);
        });

        // --- Drag and Drop from Sidebar to Builder ---
        this.treeDisplay.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            e.dataTransfer.dropEffect = 'copy';
            this.treeDisplay.classList.add('drag-over'); // Add highlight class

            // Auto-scroll logic
            const container = this.treeDisplay;
            const threshold = 50; // pixels near the edge to trigger scrolling
            const scrollSpeed = 10;
            const rect = container.getBoundingClientRect();

            // Vertical scrolling
            if (e.clientY - rect.top < threshold) {
                container.scrollTop -= scrollSpeed;
            } else if (rect.bottom - e.clientY < threshold) {
                container.scrollTop += scrollSpeed;
            }

            // Horizontal scrolling
            if (e.clientX - rect.left < threshold) {
                container.scrollLeft -= scrollSpeed;
            } else if (rect.right - e.clientX < threshold) {
                container.scrollLeft += scrollSpeed;
            }
        });

        this.treeDisplay.addEventListener('dragleave', () => {
            this.treeDisplay.classList.remove('drag-over'); // Remove highlight
        });

        this.treeDisplay.addEventListener('drop', (e) => {
            e.preventDefault();
            this.treeDisplay.classList.remove('drag-over');
            const dragDataString = e.dataTransfer.getData('application/json');
            if (dragDataString) {
                const dragData = JSON.parse(dragDataString);
                if (dragData.type === 'image-tree-node' || dragData.type === 'arasaac-image') {
                    this.addNewNodeFromDrop(dragData.data);
                }
            }
        });

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



        const loadBtn = document.getElementById('load-tree-btn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadTree());
        }

        const deleteTreeBtn = document.getElementById('delete-tree-btn');
        if (deleteTreeBtn) {
            deleteTreeBtn.addEventListener('click', () => this.deleteTree());
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
            newTreeBtn.addEventListener('click', () => {
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
                document.getElementById('tree-visualizer-container').innerHTML = '';

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

        this.initProfileBuilder();
        this.initProfileEvents();

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

    initPanAndZoom() {
        const treeContainer = document.getElementById('tree-visualizer-container');
        if (!treeContainer) return;

        // The target for the transform is the inner div created by Treant, not the scroll container
        const setTransform = () => {
            const treantInnerContainer = treeContainer.querySelector('.Treant');
            if (treantInnerContainer) {
                treantInnerContainer.style.transformOrigin = '0 0';
                treantInnerContainer.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
            }
        };

        treeContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                const newScale = Math.min(Math.max(0.5, this.scale + delta), 4);
                this.scale = newScale;
                setTransform();
            }
        });

        treeContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.panning = true;
            this.start = { x: e.clientX - this.pointX, y: e.clientY - this.pointY };
            treeContainer.style.cursor = 'grabbing';
        });

        if (!this._onMouseUp) {
            this._onMouseUp = () => {
                this.panning = false;
                treeContainer.style.cursor = 'grab';
            };
            treeContainer.addEventListener('mouseup', this._onMouseUp);
            treeContainer.addEventListener('mouseleave', this._onMouseUp);
        }

        if (!this._onMouseMove) {
            this._onMouseMove = (e) => {
                if (!this.panning) return;
                this.pointX = (e.clientX - this.start.x);
                this.pointY = (e.clientY - this.start.y);
                setTransform();
            };
            treeContainer.addEventListener('mousemove', this._onMouseMove);
        }

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
            let imageSrc;
            if (builderNode.image.path.startsWith('http')) {
                imageSrc = builderNode.image.path;
            } else if (builderNode.image.path.startsWith('/')) {
                imageSrc = builderNode.image.path;
            } else {
                imageSrc = `/pictograms/${builderNode.image.path}`;
            }

            const treantNode = {
                text: { name: builderNode.image.name },
                image: imageSrc,
                children: []
            };

            // To include the description in the node, we can use innerHTML
            // The 'name' from the text property will be the title attribute of the container div
            const description = builderNode.description || builderNode.image.name;
            const rawHTML = `
                <div class="node-content-wrapper">
                    <img src="${treantNode.image}" />
                    <p class="node-name">${description}</p>
                </div>
            `;
            if (window.DOMPurify) {
                treantNode.innerHTML = window.DOMPurify.sanitize(rawHTML);
            } else {
                console.error("DOMPurify not loaded, preventing potential XSS.");
                treantNode.innerHTML = "<div style='color:red;'>Secure Rendering Failed</div>";
            }


            builderNode.children.forEach(child => {
                treantNode.children.push(buildTreantNode(child));
            });

            return treantNode;
        };

        return buildTreantNode(this.rootNode);
    }

    reloadBuilderWithCurrentTree(event) {
        event.preventDefault();

        const treeData = this.getTreeAsJSON();
        const treeDataString = JSON.stringify(treeData);
        const csrfTokenNode = document.querySelector('input[name="csrf_token"]');
        if (!csrfTokenNode) {
            alert('Erreur de sécurité : token CSRF manquant. Rechargez la page.');
            return;
        }
        const csrfToken = csrfTokenNode.value;

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
                container: "#tree-visualizer-container",
                connectors: {
                    type: "step"
                },
                node: {
                    collapsable: true,
                    HTMLclass: 'treant-node' // Add a class for styling
                },
                scrollbar: "fancy" // Enable fancy scrollbar
            },
            nodeStructure: treantTree
        };

        // Destroy previous chart instance if it exists, to avoid errors on re-draw
        if (this.treantChart) {
            this.treantChart.destroy();
        }
        this.treantChart = new Treant(chart_config, null, $);

        // Apply initial transform after the chart is drawn
        const treantInnerContainer = document.querySelector('#tree-visualizer-container .Treant');
        if (treantInnerContainer) {
            treantInnerContainer.style.transformOrigin = '0 0';
            treantInnerContainer.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
        }
    }

    // handleImageClick(image) {
    //     const newNode = new BuilderNode(image, this);
    //     const parentNode = this.selectedNode || this.rootNode;
    //     parentNode.addChild(newNode);
    //     this.selectNode(newNode); // Select the new node
    //     this.renderTree();
    // }

    addNewNodeFromDrop(imageData) {
        const newNode = new BuilderNode(imageData, this);

        // Always add to root instead of trying to be "smart" and finding closest element.
        // This avoids confusion when dropping into the void.
        this.rootNode.addChild(newNode);

        this.selectNode(newNode); // Select the newly added node.
        this.renderTree(); // Update the tree display.
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
                targetContent.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-child', 'drag-over-replace');

                const rect = targetContent.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const height = rect.height;

                if (targetNode.image.id === 'root') {
                    if (offsetY < height / 2) {
                        targetContent.classList.add('drag-over-replace');
                    } else {
                        targetContent.classList.add('drag-over-child');
                    }
                } else {
                    if (offsetY < height * 0.25) {
                        targetContent.classList.add('drag-over-before');
                    } else if (offsetY > height * 0.75) {
                        targetContent.classList.add('drag-over-after');
                    } else {
                        targetContent.classList.add('drag-over-child');
                    }
                }
            }
        }
    }

    handleDragLeave(e, targetNode) {
        const targetContent = targetNode.element.querySelector('.node-content');
        if (targetContent) {
            targetContent.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-child', 'drag-over-replace');
        }
    }

    handleDrop(e, targetNode) {
        let zone = 'child';
        const targetContent = targetNode.element.querySelector('.node-content');
        if (targetContent) {
            const rect = targetContent.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;
            const height = rect.height;
            if (targetNode.image.id === 'root') {
                zone = offsetY < height / 2 ? 'replace' : 'child';
            } else {
                if (offsetY < height * 0.25) {
                    zone = 'before';
                } else if (offsetY > height * 0.75) {
                    zone = 'after';
                } else {
                    zone = 'child';
                }
            }
        }

        this.handleDragLeave(e, targetNode); // Clean up highlight

        // Case 1: Reordering an existing node from within the builder
        if (this.draggedNode) {
            const draggedNode = this.draggedNode;
            if (targetNode === draggedNode || this.isDescendant(targetNode, draggedNode)) {
                if (this.isDescendant(targetNode, draggedNode)) {
                    alert("You cannot move a node into one of its own children.");
                }
                return;
            }

            const oldParent = draggedNode.parent;
            if (oldParent) {
                oldParent.children = oldParent.children.filter(child => child !== draggedNode);
            }

            if (targetNode.image.id === 'root' && zone === 'replace') {
                this.updateRootImage(draggedNode.image);
                // Reparent all children of the dragged node to the root node
                draggedNode.children.forEach(child => {
                    this.rootNode.addChild(child);
                });
            } else if (zone === 'before' || zone === 'after') {
                const parent = targetNode.parent;
                const index = parent.children.indexOf(targetNode);
                if (index > -1) {
                    const insertIndex = zone === 'before' ? index : index + 1;
                    parent.children.splice(insertIndex, 0, draggedNode);
                    draggedNode.parent = parent;
                }
            } else {
                targetNode.addChild(draggedNode);
            }

            this.renderTree();
            return; // End execution here for internal drops
        }

        // Case 2: Dropping a new node from the sidebar (Local or Arasaac)
        const dragDataString = e.dataTransfer.getData('application/json');
        if (dragDataString) {
            try {
                const dragData = JSON.parse(dragDataString);
                if (dragData.type === 'image-tree-node' || dragData.type === 'arasaac-image') {

                    if (targetNode.image.id === 'root' && zone === 'replace') {
                        // If dropping on root top half, change the root's image
                        this.updateRootImage(dragData.data);
                        return;
                    }

                    const newNode = new BuilderNode(dragData.data, this);
                    if (zone === 'before' || zone === 'after') {
                        const parent = targetNode.parent;
                        const index = parent.children.indexOf(targetNode);
                        if (index > -1) {
                            const insertIndex = zone === 'before' ? index : index + 1;
                            parent.children.splice(insertIndex, 0, newNode);
                            newNode.parent = parent;
                        }
                    } else {
                        targetNode.addChild(newNode);
                    }

                    this.selectNode(newNode);
                    this.renderTree();
                }
            } catch (err) {
                console.error("Error parsing drop data", err);
            }
        }
    }

    updateRootImage(imageData) {
        // Keep the children but recreate the root node with the new image
        const children = this.rootNode.children;
        const newRootData = {
            id: 'root', // Keep it identified as root
            real_id: imageData.id, // The actual image ID
            name: imageData.name,
            path: imageData.path || imageData.url,
            description: imageData.description || imageData.name
        };

        // Custom node logic to handle our modified root
        this.rootNode = new BuilderNode(newRootData, this, { url: newRootData.path });
        this.rootNode.children = children;

        // Re-assign parents
        children.forEach(child => {
            child.parent = this.rootNode;
        });

        this.selectNode(this.rootNode);
        this.renderTree();
    }

    handleArasaacDragStart(e, payload) {
        // No notion of "draggedNode" internal state for external items, but we set dataTransfer
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', payload.data.id.toString());
    }

    handleDragEnd() {
        if (this.draggedNode && this.draggedNode.element) {
            this.draggedNode.element.classList.remove('dragging');
        }
        this.draggedNode = null;
        document.querySelectorAll('.node-content').forEach(el => {
            el.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-child', 'drag-over-replace');
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
            // Unify data format: Always save descriptive data
            // ID: Maintain ID for database matching (local) or -1 (external)
            // URL/Path: Always save the path/url as 'url'
            // Name: Always save the name

            let imageId = theNode.image.id;
            let imageUrl = theNode.image.path;
            let imageName = theNode.image.name;

            // If it's an Arasaac image, ensure ID is -1 (though it likely is already)
            if (imageUrl && imageUrl.startsWith('http')) {
                imageId = -1;
            }

            const nodeData = {
                id: imageId,
                url: imageUrl,
                name: imageName,
                description: theNode.description,
                children: []
            };

            theNode.children.forEach(child => {
                nodeData.children.push(buildNode(child));
            });
            return nodeData;
        };

        const roots = [];

        // Push the root node into the JSON hierarchy (as the single root array element)
        // If it's a default root, we don't strictly need to export its placeholder image,
        // but it keeps the structure consistent.
        if (this.rootNode) {
            roots.push(buildNode(this.rootNode));
        }

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

        const isPublic = false;
        const jsonData = this.getTreeAsJSON();

        if (!jsonData || !jsonData.roots || jsonData.roots.length === 0) {
            alert('The tree is empty. Cannot save.');
            return;
        }

        // Determine if there's a valid root image
        let root_id = -1;
        let root_url = null;
        if (this.rootNode && !this.rootNode.isDefaultRoot) {
            root_id = this.rootNode.image.real_id !== undefined ? this.rootNode.image.real_id : this.rootNode.image.id;
            root_url = this.rootNode.image.path;

            if (root_url && root_url.startsWith('http')) {
                root_id = -1; // Arasaac or external
            }
        }

        // Check if a tree with the same name exists for the current user
        const allTrees = this.userTrees || [];
        const existingTree = allTrees.find(tree => tree.name === treeName && tree.user_id === this.currentUserId);
        
        let proceed = true;

        if (existingTree) {
            proceed = confirm("A tree with this name already exists. Are you sure you want to overwrite it?");
        }

        if (!proceed) {
            return; // Stop if the user cancels
        }

        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;
        if (!csrfToken) {
            alert('Erreur de sécurité : token CSRF manquant. Rechargez la page.');
            return;
        }

        try {
            const response = await fetch('/api/tree/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    name: treeName,
                    is_public: isPublic,
                    root_id: root_id,
                    root_url: root_url,
                    json_data: jsonData,
                }),
            });

            if (!response.ok) {
                throw new Error(`Erreur serveur: ${response.status}`);
            }

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
        } catch (e) {
            console.error('Erreur sauvegarde:', e);
            alert('La sauvegarde a échoué. Vérifiez votre connexion et réessayez.');
        }
    }

    filterImages() {
        const searchTerm = this.imageSearch.value;
        this.imageTree.filter(searchTerm);
    }

    filterTrees() {
    }

    async loadSavedTrees() {
        try {
            const response = await fetch('/api/trees/load');
            if (!response.ok) {
                console.error(`Erreur HTTP: ${response.status}`);
                return;
            }
            const data = await response.json();
            this.userTrees = Array.isArray(data.user_trees) ? data.user_trees : [];
            this.currentUserId = data.current_user_id;
        } catch (e) {
            console.error('Impossible de charger les arbres:', e);
            alert('Impossible de charger les arbres sauvegardés.');
            this.userTrees = [];
        }
        this.renderTreeList();
        this.renderProfileBuilderTreeList();
        this.loadSavedProfiles();
    }

    initProfileEvents() {
        const saveProfileBtn = document.getElementById('save-profile-btn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', () => this.saveProfile());
        }

        const loadProfileBtn = document.getElementById('load-profile-btn');
        if (loadProfileBtn) {
            loadProfileBtn.addEventListener('click', () => this.loadSelectedProfile());
        }

        const deleteProfileBtn = document.getElementById('delete-profile-btn');
        if (deleteProfileBtn) {
            deleteProfileBtn.addEventListener('click', () => this.deleteSelectedProfile());
        }

        const profileSearch = document.getElementById('profile-search');
        if (profileSearch) {
            profileSearch.addEventListener('input', () => this.filterProfiles());
        }

        const newProfileBtn = document.getElementById('new-profile-btn');
        if (newProfileBtn) {
            newProfileBtn.addEventListener('click', () => this.createNewProfile());
        }

        const avatarContainer = document.getElementById('profile-avatar-container');
        if (avatarContainer) {
            avatarContainer.addEventListener('click', () => this.openAvatarModal());
        }
    }

    openAvatarModal() {
        const modalEl = document.getElementById('avatar-modal');
        if (!modalEl) return;
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        
        if (!this.modalImageTree) {
            this.modalImageTree = new ImageTree('modal-image-sidebar-tree');
            this.modalImageTree.onImageClick = (data) => {
                this.setProfileAvatar(`/pictogramsmin/${data.path}`);
                modal.hide();
            };
            
            this.modalArasaacSearch = new ArasaacSearch('modal-arasaac-search-container', null, (imgUrl) => {
                this.setProfileAvatar(imgUrl);
                modal.hide();
            });
        }
        
        modal.show();
    }
    
    setProfileAvatar(url) {
        const urlInput = document.getElementById('profile-image-url');
        const previewImg = document.getElementById('profile-image-preview');
        if (urlInput) urlInput.value = url;
        if (previewImg) previewImg.src = url;
    }

    initProfileBuilder() {
        const profileArea = document.getElementById('profile-builder-area');
        const profileTreesList = document.getElementById('profile-trees-list');
        const emptyMsg = document.getElementById('profile-builder-empty-msg');
        
        if (!profileArea || !profileTreesList) return;

        // Drag events for dropping items into the profile area
        profileArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            // Allow dropping from right sidebar OR reordering
            e.dataTransfer.dropEffect = 'copy';
            profileArea.classList.add('border-primary'); // Highlight dropzone
            
            // Visual feedback for reordering
            const y = e.clientY;
            const target = e.target.closest('.profile-dropped-tree-item');
            if (target && !target.classList.contains('dragging')) {
                const box = target.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                // Clear previous indicators
                profileTreesList.querySelectorAll('.drop-above, .drop-below').forEach(el => {
                    el.classList.remove('drop-above', 'drop-below');
                });
                
                if (offset < 0) {
                    target.classList.add('drop-above');
                } else {
                    target.classList.add('drop-below');
                }
            }
        });

        profileArea.addEventListener('dragleave', (e) => {
            profileArea.classList.remove('border-primary');
            // We shouldn't remove drop-above/below here unconditionally because dragleave fires when entering child elements
        });

        profileArea.addEventListener('drop', (e) => {
            e.preventDefault();
            profileArea.classList.remove('border-primary');
            profileTreesList.querySelectorAll('.drop-above, .drop-below').forEach(el => {
                el.classList.remove('drop-above', 'drop-below');
            });
            
            let dragData = null;
            try {
                const dataString = e.dataTransfer.getData('application/json');
                if (dataString) {
                    dragData = JSON.parse(dataString);
                }
            } catch (err) {
                console.error('Failed to parse drag data', err);
            }

            if (dragData && dragData.type === 'profile-tree-item') {
                // Determine insertion point if reordering
                const y = e.clientY;
                const afterElement = this.getDragAfterElement(profileTreesList, y);
                
                // Need to find full tree data to pass to addTreeToProfile
                const treeData = this.userTrees.find(t => t.id === dragData.treeId);
                
                if (treeData) {
                    // Check if tree is already in the list
                    const existingNode = profileTreesList.querySelector(`[data-tree-id="${treeData.id}"]`);
                    if (existingNode && dragData.isReorder) {
                        // We are just reordering an existing element
                        if (afterElement == null) {
                            profileTreesList.appendChild(existingNode);
                        } else {
                            profileTreesList.insertBefore(existingNode, afterElement);
                        }
                    } else if (!existingNode) {
                        // Adding a new tree
                        const newElement = this.createProfileTreeElement(treeData);
                        if (afterElement == null) {
                            profileTreesList.appendChild(newElement);
                        } else {
                            profileTreesList.insertBefore(newElement, afterElement);
                        }
                        if (emptyMsg) emptyMsg.style.display = 'none';
                    } else {
                        // Already in list, do not add duplicates
                    }
                    this.updateProfileTreeNumbers();
                }
            }
        });
    }

    updateProfileTreeNumbers() {
        const profileTreesList = document.getElementById('profile-trees-list');
        if (!profileTreesList) return;
        const items = profileTreesList.querySelectorAll('.profile-dropped-tree-item');
        items.forEach((item, index) => {
            const numberSpan = item.querySelector('.tree-number');
            if (numberSpan) {
                numberSpan.textContent = `${index + 1}.`;
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.profile-dropped-tree-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    createProfileTreeElement(treeData) {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center profile-dropped-tree-item mb-2 shadow-sm rounded';
        li.setAttribute('draggable', 'true');
        li.dataset.treeId = treeData.id;

        // Drag events for reordering
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'profile-tree-item',
                treeId: treeData.id,
                isReorder: true
            }));
            li.classList.add('dragging');
            li.style.opacity = '0.5';
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            li.style.opacity = '1';
            const profileTreesList = document.getElementById('profile-trees-list');
            if (profileTreesList) {
                profileTreesList.querySelectorAll('.drop-above, .drop-below').forEach(el => {
                    el.classList.remove('drop-above', 'drop-below');
                });
            }
        });

        // Left section: Handle, Number, Image, Name
        const leftSection = document.createElement('div');
        leftSection.className = 'd-flex align-items-center flex-grow-1';

        const dragHandle = document.createElement('span');
        dragHandle.innerHTML = '&#8942;&#8942;';
        dragHandle.style.cursor = 'grab';
        dragHandle.className = 'text-muted me-2 fs-5';
        leftSection.appendChild(dragHandle);

        const numberSpan = document.createElement('span');
        numberSpan.className = 'tree-number fw-bold text-muted me-3 fs-5';
        numberSpan.textContent = '1.';
        leftSection.appendChild(numberSpan);

        const imgContainer = document.createElement('div');
        imgContainer.style.width = '40px';
        imgContainer.style.height = '40px';
        imgContainer.className = 'me-3';
        const img = document.createElement('img');
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        let thumbUrl = '/static/images/folder-bold.png';
        if (treeData.root_url) {
            if (treeData.root_url.startsWith('http')) {
                thumbUrl = treeData.root_url.replace(/_500\.png$/, '_300.png');
            } else if (treeData.root_url.startsWith('/pictograms/')) {
                thumbUrl = treeData.root_url.replace('/pictograms/', '/pictogramsmin/');
            } else if (treeData.root_url.startsWith('/')) {
                thumbUrl = treeData.root_url;
            } else {
                thumbUrl = `/pictogramsmin/${treeData.root_url}`;
            }
        }
        img.src = thumbUrl;
        img.onerror = function() { this.src = '/static/images/folder-bold.png'; };
        imgContainer.appendChild(img);
        leftSection.appendChild(imgContainer);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'fw-bold';
        nameSpan.textContent = treeData.name;
        leftSection.appendChild(nameSpan);

        li.appendChild(leftSection);

        // Right section: Colors and Delete
        const rightSection = document.createElement('div');
        rightSection.className = 'd-flex align-items-center';

        // Color options Dropdown - Unified with Mobile (Hex codes)
        const colors = [
            { hex: '#000000', label: 'Black' },
            { hex: '#FFEB3B', label: 'Yellow' },
            { hex: '#4CAF50', label: 'Green' },
            { hex: '#FF9800', label: 'Orange' },
            { hex: '#2196F3', label: 'Blue' },
            { hex: '#E91E63', label: 'Pink' }
        ];

        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'dropdown me-3 profile-tree-color-dropdown';
        
        const dropdownBtn = document.createElement('button');
        dropdownBtn.className = 'btn btn-sm btn-outline-secondary dropdown-toggle d-flex align-items-center';
        dropdownBtn.type = 'button';
        dropdownBtn.dataset.bsToggle = 'dropdown';
        
        const selectedColorSpan = document.createElement('span');
        selectedColorSpan.className = 'rounded-circle me-2 color-indicator border';
        selectedColorSpan.style.width = '14px';
        selectedColorSpan.style.height = '14px';
        
        const selectedText = document.createElement('span');
        
        dropdownBtn.appendChild(selectedColorSpan);
        dropdownBtn.appendChild(selectedText);
        dropdownDiv.appendChild(dropdownBtn);
        
        const dropdownMenu = document.createElement('ul');
        dropdownMenu.className = 'dropdown-menu';
        dropdownMenu.style.minWidth = 'unset';

        // Set initial color state
        let currentColor = treeData.colorCode || '#000000';
        dropdownDiv.dataset.selectedColor = currentColor;

        const updateBtnVisuals = (colorHex) => {
            const cInfo = colors.find(c => c.hex === colorHex) || colors[0];
            selectedColorSpan.style.backgroundColor = cInfo.hex;
            selectedText.textContent = cInfo.label;
            dropdownDiv.dataset.selectedColor = cInfo.hex;
        };
        updateBtnVisuals(currentColor);

        colors.forEach(color => {
            const optionLi = document.createElement('li');
            const a = document.createElement('a');
            a.className = 'dropdown-item d-flex align-items-center';
            a.href = '#';
            
            const swatch = document.createElement('span');
            swatch.className = 'rounded-circle me-2 border';
            swatch.style.width = '14px';
            swatch.style.height = '14px';
            swatch.style.backgroundColor = color.hex;
            
            a.appendChild(swatch);
            a.appendChild(document.createTextNode(color.label));
            
            a.addEventListener('click', (e) => {
                e.preventDefault();
                updateBtnVisuals(color.hex);
            });
            
            optionLi.appendChild(a);
            dropdownMenu.appendChild(optionLi);
        });

        dropdownDiv.appendChild(dropdownMenu);
        rightSection.appendChild(dropdownDiv);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger border-0';
        deleteBtn.innerHTML = '&#10005;'; // X mark
        deleteBtn.addEventListener('click', () => {
            li.remove();
            this.updateProfileTreeNumbers();
            const profileTreesList = document.getElementById('profile-trees-list');
            const emptyMsg = document.getElementById('profile-builder-empty-msg');
            if (profileTreesList && profileTreesList.children.length === 0 && emptyMsg) {
                emptyMsg.style.display = 'block';
            }
        });

        rightSection.appendChild(deleteBtn);
        li.appendChild(rightSection);

        return li;
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

        createSelectList(this.userTrees, 'My Trees', 'user-tree-select');

        // Set the default active list if it exists
        if (this.userTrees.length > 0) {
            this.activeTreeSelect = document.getElementById('user-tree-select');
        }
    }

    renderProfileBuilderTreeList() {
        const profileTreeList = document.getElementById('profile-builder-tree-list');
        if (!profileTreeList) return;
        
        profileTreeList.innerHTML = '';
        
        if (!this.userTrees || this.userTrees.length === 0) {
            const emptyMsg = document.createElement('li');
            emptyMsg.className = 'list-group-item text-muted text-center';
            emptyMsg.textContent = 'No trees available.';
            profileTreeList.appendChild(emptyMsg);
            return;
        }

        this.userTrees.forEach(tree => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action d-flex align-items-center profile-tree-item';
            li.setAttribute('draggable', 'true');
            li.dataset.treeId = tree.id;
            li.dataset.treeName = tree.name;
            
            // Icon to indicate draggability
            const dragHandle = document.createElement('span');
            dragHandle.innerHTML = '&#8942;&#8942;'; // vertical ellipsis (drag handle)
            dragHandle.style.cursor = 'grab';
            dragHandle.className = 'text-muted me-2 flex-shrink-0';

            // Thumbnail Image
            const imgContainer = document.createElement('div');
            imgContainer.style.width = '40px';
            imgContainer.style.height = '40px';
            imgContainer.style.flexShrink = '0';
            imgContainer.style.display = 'flex';
            imgContainer.style.justifyContent = 'center';
            imgContainer.style.alignItems = 'center';
            imgContainer.className = 'me-2';

            const img = document.createElement('img');
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            
            let thumbUrl = '/static/images/folder-bold.png'; // default fallback
            if (tree.root_url) {
                if (tree.root_url.startsWith('http')) {
                    // Arasaac: replace _500 with _300 if applicable
                    thumbUrl = tree.root_url.replace(/_500\.png$/, '_300.png');
                } else if (tree.root_url.startsWith('/pictograms/')) {
                    thumbUrl = tree.root_url.replace('/pictograms/', '/pictogramsmin/');
                } else if (tree.root_url.startsWith('/')) {
                    thumbUrl = tree.root_url;
                } else {
                    thumbUrl = `/pictogramsmin/${tree.root_url}`;
                }
            }
            img.src = thumbUrl;
            img.alt = tree.name;
            img.onerror = function() {
                this.src = '/static/images/folder-bold.png';
            };
            
            imgContainer.appendChild(img);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'flex-grow-1 tree-name text-truncate';
            nameSpan.textContent = tree.name;

            li.appendChild(dragHandle);
            li.appendChild(imgContainer);
            li.appendChild(nameSpan);

            // Drag event listeners for future profile builder UI
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'profile-tree-item',
                    treeId: tree.id,
                    treeName: tree.name
                }));
                li.style.opacity = '0.5';
            });
            
            li.addEventListener('dragend', () => {
                li.style.opacity = '1';
            });

            profileTreeList.appendChild(li);
        });

        // Setup search functionality for profile trees
        const searchInput = document.getElementById('profile-builder-tree-search');
        if (searchInput) {
            // Remove old listener to avoid duplicates
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            
            newSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const items = profileTreeList.querySelectorAll('.profile-tree-item');
                
                items.forEach(item => {
                    const treeName = item.dataset.treeName.toLowerCase();
                    if (treeName.includes(searchTerm)) {
                        item.style.setProperty('display', 'flex', 'important');
                    } else {
                        item.style.setProperty('display', 'none', 'important');
                    }
                });
            });
        }
    }

    loadTree() {
        if (!this.activeTreeSelect || !this.activeTreeSelect.value) {
            alert('Please select a tree to load.');
            return;
        }

        const treeId = parseInt(this.activeTreeSelect.value, 10);
        const allTrees = this.userTrees || [];
        const treeToLoad = allTrees.find(tree => tree.id === treeId);

        if (treeToLoad) {
            const importedData = JSON.parse(treeToLoad.json_data);
            const importMode = document.querySelector('input[name="import_mode"]:checked').value;

            if (importMode === 'replace') {
                this.rebuildTreeFromJSON(importedData, true);
            } else { // 'add'
                // For 'add', we want to keep the current root, and add the imported roots as children
                if (importedData.roots && importedData.roots.length > 0) {
                    importedData.roots.forEach(importedRoot => {
                        // If the imported root still has the 'root' identifier, remove it so it acts like a normal node
                        if (importedRoot.id === 'root') {
                            importedRoot.id = -1;
                        }
                        // The imported root itself becomes a child of our current root
                        const childNode = this.buildNodeFromJsonData(importedRoot);
                        if (childNode) {
                            this.rootNode.addChild(childNode);
                        }
                    });
                    this.renderTree();
                }
            }
        } else {
            alert('Could not find the selected tree.');
        }
    }

    async deleteTree() {
        if (!this.activeTreeSelect || !this.activeTreeSelect.value) {
            alert('Please select a tree to delete.');
            return;
        }

        const treeId = parseInt(this.activeTreeSelect.value, 10);
        const allTrees = this.userTrees || [];
        const treeToDelete = allTrees.find(tree => tree.id === treeId);

        if (!treeToDelete) {
            alert('Could not find the selected tree.');
            return;
        }

        if (!confirm(`Are you sure you want to delete the tree "${treeToDelete.name}"?`)) {
            return;
        }

        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;
        if (!csrfToken) {
            alert('Security error: missing CSRF token. Please reload the page.');
            return;
        }

        try {
            const response = await fetch(`/api/tree/${treeId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': csrfToken
                }
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.message || `Server error: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                alert('Tree deleted successfully.');
                await this.loadSavedTrees();
                
                // Clear the builder workspace just in case they deleted the active tree
                this.rootNode.children = [];
                this.renderTree();
            } else {
                alert(`Error deleting tree: ${result.message}`);
            }
        } catch (e) {
            console.error('Delete error:', e);
            alert('Failed to delete the tree. Please try again.');
        }
    }

    buildNodeFromJsonData(nodeData) {
        let image;

        if (nodeData.url) {
            image = {
                id: nodeData.id !== undefined ? nodeData.id : nodeData.real_id, // fallback to old format
                real_id: nodeData.real_id,
                name: nodeData.name || 'Unknown',
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

        const newNode = new BuilderNode(image, this, nodeData);

        if (nodeData.children) {
            nodeData.children.forEach(childData => {
                const childNode = this.buildNodeFromJsonData(childData);
                if (childNode) {
                    newNode.addChild(childNode);
                }
            });
        }
        return newNode;
    }

    rebuildTreeFromJSON(treeData, isFullReplace = true) {
        if (isFullReplace) {
            this.rootNode.children = []; // Clear existing tree before importing

            // Check if the treeData has a root node properties attached directly
            // (older versions or the new version might structure the DB representation differently)
            // Based on our saveTree, the DB JSON data is just {"roots": [...]}
            // The root properties (root_id, root_url) are passed via the backend endpoint optionally, 
            // but treeData might just have `roots`.

            // If treeData has exactly 1 root, let's make it the actual root of the builder
            if (treeData.roots && treeData.roots.length === 1) {
                const rootData = treeData.roots[0];
                // Initialize root Node from the data
                const rootImage = {
                    id: 'root',
                    real_id: rootData.id !== undefined ? rootData.id : rootData.real_id,
                    name: rootData.name || 'Root',
                    path: rootData.url || '/static/images/folder-open-bold.png',
                    description: rootData.description || rootData.name
                };
                this.rootNode = new BuilderNode(rootImage, this, rootData);

                // Process its children
                if (rootData.children) {
                    rootData.children.forEach(childData => {
                        const childNode = this.buildNodeFromJsonData(childData);
                        if (childNode) {
                            this.rootNode.addChild(childNode);
                        }
                    });
                }
            } else if (treeData.roots && treeData.roots.length > 1) {
                // Fallback for older saves where multiple roots were allowed at top level
                this.rootNode = new BuilderNode({ id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' }, this);
                treeData.roots.forEach(rootData => {
                    const rootNode = this.buildNodeFromJsonData(rootData);
                    if (rootNode) {
                        this.rootNode.addChild(rootNode);
                    }
                });
            } else {
                // Empty
                this.rootNode = new BuilderNode({ id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' }, this);
            }
        }

        this.selectedNode = this.rootNode;
        this.renderTree();
    }

    // Profile Management Methods
    async loadSavedProfiles() {
        try {
            const response = await fetch('/api/profiles/load');
            const data = await response.json();
            this.savedProfiles = data.profiles || [];
            this.renderProfileList();
        } catch (error) {
            console.error('Error loading profiles:', error);
            alert('Failed to load profiles');
        }
    }

    renderProfileList() {
        const profileList = document.getElementById('profile-list');
        if (!profileList) return;
        profileList.innerHTML = '';
        
        if (!this.savedProfiles || this.savedProfiles.length === 0) {
            profileList.innerHTML = '<div class="text-muted small">No profiles saved yet.</div>';
            return;
        }

        const select = document.createElement('select');
        select.id = 'profile-select';
        select.className = 'form-select form-select-sm mb-2 profile-select-list';
        
        this.savedProfiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            select.appendChild(option);
        });

        profileList.appendChild(select);
    }

    filterProfiles() {
        const profileSearch = document.getElementById('profile-search');
        if (!profileSearch) return;
        const query = profileSearch.value.toLowerCase();
        
        const select = document.getElementById('profile-select');
        if (!select) return;

        Array.from(select.options).forEach(option => {
            const name = option.textContent.toLowerCase();
            option.style.display = name.includes(query) ? '' : 'none';
        });
        
        // Reset selection to the first visible option if the current one is hidden
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.style.display === 'none') {
            const firstVisible = Array.from(select.options).find(opt => opt.style.display !== 'none');
            if (firstVisible) {
                select.value = firstVisible.value;
            }
        }
    }

    async saveProfile() {
        const profileNameInput = document.getElementById('profile-name');
        if (!profileNameInput) return;
        
        const profileName = profileNameInput.value.trim();
        if (!profileName) {
            alert('Please enter a profile name.');
            return;
        }

        const profileTreesList = document.getElementById('profile-trees-list');
        const items = profileTreesList.querySelectorAll('.profile-dropped-tree-item');
        if (items.length === 0) {
            alert('Please add at least one tree to the profile.');
            return;
        }

        const trees = [];
        items.forEach((item, index) => {
            const dropdown = item.querySelector('.profile-tree-color-dropdown');
            const colorCode = dropdown ? dropdown.dataset.selectedColor : '#000000';
            trees.push({
                treeId: parseInt(item.dataset.treeId, 10),
                colorCode: colorCode,
                display_order: index + 1
            });
        });

        const payload = {
            name: profileName,
            remote_avatar_url: document.getElementById('profile-image-url')?.value || '',
            trees: trees
        };

        const saveBtn = document.getElementById('save-profile-btn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }
            
            const response = await fetch('/api/profile/save', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            
            if (response.ok) {
                alert(data.message);
                this.loadSavedProfiles(); // Refresh the list
            } else {
                alert(data.message || 'Error saving profile');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to save profile');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    loadSelectedProfile() {
        const select = document.getElementById('profile-select');
        if (!select || !select.value) {
            alert('Please select a profile to load.');
            return;
        }

        const profileId = parseInt(select.value, 10);
        const profile = this.savedProfiles.find(p => p.id === profileId);
        
        if (profile) {
            this.loadProfileIntoBuilder(profile);
        }
    }

    loadProfileIntoBuilder(profile) {
        const profileNameInput = document.getElementById('profile-name');
        if (profileNameInput) profileNameInput.value = profile.name;

        if (profile.remote_avatar_url) {
            this.setProfileAvatar(profile.remote_avatar_url);
        } else {
            // Placeholder SVG
            this.setProfileAvatar("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 24 24' fill='none' stroke='%236c757d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path><circle cx='12' cy='7' r='4'></circle></svg>");
            document.getElementById('profile-image-url').value = '';
        }

        const profileTreesList = document.getElementById('profile-trees-list');
        const emptyMsg = document.getElementById('profile-builder-empty-msg');
        
        if (profileTreesList) profileTreesList.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'none';

        if (profile.trees && profile.trees.length > 0) {
            profile.trees.forEach(treeData => {
                const element = this.createProfileTreeElement(treeData);
                profileTreesList.appendChild(element);
            });
            this.updateProfileTreeNumbers();
        } else {
            if (emptyMsg) emptyMsg.style.display = 'block';
        }
    }

    async deleteSelectedProfile() {
        const select = document.getElementById('profile-select');
        if (!select || !select.value) {
            alert('Please select a profile to delete.');
            return;
        }

        if (!confirm('Are you sure you want to delete this profile?')) {
            return;
        }

        const profileId = select.value;
        const deleteBtn = document.getElementById('delete-profile-btn');
        const originalText = deleteBtn.textContent;
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';

        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;

        try {
            const headers = {};
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }
            const response = await fetch(`/api/profile/${profileId}`, { 
                method: 'DELETE',
                headers: headers
            });
            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                this.loadSavedProfiles();
            } else {
                alert(data.message || 'Error deleting profile');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to delete profile');
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = originalText;
        }
    }

    createNewProfile() {
        if (!confirm('Are you sure you want to start a new profile? This will clear the current list.')) {
            return;
        }

        // Clear the profile name input
        const profileNameInput = document.getElementById('profile-name');
        if (profileNameInput) {
            profileNameInput.value = '';
        }

        // Clear the avatar
        this.setProfileAvatar("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 24 24' fill='none' stroke='%236c757d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path><circle cx='12' cy='7' r='4'></circle></svg>");
        document.getElementById('profile-image-url').value = '';

        // Clear the list
        const profileTreesList = document.getElementById('profile-trees-list');
        if (profileTreesList) {
            profileTreesList.innerHTML = '';
        }

        // Show empty message
        const emptyMsg = document.getElementById('profile-builder-empty-msg');
        if (emptyMsg) {
            emptyMsg.style.display = 'block';
        }

        // Deselect any selected profile in the list
        const profileSelect = document.getElementById('profile-select');
        if (profileSelect) {
            profileSelect.value = '';
        }
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

    // Synchronization logic between Accordions and Tabs
    let isSyncing = false;

    const collapseManageTrees = document.getElementById('collapseManageTrees');
    const collapseManageProfiles = document.getElementById('collapseManageProfiles');
    const treeBuilderTabEl = document.getElementById('tree-builder-tab');
    const profileBuilderTabEl = document.getElementById('profile-builder-tab');

    if (collapseManageTrees && collapseManageProfiles && treeBuilderTabEl && profileBuilderTabEl) {
        
        // When 'Manage Trees' accordion opens, switch to 'Tree Builder' tab
        collapseManageTrees.addEventListener('show.bs.collapse', () => {
            if (isSyncing) return;
            isSyncing = true;
            const tab = new bootstrap.Tab(treeBuilderTabEl);
            tab.show();
            isSyncing = false;
        });

        // When 'Manage Profiles' accordion opens, switch to 'Profile Builder' tab
        collapseManageProfiles.addEventListener('show.bs.collapse', () => {
            if (isSyncing) return;
            isSyncing = true;
            const tab = new bootstrap.Tab(profileBuilderTabEl);
            tab.show();
            isSyncing = false;
        });

        // When 'Tree Builder' tab is shown, open 'Manage Trees' accordion
        treeBuilderTabEl.addEventListener('show.bs.tab', () => {
            if (isSyncing) return;
            isSyncing = true;
            const bsCollapseTrees = new bootstrap.Collapse(collapseManageTrees, { toggle: false });
            const bsCollapseProfiles = new bootstrap.Collapse(collapseManageProfiles, { toggle: false });
            bsCollapseProfiles.hide();
            bsCollapseTrees.show();
            isSyncing = false;
        });

        // When 'Profile Builder' tab is shown, open 'Manage Profiles' accordion
        profileBuilderTabEl.addEventListener('show.bs.tab', () => {
            if (isSyncing) return;
            isSyncing = true;
            const bsCollapseTrees = new bootstrap.Collapse(collapseManageTrees, { toggle: false });
            const bsCollapseProfiles = new bootstrap.Collapse(collapseManageProfiles, { toggle: false });
            bsCollapseTrees.hide();
            bsCollapseProfiles.show();
            isSyncing = false;
        });
    }
});
