import ImageTree from './components/ImageTree.js';
import ArasaacSearch from './components/ArasaacSearch.js';
import { ApiClient } from './services/ApiClient.js';
import { NotificationService } from './services/NotificationService.js';
import { DomUtils } from './utils/DomUtils.js';
import { BuilderNode, resolveBuilderImageUrl } from './components/BuilderNode.js';
import { BinderManager } from './components/BinderManager.js';
import { TreePdfExporter } from './services/TreePdfExporter.js';

export class TreeBuilder {
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
        this.userTrees = [];
        this.currentUserId = null;
        this.activeTreeSelect = null;
        this.selectedNode = null;
        this.draggedNode = null;
        this.treantChart = null;

        // Zoom & Pan state variables
        this.scale = 1;
        this.panning = false;
        this.pointX = 0;
        this.pointY = 0;
        this.start = { x: 0, y: 0 };

        // Racine initiale par défaut
        this.rootNode = new BuilderNode(
            { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' },
            this,
            null,
            true
        );

        if (this.treeDisplay) {
            this.treeDisplay.appendChild(this.rootNode.element);
        }

        if (this.nodeDescriptionTextarea) {
            this.nodeDescriptionTextarea.disabled = true;
            this.nodeDescriptionTextarea.addEventListener('input', () => {
                if (this.selectedNode) {
                    const newDescription = this.nodeDescriptionTextarea.value;
                    this.selectedNode.description = newDescription;
                    this.selectedNode.updateDescription(newDescription);
                }
            });
        }

        // Arbre d'images de la banque locale
        this.imageTree = new ImageTree('image-sidebar-tree');

        // Recherche Arasaac
        this.arasaacSearch = new ArasaacSearch('arasaac-search-container', (e, payload) => {
            this.handleArasaacDragStart(e, payload);
        });

        // Gestionnaire de classeur multi-arbres (Profils)
        this.binderManager = new BinderManager({
            getUserTrees: () => this.userTrees,
            getCurrentUserId: () => this.currentUserId
        });

        this.initCanvasDragDrop();
        this.initEventListeners();
        this.initPanAndZoom();

        this.loadSavedTrees();
        this.updateVisualizeButtonState();

        const treeDataFromPostElement = document.getElementById('tree-data-from-post');
        if (treeDataFromPostElement && treeDataFromPostElement.textContent) {
            try {
                const treeData = JSON.parse(treeDataFromPostElement.textContent);
                if (treeData) {
                    this.rebuildTreeFromJSON(treeData);
                }
            } catch (e) {
                console.error('Could not parse tree_data_from_post', e);
            }
        }
    }

