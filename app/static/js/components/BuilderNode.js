/**
 * BuilderNode - Représente un nœud dans le canvas de construction d'arbres.
 * Gère la création de l'élément DOM, les interactions visuelles et le glisser-déposer.
 */

/**
 * Résout de manière sécurisée l'URL d'affichage d'un pictogramme.
 * Empêche les attaques XSS par pseudo-protocole (ex: javascript:).
 *
 * @param {Object} image
 * @returns {string} URL sûre vers l'image ou icône par défaut
 */
export function resolveBuilderImageUrl(image) {
    if (!image || !image.path) {
        return '/static/images/folder-open-bold.png';
    }
    const path = String(image.path).trim();
    if (path.toLowerCase().startsWith('javascript:') || path.toLowerCase().startsWith('vbscript:')) {
        return '/static/images/folder-open-bold.png';
    }

    const imageId = Number(image.id);
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:image/')) {
        return path;
    } else if (!isNaN(imageId) && imageId >= 0) {
        return `/pictograms/${imageId}`;
    } else if (path.startsWith('/')) {
        return path;
    } else {
        return `/pictograms/${path}`;
    }
}

export class BuilderNode {
    constructor(image, builder, nodeData = null, isRoot = false) {
        this.image = image || {};
        this.builder = builder;
        this.nodeData = nodeData;
        this.children = [];
        this.parent = null;
        this.isRoot = isRoot;

        // Priorité à la description des données enregistrées, puis aux données d'image
        this.description = (nodeData && nodeData.description !== undefined)
            ? nodeData.description
            : (this.image.description || '');

        this.isDefaultRoot = (this.isRoot && (this.image.id === 'root' || (!nodeData || !nodeData.url)));
        this.element = this.createElement(builder);
    }

    addChild(theNode) {
        theNode.parent = this;
        this.children.push(theNode);
    }

    createElement(builder) {
        if (typeof document === 'undefined') {
            return null;
        }

        const nodeElement = document.createElement('div');
        nodeElement.classList.add('node');
        nodeElement.setAttribute('draggable', (!this.isRoot).toString());

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        imgElement.src = resolveBuilderImageUrl(this.image);
        imgElement.alt = this.image.name || '';

        // Fallback sécurisé en cas d'image introuvable ou corrompue
        imgElement.addEventListener('error', function() {
            const fallbackSrc = '/static/images/folder-open-bold.png';
            if (!this.src.endsWith(fallbackSrc)) {
                this.src = fallbackSrc;
            }
        });

        // Info-bulle (tooltip) sécurisée
        imgElement.addEventListener('mouseover', (e) => {
            if (typeof tooltip !== 'undefined' && tooltip && typeof tooltip.show === 'function') {
                tooltip.show(e, imgElement.src);
            }
        });
        imgElement.addEventListener('mouseout', (e) => {
            if (typeof tooltip !== 'undefined' && tooltip && typeof tooltip.hide === 'function') {
                tooltip.hide(e);
            }
        });

        contentElement.appendChild(imgElement);

        const nameElement = document.createElement('span');
        nameElement.classList.add('node-name');
        nameElement.textContent = this.description || this.image.name || '';
        this.nameElement = nameElement;
        contentElement.appendChild(nameElement);

        if (this.isRoot) {
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
            if (this.isDefaultRoot) {
                contentElement.style.border = '2px dashed #007bff';
                contentElement.style.backgroundColor = '#f8f9fa';
            }
        }

        nodeElement.appendChild(contentElement);

        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('children');
        nodeElement.appendChild(childrenContainer);

        // Sélection au clic
        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation();
            if (builder && typeof builder.selectNode === 'function') {
                builder.selectNode(this);
            }
        });

        // Événements glisser-déposer (DnD)
        nodeElement.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            if (builder && typeof builder.handleDragStart === 'function') {
                builder.handleDragStart(e, this);
            }
        });
        nodeElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (builder && typeof builder.handleDragOver === 'function') {
                builder.handleDragOver(e, this);
            }
        });
        nodeElement.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            if (builder && typeof builder.handleDragLeave === 'function') {
                builder.handleDragLeave(e, this);
            }
        });
        nodeElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (builder && typeof builder.handleDrop === 'function') {
                builder.handleDrop(e, this);
            }
        });
        nodeElement.addEventListener('dragend', (e) => {
            e.stopPropagation();
            if (builder && typeof builder.handleDragEnd === 'function') {
                builder.handleDragEnd(e, this);
            }
        });

        return nodeElement;
    }

    updateDescription(newDescription) {
        this.description = newDescription;
        if (this.nameElement) {
            this.nameElement.textContent = newDescription;
        }
    }
}
