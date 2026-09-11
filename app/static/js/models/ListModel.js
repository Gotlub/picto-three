/**
 * Modèle de données pour la liste séquentielle de pictogrammes (List / Paper Tools).
 * Purement logique, sans dépendance au DOM, testable unitairement.
 */

export class ListItem {
    constructor({ id = -1, image_id = -1, name = '', url = '', path = '', description = '' } = {}) {
        this.imageId = (image_id !== -1) ? image_id : id;
        this.name = name;
        this.url = url || path;
        this.description = description;
    }

    /**
     * Sérialise l'élément pour le stockage dans le JSON de liste.
     * @returns {object}
     */
    toJSON() {
        let effectiveId = this.imageId;
        if (this.url && this.url.startsWith('http')) {
            effectiveId = -1;
        }
        return {
            image_id: effectiveId,
            url: this.url,
            name: this.name,
            description: this.description
        };
    }

    /**
     * Reconstruit un ListItem à partir d'un objet JSON.
     * @param {object} data
     * @returns {ListItem}
     */
    static fromJSON(data) {
        if (!data) return null;
        return new ListItem({
            image_id: data.image_id !== undefined ? data.image_id : data.id,
            name: data.name,
            url: data.url || data.path,
            description: data.description || ''
        });
    }
}

export class ListModel {
    constructor({ name = '', isPublic = false, items = [] } = {}) {
        this.name = name;
        this.isPublic = isPublic;
        this.items = [];
        if (Array.isArray(items)) {
            items.forEach(item => this.addItem(item));
        }
    }

    /**
     * Ajoute un élément à la liste.
     * @param {ListItem|object} item
     * @param {number} [index=-1] Position d'insertion
     */
    addItem(item, index = -1) {
        const listItem = item instanceof ListItem ? item : ListItem.fromJSON(item);
        if (!listItem) return;

        if (index >= 0 && index < this.items.length) {
            this.items.splice(index, 0, listItem);
        } else {
            this.items.push(listItem);
        }
    }

    /**
     * Supprime un élément par son index.
     * @param {number} index
     * @returns {ListItem|null}
     */
    removeItem(index) {
        if (index >= 0 && index < this.items.length) {
            return this.items.splice(index, 1)[0];
        }
        return null;
    }

    /**
     * Déplace un élément d'une position vers une autre (réordonnancement DnD).
     * @param {number} fromIndex
     * @param {number} toIndex
     */
    moveItem(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.items.length) return false;
        if (toIndex < 0 || toIndex >= this.items.length) return false;
        if (fromIndex === toIndex) return true;

        const [item] = this.items.splice(fromIndex, 1);
        this.items.splice(toIndex, 0, item);
        return true;
    }

    /**
     * Vide la liste.
     */
    clear() {
        this.items = [];
    }

    /**
     * Calcule le découpage des éléments en pages pour l'impression / PDF.
     * @param {object} options
     * @param {number} [options.itemsPerPage=6] Nombre d'items par page
     * @returns {ListItem[][]} Tableau de pages
     */
    calculatePages({ itemsPerPage = 6 } = {}) {
        if (itemsPerPage <= 0) itemsPerPage = 1;
        const pages = [];
        for (let i = 0; i < this.items.length; i += itemsPerPage) {
            pages.push(this.items.slice(i, i + itemsPerPage));
        }
        return pages;
    }

    /**
     * Sérialise la charge utile (payload) attendue par l'API /api/lists.
     * @returns {object[]}
     */
    toPayload() {
        return this.items.map(item => item.toJSON());
    }

    /**
     * Reconstruit une ListModel à partir de données JSON ou d'un payload.
     * @param {object|string|Array} data
     * @param {string} [name='']
     * @returns {ListModel}
     */
    static fromJSON(data, name = '') {
        const list = new ListModel({ name });
        if (!data) return list;

        let parsed = data;
        if (typeof data === 'string') {
            try {
                parsed = JSON.parse(data);
            } catch {
                return list;
            }
        }

        // Cas 1 : payload direct sous forme de tableau
        if (Array.isArray(parsed)) {
            parsed.forEach(itemData => list.addItem(itemData));
        } else if (parsed && typeof parsed === 'object') {
            // Cas 2 : objet list complet ({ list_name, payload, ... })
            if (parsed.list_name) list.name = parsed.list_name;
            if (parsed.is_public !== undefined) list.isPublic = parsed.is_public;
            const payload = typeof parsed.payload === 'string' ? JSON.parse(parsed.payload) : parsed.payload;
            if (Array.isArray(payload)) {
                payload.forEach(itemData => list.addItem(itemData));
            }
        }

        return list;
    }
}
