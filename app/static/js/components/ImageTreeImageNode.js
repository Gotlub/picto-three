import ImageTreeNode from './ImageTreeNode.js';

export default class ImageTreeImageNode extends ImageTreeNode {
    constructor(data, imageTree) {
        super(data, imageTree);
        this.isLoaded = false;
        this.initElement();

        this.element.setAttribute('draggable', 'true');
        this.element.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            const dragData = {
                type: 'image-tree-node',
                data: this.data
            };
            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
            e.dataTransfer.effectAllowed = 'copy';
        });
    }

    createElement() {
        const nodeElement = document.createElement('div');
        nodeElement.classList.add('image-tree-node', 'image');
        nodeElement.dataset.id = this.data.id;

        const contentElement = document.createElement('div');
        contentElement.classList.add('node-content');

        const imgElement = document.createElement('img');
        imgElement.src = '/static/images/prohibit-bold.png'; // Placeholder
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
            // Only trigger click if the callback is provided, allowing drag-only behavior
            if (this.imageTree.onImageClick) {
                this.imageTree.onImageClick(this.data);
            }
        });

        return nodeElement;
    }

    load() {
        if (this.isLoaded) return;

        const imgElement = document.createElement('img');

        // --- MODIFICATION POUR CHARGER LA MINIATURE ---
        // 1. Remplacer l'extension originale par .jpeg
        const thumbPath = this.data.path.replace(/\.[^/.]+$/, ".jpeg");

        // 2. Pointer vers le dossier des miniatures /pictogramsmin/
        imgElement.src = `/pictogramsmin/${thumbPath}`;
        // --- FIN DE LA MODIFICATION ---

        imgElement.alt = this.data.name;
        imgElement.classList.add('image-tree-node-thumbnail');

        imgElement.onload = () => {
            this.contentElement.innerHTML = '';
            this.contentElement.appendChild(imgElement);
            this.isLoaded = true;
        };

        imgElement.onerror = () => {
            // Gérer les erreurs de chargement (par exemple, miniature non trouvée)
            this.contentElement.innerHTML = '<span class="error-text">Thumb not found</span>';
            console.error(`Impossible de charger la miniature: /pictogramsmin/${thumbPath}`);
        };
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
