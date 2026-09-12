import ImageTree from './components/ImageTree.js';
import ArasaacSearch from './components/ArasaacSearch.js';
import { ApiClient } from './services/ApiClient.js';
import { NotificationService } from './services/NotificationService.js';
import { ListPdfExporter } from './services/ListPdfExporter.js';
import { ReadOnlyTreeViewer } from './components/ReadOnlyTreeViewer.js';
import { ChainedListManager } from './components/ChainedListManager.js';

/**
 * ListBuilder - Contrôleur principal de la page /list (Paper Tools).
 * Orchestre les panneaux de sélection, le visualiseur d'arbre, la chaîne séquentielle et l'export PDF.
 */
class ListBuilder {
    constructor() {
        // User & collections state
        const userMeta = typeof document !== 'undefined' ? document.getElementById('current-user-meta') : null;
        const initialUserId = userMeta && userMeta.dataset.userId ? Number(userMeta.dataset.userId) : null;
        this.currentUserId = initialUserId;
        this.userLists = [];
        this.publicLists = [];
        this.userTrees = [];
        this.publicTrees = [];

        // Panneau Gauche - Listes
        this.saveBtn = document.getElementById('save-list-btn');
        this.listNameInput = document.getElementById('list-name');
        this.listSearchInput = document.getElementById('list-search');
        this.listContainer = document.getElementById('list-container');
        this.loadListBtn = document.getElementById('load-list-btn');

        // Panneau Gauche - Arbres
        this.treeContainer = document.getElementById('tree-container');
        this.loadTreeBtn = document.getElementById('load-tree-btn');
        this.treeSearchInput = document.getElementById('tree-search');

        // Panneau Droit - Recherche d'images locales
        this.imageSearchInput = document.getElementById('image-search');
        this.imageTree = new ImageTree('image-sidebar-tree');

        // Panneau Droit - Recherche ARASAAC
        this.arasaacSearch = new ArasaacSearch('arasaac-search-container', (e, payload) => {
            this.handleSourceDragStart(e, payload);
        });

        // Panneau Central - Visualiseur d'arbre en lecture seule
        this.treeViewer = new ReadOnlyTreeViewer({
            onDragStart: (e, payload) => this.handleSourceDragStart(e, payload)
        });

        // Panneau Inférieur - Gestionnaire de la liste séquentielle
        this.chainedList = new ChainedListManager();

        // Moteur de rendu d'impression et export PDF
        this.pdfExporter = new ListPdfExporter({
            getItemsCallback: () => this.chainedList.items
        });

        this.initEventListeners();
        this.loadSavedLists();
        this.loadSavedTrees();
    }

    initEventListeners() {
        // Panneau Gauche - Listes
        this.saveBtn?.addEventListener('click', () => this.saveList());
        this.loadListBtn?.addEventListener('click', () => this.loadSelectedList());
        this.listSearchInput?.addEventListener('input', () => this.filterLists());

        // Panneau Gauche - Arbres
        this.loadTreeBtn?.addEventListener('click', () => this.loadSelectedTree());
        this.treeSearchInput?.addEventListener('input', () => this.filterTrees());

        // Panneau Droit - Filtre d'images locales
        this.imageSearchInput?.addEventListener('input', () => this.filterImages());
    }

    handleSourceDragStart(e, payload) {
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
        this.chainedList.setSourceDrag(payload);
    }

    filterImages() {
        const searchTerm = this.imageSearchInput?.value || '';
        this.imageTree.filter(searchTerm);
    }

    // --- Sauvegarde et Chargement des Listes (Panneau Gauche) ---
    async saveList() {
        const userMeta = typeof document !== 'undefined' ? document.getElementById('current-user-meta') : null;
        const metaUserId = userMeta && userMeta.dataset.userId ? Number(userMeta.dataset.userId) : null;
        const currentUserId = this.currentUserId || metaUserId;

        if (!currentUserId) {
            const msg = (typeof window !== 'undefined' && window.translations && window.translations.accountRequired)
                ? window.translations.accountRequired
                : 'You must create an account to use this feature.';
            NotificationService.alert(msg);
            return;
        }

        const listName = (this.listNameInput ? this.listNameInput.value : '').trim();
        if (!listName) {
            NotificationService.alert('Please enter a name for the list.');
            return;
        }

        if (!this.chainedList.items || this.chainedList.items.length === 0) {
            NotificationService.alert('Cannot save an empty list.');
            return;
        }

        const userLists = Array.isArray(this.userLists) ? this.userLists : [];
        const existingList = userLists.find(list => list && list.list_name === listName);
        let proceed = true;

        if (existingList) {
            proceed = NotificationService.confirm('A list with this name already exists. Do you want to overwrite it?');
        }

        if (!proceed) {
            return;
        }

        const payload = this.chainedList.toPayload();

        try {
            const result = await ApiClient.post('/api/lists', {
                list_name: listName,
                payload: payload
            });

            if (result && result.status === 'success') {
                const message = existingList ? 'Updated' : 'Created';
                NotificationService.alert(message);
                await this.loadSavedLists();
            } else {
                NotificationService.alert(`Error: ${result ? result.message : 'Unknown error'}`);
            }
        } catch (e) {
            console.error('Erreur sauvegarde:', e);
            const errorMsg = e.message || 'La sauvegarde a échoué. Vérifiez votre connexion et réessayez.';
            NotificationService.alert(errorMsg);
        }
    }

