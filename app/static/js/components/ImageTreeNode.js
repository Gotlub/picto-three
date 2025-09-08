export default class ImageTreeNode {
    constructor(data, imageTree) {
        this.data = data;
        this.imageTree = imageTree;
        this.parent = null;
        this.element = null;
    }

    createElement() {
        throw new Error("createElement must be implemented by subclass");
    }

    initElement() {
        this.element = this.createElement();
    }
}
