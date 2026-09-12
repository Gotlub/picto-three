/**
 * ReadOnlyTreeViewer - Composant de visualisation en lecture seule d'un arbre de pictogrammes
 * permettant la sélection et le drag-and-drop de branches ou de nœuds simples vers la liste séquentielle.
 */

export class ReadOnlyNode {
    constructor(nodeData, image, treeViewer, isRoot = false) {
        this.nodeData = nodeData;
        this.image = image;
        this.treeViewer = treeViewer;
        this.children = [];
        this.parent = null;
        this.isRoot = isRoot;
        this.isDefaultRoot = (this.isRoot && (image.id === 'root' || (!nodeData || !nodeData.url)));
        this.description = nodeData.description || image.description || '';
        this.element = this.createElement();

        this.element.setAttribute('draggable', 'true');
        this.element.addEventListener('dragstart', (e) => {
            e.stopPropagation();

            const collectBranchData = (node) => {
                const nData = { ...node.image, description: node.description, isRoot: node.isRoot };
                let branch = [nData];
                if (node.children && node.children.length > 0) {
                    node.children.forEach(child => {
                        branch = branch.concat(collectBranchData(child));
                    });
                }
                return branch;
            };

            let branchData;
            if (this.treeViewer.selectionMode === 'branch') {
                branchData = collectBranchData(this);
            } else {
                const nData = { ...this.image, description: this.description, isRoot: this.isRoot };
                branchData = [nData];
            }

            const payload = {
                type: 'tree-branch',
                data: branchData
            };

            this.treeViewer.onDragStart(e, payload);
        });
    }

    addChild(node) {
        node.parent = this;
        this.children.push(node);
    }

    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node');
        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');
        const imgElement = document.createElement('img');
        if (this.image.path) {
            const imageId = Number(this.image.id);
            if (this.image.path.startsWith('http')) {
                imgElement.src = this.image.path;
            } else if (!isNaN(imageId) && imageId >= 0) {
                imgElement.src = `/pictograms/${imageId}`;
            } else if (this.image.path.startsWith('/')) {
                imgElement.src = this.image.path;
            } else {
                imgElement.src = `/pictograms/${this.image.path}`;
            }
        }
        imgElement.alt = this.image.name || '';
        contentElement.appendChild(imgElement);

        const nameElement = document.createElement('span');
        nameElement.textContent = this.nodeData.description || this.image.name || '';
        contentElement.appendChild(nameElement);

        nodeElement.appendChild(contentElement);
        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('children');
        nodeElement.appendChild(childrenContainer);

        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.treeViewer.selectTreeNode(this);
        });
        return nodeElement;
    }
}

export class ReadOnlyTreeViewer {
    constructor({
        treeDisplay = typeof document !== 'undefined' ? document.getElementById('tree-display') : null,
        selectionModeRadios = typeof document !== 'undefined' ? document.querySelectorAll('input[name="selectionMode"]') : [],
        onDragStart = () => {}
    } = {}) {
        this.treeDisplay = treeDisplay;
        this.selectionModeRadios = selectionModeRadios;
        this.onDragStart = onDragStart;
        this.selectionMode = 'branch';
        this.selectedNode = null;

        const rootData = {
            id: 'root',
            name: 'Root',
            path: '/static/images/folder-open-bold.png',
        };
        this.treeRoot = new ReadOnlyNode(rootData, rootData, this, true);

        this.initSelectionModeListener();
        this.initDocumentClickListener();
    }

    initSelectionModeListener() {
        this.selectionModeRadios?.forEach(radio => {
            radio.addEventListener('change', (event) => {
                this.selectionMode = event.target.value;
            });
        });
    }

    initDocumentClickListener() {
        if (typeof document === 'undefined') return;
        document.addEventListener('click', (e) => {
            if (!this.treeDisplay) return;
            const isClickInsideTree = this.treeDisplay.contains(e.target);
            if (!isClickInsideTree) {
                this.deselectAllNodes();
            }
        });
    }

