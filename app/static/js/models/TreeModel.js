/**
 * Modèle de données pour la structure arborescente (Pattern Composite).
 * Purement logique, sans dépendance au DOM, testable unitairement.
 */

export class TreeNode {
    constructor({ id = -1, name = '', url = '', path = '', description = '' } = {}) {
        this.id = id;
        this.name = name;
        this.url = url || path;
        this.description = description;
        this.parent = null;
        this.children = [];
    }

    /**
     * Ajoute un nœud enfant.
     * @param {TreeNode} childNode
     * @param {number} [index=-1] Position d'insertion (fin par défaut)
     */
    addChild(childNode, index = -1) {
        if (!(childNode instanceof TreeNode)) {
            throw new TypeError("childNode must be an instance of TreeNode");
        }
        if (childNode === this) {
            throw new Error("Cannot add a node as its own child.");
        }
        if (this.isDescendantOf(childNode)) {
            throw new Error("Cannot move a node into one of its own descendants.");
        }

        if (childNode.parent) {
            childNode.parent.removeChild(childNode);
        }

        childNode.parent = this;
        if (index >= 0 && index < this.children.length) {
            this.children.splice(index, 0, childNode);
        } else {
            this.children.push(childNode);
        }
    }

    /**
     * Retire un nœud enfant direct.
     * @param {TreeNode} childNode
     */
    removeChild(childNode) {
        const idx = this.children.indexOf(childNode);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            childNode.parent = null;
        }
    }

    /**
     * Retire ce nœud de son parent actuel (détachement de la branche).
     */
    remove() {
        if (this.parent) {
            this.parent.removeChild(this);
        }
    }

    /**
     * Détermine si ce nœud est un descendant du nœud passé en paramètre.
     * @param {TreeNode} potentialAncestor
     * @returns {boolean}
     */
    isDescendantOf(potentialAncestor) {
        if (!potentialAncestor || !(potentialAncestor instanceof TreeNode)) {
            return false;
        }
        let current = this.parent;
        while (current) {
            if (current === potentialAncestor) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    /**
     * Déplace ce nœud vers un autre nœud cible.
     * @param {TreeNode} targetNode
     * @param {'child'|'before'|'after'} [position='child']
     */
    moveTo(targetNode, position = 'child') {
        if (!(targetNode instanceof TreeNode)) {
            throw new TypeError("targetNode must be an instance of TreeNode");
        }
        if (targetNode === this || targetNode.isDescendantOf(this)) {
            throw new Error("Cannot move a node into one of its own descendants.");
        }

        if (position === 'child') {
            targetNode.addChild(this);
        } else if (position === 'before' || position === 'after') {
            const targetParent = targetNode.parent;
            if (!targetParent) {
                throw new Error("Cannot place a node before or after a root node without parent.");
            }
            const targetIndex = targetParent.children.indexOf(targetNode);
            const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
            targetParent.addChild(this, insertIndex);
        } else {
            throw new Error(`Unknown position: ${position}`);
        }
    }

    /**
     * Sérialise le nœud et ses enfants au format JSON attendu par l'API.
     * @returns {object}
     */
    toJSON() {
        let imageId = this.id;
        let imageUrl = this.url;

        // Les URLs externes ARASAAC ont conventionnellement id = -1
        if (imageUrl && imageUrl.startsWith('http')) {
            imageId = -1;
        }

        return {
            id: imageId,
            url: imageUrl,
            name: this.name,
            description: this.description,
            children: this.children.map(child => child.toJSON())
        };
    }

    /**
     * Reconstruit récursivement un TreeNode à partir de données JSON.
     * @param {object} data
     * @returns {TreeNode}
     */
    static fromJSON(data) {
        if (!data) return null;
        const node = new TreeNode({
            id: data.id,
            name: data.name,
            url: data.url || data.path,
            description: data.description || ''
        });

        if (Array.isArray(data.children)) {
            data.children.forEach(childData => {
                const childNode = TreeNode.fromJSON(childData);
                if (childNode) {
                    node.addChild(childNode);
                }
            });
        }

        return node;
    }
}

export class TreeModel {
    constructor(rootNode = null) {
        this.root = rootNode;
    }

    setRoot(node) {
        if (node && !(node instanceof TreeNode)) {
            throw new TypeError("root must be an instance of TreeNode");
        }
        this.root = node;
        if (this.root) {
            this.root.parent = null;
        }
    }

    /**
     * Compte le nombre total de nœuds dans l'arbre.
     */
    countNodes() {
        if (!this.root) return 0;
        let count = 0;
        const traverse = (node) => {
            count++;
            node.children.forEach(traverse);
        };
        traverse(this.root);
        return count;
    }

    /**
     * Sérialise l'arbre complet au format attendu par la BDD et l'API : { roots: [...] }
     */
    toJSON() {
        return {
            roots: this.root ? [this.root.toJSON()] : []
        };
    }

    /**
     * Reconstruit un TreeModel à partir d'une structure { roots: [...] }.
     * @param {object} jsonData
     * @returns {TreeModel}
     */
    static fromJSON(jsonData) {
        const tree = new TreeModel();
        if (!jsonData) return tree;

        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        if (data.roots && Array.isArray(data.roots) && data.roots.length > 0) {
            tree.setRoot(TreeNode.fromJSON(data.roots[0]));
        }
        return tree;
    }
}