    async loadSavedLists() {
        try {
            const data = await ApiClient.get('/api/lists');
            if (data && data.current_user_id) {
                this.currentUserId = data.current_user_id;
            }
            this.publicLists = Array.isArray(data?.public_lists) ? data.public_lists : [];
            this.userLists = Array.isArray(data?.user_lists) ? data.user_lists : [];
        } catch (e) {
            console.error('Impossible de charger les listes:', e);
            NotificationService.alert('Impossible de charger les listes sauvegardées.');
            this.publicLists = [];
            this.userLists = [];
        }
        this.renderLoadableLists();
    }

    renderLoadableLists() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';

        const createSelectList = (lists, title) => {
            if (lists.length > 0) {
                const titleEl = document.createElement('h6');
                titleEl.textContent = title;
                this.listContainer.appendChild(titleEl);

                const select = document.createElement('select');
                select.className = 'form-control mb-2 list-select-input';
                select.setAttribute('size', '5');
                lists.forEach(list => {
                    const option = document.createElement('option');
                    option.value = list.id;
                    option.textContent = list.username ? `${list.username} - ${list.list_name}` : list.list_name;
                    option.dataset.listData = JSON.stringify(list);
                    select.appendChild(option);
                });
                this.listContainer.appendChild(select);
            }
        };

        createSelectList(this.userLists, 'My Private Lists');
        createSelectList(this.publicLists, 'Public Lists');
    }

    loadSelectedList() {
        let selectedOption = null;
        const selectLists = this.listContainer ? this.listContainer.querySelectorAll('select') : [];
        for (const select of selectLists) {
            if (select.selectedIndex > -1) {
                selectedOption = select.options[select.selectedIndex];
                break;
            }
        }

        if (!selectedOption) {
            NotificationService.alert('Please select a list to load.');
            return;
        }

        try {
            const listData = JSON.parse(selectedOption.dataset.listData);
            const payload = typeof listData.payload === 'string' ? JSON.parse(listData.payload) : listData.payload;
            this.chainedList.setItemsFromPayload(payload);
        } catch (e) {
            console.error('Erreur de lecture de la liste:', e);
            NotificationService.alert('Données de liste corrompues.');
        }
    }

    filterLists() {
        const searchTerm = this.listSearchInput ? this.listSearchInput.value.toLowerCase() : '';
        const selectLists = this.listContainer ? this.listContainer.querySelectorAll('select') : [];
        selectLists.forEach(select => {
            Array.from(select.options).forEach(option => {
                const optionText = option.textContent.toLowerCase();
                option.style.display = optionText.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // --- Visualiseur d'Arbre (Panneau Gauche & Central) ---
    async loadSavedTrees() {
        try {
            const data = await ApiClient.get('/api/trees/load');
            if (data && data.current_user_id) {
                this.currentUserId = data.current_user_id;
            }
            this.publicTrees = Array.isArray(data?.public_trees) ? data.public_trees : [];
            this.userTrees = Array.isArray(data?.user_trees) ? data.user_trees : [];
        } catch (e) {
            console.error('Impossible de charger les arbres:', e);
            NotificationService.alert('Impossible de charger les arbres sauvegardés.');
            this.publicTrees = [];
            this.userTrees = [];
        }
        this.renderLoadableTrees();
    }

    renderLoadableTrees() {
        if (!this.treeContainer) return;
        this.treeContainer.innerHTML = '';

        const selectLists = [];

        const createSelectList = (trees, title) => {
            if (trees.length > 0) {
                const titleEl = document.createElement('h6');
                titleEl.textContent = title;
                this.treeContainer.appendChild(titleEl);

                const select = document.createElement('select');
                select.className = 'form-control mb-2 tree-select-list';
                select.setAttribute('size', '5');
                trees.forEach(tree => {
                    const option = document.createElement('option');
                    option.value = tree.id;
                    option.textContent = tree.username ? `${tree.username} - ${tree.name}` : tree.name;
                    option.dataset.treeData = tree.json_data;
                    select.appendChild(option);
                });
                this.treeContainer.appendChild(select);
                selectLists.push(select);
            }
        };

        createSelectList(this.userTrees, 'My Private Trees');
        createSelectList(this.publicTrees, 'Public Trees');

        selectLists.forEach(currentSelect => {
            currentSelect.addEventListener('click', () => {
                selectLists.forEach(otherSelect => {
                    if (otherSelect !== currentSelect) {
                        otherSelect.selectedIndex = -1;
                    }
                });
            });
        });
    }

    loadSelectedTree() {
        let selectedOption = null;
        const selectLists = this.treeContainer ? this.treeContainer.querySelectorAll('select.tree-select-list') : [];
        for (const select of selectLists) {
            if (select.selectedIndex > -1) {
                selectedOption = select.options[select.selectedIndex];
                break;
            }
        }

        if (!selectedOption) {
            NotificationService.alert('Please select a tree to load.');
            return;
        }

        try {
            const treeData = JSON.parse(selectedOption.dataset.treeData);
            this.treeViewer.rebuildTreeViewer(treeData);
        } catch (e) {
            console.error('Erreur de chargement de l\'arbre:', e);
            NotificationService.alert('Données corrompues.');
        }
    }

    filterTrees() {
        const searchTerm = this.treeSearchInput ? this.treeSearchInput.value.toLowerCase() : '';
        const treeLists = this.treeContainer ? this.treeContainer.querySelectorAll('.tree-select-list') : [];

        treeLists.forEach(select => {
            Array.from(select.options).forEach(option => {
                const optionText = option.textContent.toLowerCase();
                option.style.display = optionText.includes(searchTerm) ? '' : 'none';
            });
        });
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        new ListBuilder();
    });
}
