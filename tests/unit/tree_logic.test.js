import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TreeNode, TreeModel } from '../../app/static/js/models/TreeModel.js';

describe('TreeModel & TreeNode Logic', () => {
    it('creates a TreeNode with default and custom attributes', () => {
        const defaultNode = new TreeNode();
        assert.equal(defaultNode.id, -1);
        assert.equal(defaultNode.name, '');
        assert.equal(defaultNode.children.length, 0);
        assert.equal(defaultNode.parent, null);

        const customNode = new TreeNode({
            id: 42,
            name: 'Apple',
            url: '/pictograms/42',
            description: 'Red apple'
        });
        assert.equal(customNode.id, 42);
        assert.equal(customNode.name, 'Apple');
        assert.equal(customNode.url, '/pictograms/42');
        assert.equal(customNode.description, 'Red apple');
    });

    it('builds a multi-level tree hierarchy correctly', () => {
        const root = new TreeNode({ id: 1, name: 'Root' });
        const child1 = new TreeNode({ id: 2, name: 'Meals' });
        const child2 = new TreeNode({ id: 3, name: 'Drinks' });
        const grandchild = new TreeNode({ id: 4, name: 'Water' });

        root.addChild(child1);
        root.addChild(child2);
        child2.addChild(grandchild);

        assert.equal(root.children.length, 2);
        assert.equal(child1.parent, root);
        assert.equal(child2.parent, root);
        assert.equal(grandchild.parent, child2);
        assert.equal(child2.children.length, 1);
        assert.equal(child2.children[0], grandchild);
    });

    it('correctly detects descendants (isDescendantOf)', () => {
        const root = new TreeNode({ id: 1, name: 'Root' });
        const child = new TreeNode({ id: 2, name: 'Child' });
        const grandchild = new TreeNode({ id: 3, name: 'Grandchild' });

        root.addChild(child);
        child.addChild(grandchild);

        assert.equal(grandchild.isDescendantOf(child), true);
        assert.equal(grandchild.isDescendantOf(root), true);
        assert.equal(child.isDescendantOf(root), true);
        assert.equal(root.isDescendantOf(child), false);
        assert.equal(child.isDescendantOf(grandchild), false);
        assert.equal(root.isDescendantOf(grandchild), false);
    });

    it('strictly prevents cycle creation', () => {
        const root = new TreeNode({ id: 1, name: 'Root' });
        const child = new TreeNode({ id: 2, name: 'Child' });
        const grandchild = new TreeNode({ id: 3, name: 'Grandchild' });

        root.addChild(child);
        child.addChild(grandchild);

        // Cannot add self as child
        assert.throws(() => {
            child.addChild(child);
        }, /Cannot add a node as its own child/);

        // Cannot move ancestor into its descendant
        assert.throws(() => {
            root.moveTo(grandchild);
        }, /Cannot move a node into one of its own descendants/);

        assert.throws(() => {
            child.moveTo(grandchild);
        }, /Cannot move a node into one of its own descendants/);
    });

    it('supports moving and reparenting nodes across branches', () => {
        const root = new TreeNode({ id: 1, name: 'Root' });
        const branchA = new TreeNode({ id: 2, name: 'Branch A' });
        const branchB = new TreeNode({ id: 3, name: 'Branch B' });
        const item = new TreeNode({ id: 4, name: 'Item' });

        root.addChild(branchA);
        root.addChild(branchB);
        branchA.addChild(item);

        assert.equal(branchA.children.length, 1);
        assert.equal(branchB.children.length, 0);

        // Move item from Branch A to Branch B
        item.moveTo(branchB);

        assert.equal(branchA.children.length, 0);
        assert.equal(branchB.children.length, 1);
        assert.equal(item.parent, branchB);
        assert.equal(branchB.children[0], item);
    });

    it('supports inserting a node before or after a sibling', () => {
        const root = new TreeNode({ id: 1, name: 'Root' });
        const sibling1 = new TreeNode({ id: 2, name: 'First' });
        const sibling2 = new TreeNode({ id: 3, name: 'Second' });
        const newItem = new TreeNode({ id: 4, name: 'Inserted' });

        root.addChild(sibling1);
        root.addChild(sibling2);

        // Insert newItem before sibling2
        newItem.moveTo(sibling2, 'before');

        assert.equal(root.children.length, 3);
        assert.equal(root.children[0], sibling1);
        assert.equal(root.children[1], newItem);
        assert.equal(root.children[2], sibling2);
    });

    it('deletes nodes and branches correctly', () => {
        const root = new TreeNode({ id: 1, name: 'Root' });
        const child1 = new TreeNode({ id: 2, name: 'Child 1' });
        const child2 = new TreeNode({ id: 3, name: 'Child 2' });

        root.addChild(child1);
        root.addChild(child2);

        child1.remove();

        assert.equal(root.children.length, 1);
        assert.equal(root.children[0], child2);
        assert.equal(child1.parent, null);
    });

    it('serializes and deserializes trees to/from JSON accurately', () => {
        const root = new TreeNode({ id: 1, name: 'Root', url: '/pictograms/1', description: 'Root desc' });
        const child = new TreeNode({ id: 2, name: 'Child', url: '/pictograms/2', description: 'Child desc' });
        const arasaacNode = new TreeNode({ id: 999, name: 'External', url: 'https://static.arasaac.org/123.png', description: 'Arasaac' });

        root.addChild(child);
        child.addChild(arasaacNode);

        const tree = new TreeModel(root);
        const json = tree.toJSON();

        assert.equal(json.roots.length, 1);
        assert.equal(json.roots[0].id, 1);
        assert.equal(json.roots[0].children[0].id, 2);
        // External Arasaac url must have id normalized to -1
        assert.equal(json.roots[0].children[0].children[0].id, -1);
        assert.equal(json.roots[0].children[0].children[0].url, 'https://static.arasaac.org/123.png');

        // Reconstruct from JSON
        const restoredTree = TreeModel.fromJSON(json);
        assert.equal(restoredTree.countNodes(), 3);
        assert.equal(restoredTree.root.name, 'Root');
        assert.equal(restoredTree.root.children[0].name, 'Child');
        assert.equal(restoredTree.root.children[0].children[0].name, 'External');
    });
});