    initCanvasDragDrop() {
        if (!this.treeDisplay) return;

        this.treeDisplay.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.treeDisplay.classList.add('drag-over');

            // Défilement automatique lors du survol des bords
            const container = this.treeDisplay;
            const threshold = 50;
            const scrollSpeed = 10;
            const rect = container.getBoundingClientRect();

            if (e.clientY - rect.top < threshold) {
                container.scrollTop -= scrollSpeed;
            } else if (rect.bottom - e.clientY < threshold) {
                container.scrollTop += scrollSpeed;
            }

            if (e.clientX - rect.left < threshold) {
                container.scrollLeft -= scrollSpeed;
            } else if (rect.right - e.clientX < threshold) {
                container.scrollLeft += scrollSpeed;
            }
        });

        this.treeDisplay.addEventListener('dragleave', () => {
            this.treeDisplay.classList.remove('drag-over');
        });

        this.treeDisplay.addEventListener('drop', (e) => {
            e.preventDefault();
            this.treeDisplay.classList.remove('drag-over');
            const dragDataString = e.dataTransfer.getData('application/json');
            if (dragDataString) {
                try {
                    const dragData = JSON.parse(dragDataString);
                    if (dragData.type === 'image-tree-node' || dragData.type === 'arasaac-image') {
                        this.addNewNodeFromDrop(dragData.data);
                    }
                } catch (err) {
                    console.error('Erreur parsing drop canvas:', err);
                }
            }
        });

        document.addEventListener('click', (e) => {
            const deleteBtn = document.getElementById('delete-btn');
            const isClickOnDelete = deleteBtn ? deleteBtn.contains(e.target) : false;
            const isClickInsideTree = this.treeDisplay ? this.treeDisplay.contains(e.target) : false;
            const isClickInsideDescription = this.nodeDescriptionTextarea ? this.nodeDescriptionTextarea.contains(e.target) : false;
            const isClickInsideDropdown = e.target.closest('.dropdown');

            if (isClickOnDelete || isClickInsideTree || isClickInsideDescription || isClickInsideDropdown) {
                return;
            }

            this.deselectAllNodes();
        });
    }

    initEventListeners() {
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
                    if (NotificationService.confirm('You have an unsaved tree. Are you sure you want to leave?')) {
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
                if (typeof bootstrap !== 'undefined') {
                    const modal = new bootstrap.Modal(this.treeVisualizerModal);
                    modal.show();
                }
            });
        }

        if (this.treeVisualizerModal) {
            this.treeVisualizerModal.addEventListener('shown.bs.modal', () => {
                if (this.treantChart) {
                    this.treantChart.destroy();
                }
                const container = document.getElementById('tree-visualizer-container');
                if (container) {
                    container.innerHTML = '';
                }

                this.scale = 1;
                this.panning = false;
                this.pointX = 0;
                this.pointY = 0;
                this.start = { x: 0, y: 0 };

                this.drawTreeVisualization();
            });
        }

        if (this.closeVisualizeBtn) {
            this.closeVisualizeBtn.addEventListener('click', this.reloadBuilderWithCurrentTree.bind(this));
        }

        if (this.closeVisualizeXBtn) {
            this.closeVisualizeXBtn.addEventListener('click', this.reloadBuilderWithCurrentTree.bind(this));
        }

        // Export PDF vectoriel via délégation d'événement jQuery (modale)
        if (typeof $ !== 'undefined') {
            $(document).on('click', '#export-pdf-vectoriel', async function () {
                const btn = $(this);
                btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Exporting...');

                try {
                    await TreePdfExporter.export();
                } catch (error) {
                    console.error("Erreur lors de l'export PDF:", error);
                    NotificationService.alert("L'export PDF a échoué. Cause : " + error.message);
                } finally {
                    btn.prop('disabled', false).html('Export to PDF');
                }
            });
        }
    }

    initPanAndZoom() {
        const treeContainer = document.getElementById('tree-visualizer-container');
        if (!treeContainer) return;

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
                this.scale = Math.min(Math.max(0.5, this.scale + delta), 4);
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

        treeContainer.style.cursor = 'grab';
    }

    updateVisualizeButtonState() {
        if (this.visualizeTreeBtn) {
            this.visualizeTreeBtn.disabled = this.rootNode.children.length === 0;
        }
    }

    getTreeForVisualization() {
        const buildTreantNode = (builderNode) => {
            const imageSrc = resolveBuilderImageUrl(builderNode.image);

            const treantNode = {
                text: { name: builderNode.image.name || '' },
                image: imageSrc,
                children: []
            };

            const rawDescription = builderNode.description || builderNode.image.name || '';
            const safeDescription = DomUtils ? DomUtils.escapeHtml(rawDescription) : rawDescription;
            const rawHTML = `
                <div class="node-content-wrapper">
                    <img src="${treantNode.image}" />
                    <p class="node-name">${safeDescription}</p>
                </div>
            `;

            if (window.DOMPurify) {
                treantNode.innerHTML = window.DOMPurify.sanitize(rawHTML);
            } else {
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
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        const treeData = this.getTreeAsJSON();
        const treeDataString = JSON.stringify(treeData);
        const csrfTokenNode = document.querySelector('input[name="csrf_token"]');
        if (!csrfTokenNode) {
            NotificationService.alert('Erreur de sécurité : token CSRF manquant. Rechargez la page.');
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
            console.error('Cannot visualize an empty tree.');
            return;
        }

        const chartConfig = {
            chart: {
                container: '#tree-visualizer-container',
                connectors: {
                    type: 'step'
                },
                node: {
                    collapsable: false,
                    HTMLclass: 'treant-node'
                },
                scrollbar: 'fancy'
            },
            nodeStructure: treantTree
        };

        if (this.treantChart) {
            this.treantChart.destroy();
        }
        if (typeof Treant !== 'undefined') {
            this.treantChart = new Treant(chartConfig, null, $);
        }

        const treantInnerContainer = document.querySelector('#tree-visualizer-container .Treant');
        if (treantInnerContainer) {
            treantInnerContainer.style.transformOrigin = '0 0';
            treantInnerContainer.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
        }
    }

    addNewNodeFromDrop(imageData) {
        const newNode = new BuilderNode(imageData, this);
        this.rootNode.addChild(newNode);
        this.selectNode(newNode);
        this.renderTree();
    }

    isDescendant(potentialDescendant, potentialAncestor) {
        return potentialAncestor.children.some(child =>
            child === potentialDescendant || this.isDescendant(potentialDescendant, child)
        );
    }

    handleDragStart(e, theNode) {
        if (theNode.isRoot) {
            e.preventDefault();
            return;
        }
        this.draggedNode = theNode;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(theNode.image.id));

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

                if (targetNode.isRoot) {
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
            if (targetNode.isRoot) {
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

        this.handleDragLeave(e, targetNode);

        // Cas 1 : Réorganisation d'un nœud existant
        if (this.draggedNode) {
            const draggedNode = this.draggedNode;
            if (targetNode === draggedNode || this.isDescendant(targetNode, draggedNode)) {
                if (this.isDescendant(targetNode, draggedNode)) {
                    NotificationService.alert('You cannot move a node into one of its own children.');
                }
                return;
            }

            const oldParent = draggedNode.parent;
            if (oldParent) {
                oldParent.children = oldParent.children.filter(child => child !== draggedNode);
            }

            if (targetNode.isRoot && zone === 'replace') {
                this.updateRootImage(draggedNode.image);
                draggedNode.children.forEach(child => {
                    this.rootNode.addChild(child);
                });
            } else if (zone === 'before' || zone === 'after') {
                const parent = targetNode.parent;
                if (parent) {
                    const index = parent.children.indexOf(targetNode);
                    if (index > -1) {
                        const insertIndex = zone === 'before' ? index : index + 1;
                        parent.children.splice(insertIndex, 0, draggedNode);
                        draggedNode.parent = parent;
                    }
                }
            } else {
                targetNode.addChild(draggedNode);
            }

            this.renderTree();
            return;
        }

        // Cas 2 : Dépose d'un nouveau nœud depuis la barre latérale
        const dragDataString = e.dataTransfer.getData('application/json');
        if (dragDataString) {
            try {
                const dragData = JSON.parse(dragDataString);
                if (dragData.type === 'image-tree-node' || dragData.type === 'arasaac-image') {
                    if (targetNode.isRoot && zone === 'replace') {
                        this.updateRootImage(dragData.data);
                        return;
                    }

                    const newNode = new BuilderNode(dragData.data, this);
                    if (zone === 'before' || zone === 'after') {
                        const parent = targetNode.parent;
                        if (parent) {
                            const index = parent.children.indexOf(targetNode);
                            if (index > -1) {
                                const insertIndex = zone === 'before' ? index : index + 1;
                                parent.children.splice(insertIndex, 0, newNode);
                                newNode.parent = parent;
                            }
                        }
                    } else {
                        targetNode.addChild(newNode);
                    }

                    this.selectNode(newNode);
                    this.renderTree();
                }
            } catch (err) {
                console.error('Error parsing drop data', err);
            }
        }
    }

    updateRootImage(imageData) {
        const children = this.rootNode.children;
        const newRootData = {
            id: imageData.id,
            name: imageData.name,
            path: imageData.path || imageData.url,
            description: imageData.description || imageData.name
        };

        this.rootNode = new BuilderNode(newRootData, this, { url: newRootData.path }, true);
        this.rootNode.children = children;

        children.forEach(child => {
            child.parent = this.rootNode;
        });

        this.selectNode(this.rootNode);
        this.renderTree();
    }

    handleArasaacDragStart(e, payload) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        if (payload.data && payload.data.id !== undefined) {
            e.dataTransfer.setData('text/plain', payload.data.id.toString());
        }
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
        if (this.treeDisplay) {
            const selectedElements = this.treeDisplay.querySelectorAll('.node-content.selected');
            selectedElements.forEach(el => {
                el.classList.remove('selected');
            });
            const selectedNodes = this.treeDisplay.querySelectorAll('.node.is-selected');
            selectedNodes.forEach(el => {
                el.classList.remove('is-selected');
            });
        }
        this.selectedNode = null;
        if (this.nodeDescriptionTextarea) {
            this.nodeDescriptionTextarea.value = '';
            this.nodeDescriptionTextarea.disabled = true;
        }
    }

    deleteSelectedNode() {
        if (!this.selectedNode || this.selectedNode.isRoot) {
            NotificationService.alert(this.selectedNode ? 'You cannot delete the root node.' : 'Please select a node to delete.');
            return;
        }

        if (NotificationService.confirm('Are you sure you want to delete the selected branch?')) {
            const parent = this.selectedNode.parent;
            if (parent) {
                parent.children = parent.children.filter(child => child !== this.selectedNode);
                this.selectedNode = null;
                this.renderTree();
            }
        }
    }

    renderTree() {
        if (!this.treeDisplay) return;
        this.treeDisplay.innerHTML = '';
        if (this.rootNode && this.rootNode.element) {
            this.treeDisplay.appendChild(this.rootNode.element);
            this.renderChildren(this.rootNode);
        }
        this.updateVisualizeButtonState();
    }

    renderChildren(theNode) {
        if (!theNode.element) return;
        const childrenContainer = theNode.element.querySelector('.children');
        if (!childrenContainer) return;

        childrenContainer.innerHTML = '';

        theNode.children.forEach(child => {
            if (child.element) {
                childrenContainer.appendChild(child.element);
                this.renderChildren(child);
            }
        });
    }

    getTreeAsJSON() {
        const buildNode = (theNode) => {
            let imageId = theNode.image.id;
            const imageUrl = theNode.image.path;
            const imageName = theNode.image.name;

            if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
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
        if (this.rootNode) {
            roots.push(buildNode(this.rootNode));
        }

        return {
            roots: roots
        };
    }

    async saveTree() {
        if (!this.currentUserId) {
            NotificationService.alert(window.translations?.accountRequired || 'Account required');
            return;
        }

        const treeNameInput = document.getElementById('tree-name');
        const treeName = treeNameInput ? treeNameInput.value.trim() : '';
        if (!treeName) {
            NotificationService.alert('Please enter a name for the tree.');
            return;
        }

        const isPublic = false;
        const jsonData = this.getTreeAsJSON();

        if (!jsonData || !jsonData.roots || jsonData.roots.length === 0) {
            NotificationService.alert('The tree is empty. Cannot save.');
            return;
        }

        let rootId = -1;
        let rootUrl = null;
        if (this.rootNode && !this.rootNode.isDefaultRoot) {
            const rawId = this.rootNode.image.real_id !== undefined ? this.rootNode.image.real_id : this.rootNode.image.id;
            rootId = isNaN(Number(rawId)) ? -1 : Number(rawId);
            rootUrl = this.rootNode.image.path;

            if (rootUrl && (rootUrl.startsWith('http://') || rootUrl.startsWith('https://'))) {
                rootId = -1;
            }
        }

        const allTrees = this.userTrees || [];
        const existingTree = allTrees.find(tree => tree.name === treeName && tree.user_id === this.currentUserId);

        let proceed = true;
        if (existingTree) {
            proceed = NotificationService.confirm('A tree with this name already exists. Are you sure you want to overwrite it?');
        }

        if (!proceed) {
            return;
        }

        try {
            const result = await ApiClient.post('/api/tree/save', {
                name: treeName,
                is_public: isPublic,
                root_id: rootId,
                root_url: rootUrl,
                json_data: jsonData
            });

            if (result.status === 'success') {
                const message = existingTree ? 'Updated' : 'Created';
                NotificationService.alert(message);

                this.rootNode.children = [];
                this.rebuildTreeFromJSON(result.tree_data);
                await this.loadSavedTrees();
            } else {
                NotificationService.alert(`Error saving tree: ${result.message}`);
            }
        } catch (e) {
            console.error('Erreur sauvegarde:', e);
            NotificationService.alert('La sauvegarde a échoué. Vérifiez votre connexion et réessayez.');
        }
    }

    filterImages() {
        if (!this.imageSearch) return;
        const searchTerm = this.imageSearch.value;
        this.imageTree.filter(searchTerm);
    }

    filterTrees() {
        if (!this.treeSearch) return;
        const term = this.treeSearch.value.toLowerCase().trim();
        const selects = this.treeList ? this.treeList.querySelectorAll('select.tree-select-list') : [];
        selects.forEach(select => {
            Array.from(select.options).forEach(opt => {
                const matches = opt.textContent.toLowerCase().includes(term);
                opt.style.display = matches ? '' : 'none';
            });
        });
    }

    async loadSavedTrees() {
        try {
            const data = await ApiClient.get('/api/trees/load');
            this.userTrees = Array.isArray(data.user_trees) ? data.user_trees : [];
            this.currentUserId = data.current_user_id;
        } catch (e) {
            console.error('Impossible de charger les arbres:', e);
            NotificationService.alert('Impossible de charger les arbres sauvegardés.');
            this.userTrees = [];
        }

        this.renderTreeList();
        this.binderManager.setUserTrees(this.userTrees, this.currentUserId);
        await this.binderManager.loadSavedProfiles();
    }

    renderTreeList() {
        if (!this.treeList) return;
        this.treeList.innerHTML = '';
        this.activeTreeSelect = null;

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
                    if (id === 'user-tree-select') {
                        option.textContent = tree.name;
                    } else {
                        option.textContent = tree.username ? `${tree.username} - ${tree.name}` : tree.name;
                    }
                    select.appendChild(option);
                });

                select.addEventListener('focus', () => {
                    this.activeTreeSelect = select;
                });

                this.treeList.appendChild(select);
            }
        };

        createSelectList(this.userTrees, 'My Trees', 'user-tree-select');

        if (this.userTrees.length > 0) {
            this.activeTreeSelect = document.getElementById('user-tree-select');
        }
    }

    loadTree() {
        if (!this.activeTreeSelect || !this.activeTreeSelect.value) {
            NotificationService.alert('Please select a tree to load.');
            return;
        }

        const treeId = parseInt(this.activeTreeSelect.value, 10);
        const allTrees = this.userTrees || [];
        const treeToLoad = allTrees.find(tree => tree.id === treeId);

        if (treeToLoad) {
            let importedData;
            try {
                importedData = typeof treeToLoad.json_data === 'string'
                    ? JSON.parse(treeToLoad.json_data)
                    : treeToLoad.json_data;
            } catch (err) {
                console.error('Erreur parsing json_data:', err);
                NotificationService.alert('Invalid tree data.');
                return;
            }

            const importModeInput = document.querySelector('input[name="import_mode"]:checked');
            const importMode = importModeInput ? importModeInput.value : 'replace';

            if (importMode === 'replace') {
                this.rebuildTreeFromJSON(importedData, true);
            } else {
                if (importedData.roots && importedData.roots.length > 0) {
                    importedData.roots.forEach(importedRoot => {
                        if (importedRoot.id === 'root') {
                            importedRoot.id = -1;
                        }
                        const childNode = this.buildNodeFromJsonData(importedRoot);
                        if (childNode) {
                            this.rootNode.addChild(childNode);
                        }
                    });
                    this.renderTree();
                }
            }
        } else {
            NotificationService.alert('Could not find the selected tree.');
        }
    }

    async deleteTree() {
        if (!this.currentUserId) {
            NotificationService.alert(window.translations?.accountRequired || 'Account required');
            return;
        }

        if (!this.activeTreeSelect || !this.activeTreeSelect.value) {
            NotificationService.alert('Please select a tree to delete.');
            return;
        }

        const treeId = parseInt(this.activeTreeSelect.value, 10);
        const allTrees = this.userTrees || [];
        const treeToDelete = allTrees.find(tree => tree.id === treeId);

        if (!treeToDelete) {
            NotificationService.alert('Could not find the selected tree.');
            return;
        }

        if (!NotificationService.confirm(`Are you sure you want to delete the tree "${treeToDelete.name}"?`)) {
            return;
        }

        try {
            const result = await ApiClient.delete(`/api/tree/${treeId}`);

            if (result.status === 'success') {
                NotificationService.alert('Tree deleted successfully.');
                await this.loadSavedTrees();

                this.rootNode.children = [];
                this.renderTree();
            } else {
                NotificationService.alert(`Error deleting tree: ${result.message}`);
            }
        } catch (e) {
            console.error('Delete error:', e);
            NotificationService.alert('Failed to delete the tree. Please try again.');
        }
    }

    buildNodeFromJsonData(nodeData) {
        let image;

        if (nodeData.url) {
            image = {
                id: nodeData.id !== undefined ? nodeData.id : nodeData.real_id,
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
            this.rootNode.children = [];

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
                this.rootNode = new BuilderNode(rootImage, this, rootData, true);

                if (rootData.children) {
                    rootData.children.forEach(childData => {
                        const childNode = this.buildNodeFromJsonData(childData);
                        if (childNode) {
                            this.rootNode.addChild(childNode);
                        }
                    });
                }
            } else if (treeData.roots && treeData.roots.length > 1) {
                this.rootNode = new BuilderNode(
                    { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' },
                    this,
                    null,
                    true
                );
                treeData.roots.forEach(rootData => {
                    const rootNode = this.buildNodeFromJsonData(rootData);
                    if (rootNode) {
                        this.rootNode.addChild(rootNode);
                    }
                });
            } else {
                this.rootNode = new BuilderNode(
                    { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png' },
                    this,
                    null,
                    true
                );
            }
        }

        this.selectedNode = this.rootNode;
        this.renderTree();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dropdownEl = document.getElementById('navbarDropdown');
    if (dropdownEl && typeof bootstrap !== 'undefined') {
        new bootstrap.Dropdown(dropdownEl);
    }
    new TreeBuilder();

    // Logique de synchronisation entre accordéons et onglets
    let isSyncing = false;

    const collapseManageTrees = document.getElementById('collapseManageTrees');
    const collapseManageProfiles = document.getElementById('collapseManageProfiles');
    const collapseManageResources = document.getElementById('collapseManageResources');
    const treeBuilderTabEl = document.getElementById('tree-builder-tab');
    const profileBuilderTabEl = document.getElementById('profile-builder-tab');
    const myResourcesTabEl = document.getElementById('my-resources-tab');

    if (collapseManageTrees && collapseManageProfiles && treeBuilderTabEl && profileBuilderTabEl && typeof bootstrap !== 'undefined') {
        collapseManageTrees.addEventListener('show.bs.collapse', () => {
            if (isSyncing) return;
            isSyncing = true;
            const tab = new bootstrap.Tab(treeBuilderTabEl);
            tab.show();
            isSyncing = false;
        });

        collapseManageProfiles.addEventListener('show.bs.collapse', () => {
            if (isSyncing) return;
            isSyncing = true;
            const tab = new bootstrap.Tab(profileBuilderTabEl);
            tab.show();
            isSyncing = false;
        });

        if (collapseManageResources && myResourcesTabEl) {
            collapseManageResources.addEventListener('show.bs.collapse', () => {
                if (isSyncing) return;
                isSyncing = true;
                const tab = new bootstrap.Tab(myResourcesTabEl);
                tab.show();
                isSyncing = false;
            });
        }

        treeBuilderTabEl.addEventListener('show.bs.tab', () => {
            if (isSyncing) return;
            isSyncing = true;
            const bsCollapseTrees = new bootstrap.Collapse(collapseManageTrees, { toggle: false });
            const bsCollapseProfiles = new bootstrap.Collapse(collapseManageProfiles, { toggle: false });
            bsCollapseProfiles.hide();
            if (collapseManageResources) {
                const bsCollapseResources = new bootstrap.Collapse(collapseManageResources, { toggle: false });
                bsCollapseResources.hide();
            }
            bsCollapseTrees.show();
            isSyncing = false;
        });

        profileBuilderTabEl.addEventListener('show.bs.tab', () => {
            if (isSyncing) return;
            isSyncing = true;
            const bsCollapseTrees = new bootstrap.Collapse(collapseManageTrees, { toggle: false });
            const bsCollapseProfiles = new bootstrap.Collapse(collapseManageProfiles, { toggle: false });
            bsCollapseTrees.hide();
            if (collapseManageResources) {
                const bsCollapseResources = new bootstrap.Collapse(collapseManageResources, { toggle: false });
                bsCollapseResources.hide();
            }
            bsCollapseProfiles.show();
            isSyncing = false;
        });

        if (myResourcesTabEl && collapseManageResources) {
            myResourcesTabEl.addEventListener('show.bs.tab', () => {
                if (isSyncing) return;
                isSyncing = true;
                const bsCollapseTrees = new bootstrap.Collapse(collapseManageTrees, { toggle: false });
                const bsCollapseProfiles = new bootstrap.Collapse(collapseManageProfiles, { toggle: false });
                const bsCollapseResources = new bootstrap.Collapse(collapseManageResources, { toggle: false });
                bsCollapseTrees.hide();
                bsCollapseProfiles.hide();
                bsCollapseResources.show();
                isSyncing = false;
            });
        }
    }
});