    selectTreeNode(theNode) {
        this.deselectAllNodes();
        this.selectedNode = theNode;

        const applyHighlight = (n) => {
            if (n.element) {
                const content = n.element.querySelector('.node-content');
                if (content) {
                    content.classList.add('selected');
                }
            }
            if (this.selectionMode === 'branch') {
                n.children.forEach(applyHighlight);
            }
        };

        if (this.selectedNode) {
            applyHighlight(this.selectedNode);
            if (this.selectedNode.element) {
                this.selectedNode.element.classList.add('is-selected');
            }
        }
    }

    deselectAllNodes() {
        if (!this.treeDisplay) return;
        const selectedElements = this.treeDisplay.querySelectorAll('.node-content.selected');
        selectedElements.forEach(el => el.classList.remove('selected'));
        const selectedNodes = this.treeDisplay.querySelectorAll('.node.is-selected');
        selectedNodes.forEach(el => el.classList.remove('is-selected'));
        this.selectedNode = null;
    }

    rebuildTreeViewer(treeData) {
        if (!this.treeDisplay) return;

        const buildNode = (nodeData) => {
            let image;
            if (nodeData.url) {
                image = {
                    id: nodeData.id !== undefined ? nodeData.id : nodeData.real_id,
                    real_id: nodeData.real_id,
                    name: nodeData.name || 'External Image',
                    path: nodeData.url,
                    description: nodeData.description || nodeData.name
                };
            } else {
                image = null;
            }

            if (!image) {
                image = {
                    id: nodeData.id !== undefined ? nodeData.id : -1,
                    name: 'Image inaccessible',
                    path: '/static/images/prohibit-bold.png',
                    description: 'This image is private or has been deleted.'
                };
            }

            const newNode = new ReadOnlyNode(nodeData, image, this);
            if (nodeData.children) {
                nodeData.children.forEach(childData => {
                    const childNode = buildNode(childData);
                    if (childNode) newNode.addChild(childNode);
                });
            }
            return newNode;
        };

        if (treeData && treeData.roots && treeData.roots.length === 1) {
            const rootData = treeData.roots[0];
            const rootImageId = rootData.id !== 'root' && rootData.id !== undefined ? rootData.id : rootData.real_id;
            const rootImage = {
                id: rootImageId !== undefined ? rootImageId : 'root',
                real_id: rootData.real_id,
                name: rootData.name || 'Root',
                path: rootData.url || '/static/images/folder-open-bold.png',
                description: rootData.description || rootData.name
            };
            this.treeRoot = new ReadOnlyNode(rootData, rootImage, this, true);

            if (rootData.children) {
                rootData.children.forEach(childData => {
                    const childNode = buildNode(childData);
                    if (childNode) this.treeRoot.addChild(childNode);
                });
            }
        } else if (treeData && treeData.roots && treeData.roots.length > 1) {
            const rootDisplayData = { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png', description: 'Root' };
            this.treeRoot = new ReadOnlyNode(rootDisplayData, rootDisplayData, this, true);

            treeData.roots.forEach(rootData => {
                const rootNode = buildNode(rootData);
                if (rootNode) this.treeRoot.addChild(rootNode);
            });
        } else {
            const rootDisplayData = { id: 'root', name: 'Root', path: '/static/images/folder-open-bold.png', description: 'Root' };
            this.treeRoot = new ReadOnlyNode(rootDisplayData, rootDisplayData, this, true);
        }

        this.renderTreeViewer();
    }

    renderTreeViewer() {
        if (!this.treeDisplay) return;
        this.treeDisplay.innerHTML = '';
        this.treeDisplay.appendChild(this.treeRoot.element);
        this.renderTreeChildren(this.treeRoot);
    }

    renderTreeChildren(node) {
        const childrenContainer = node.element.querySelector('.children');
        if (!childrenContainer) return;
        childrenContainer.innerHTML = '';
        node.children.forEach(child => {
            childrenContainer.appendChild(child.element);
            this.renderTreeChildren(child);
        });
    }
}
