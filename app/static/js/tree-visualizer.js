document.addEventListener('DOMContentLoaded', () => {
    const visualizeBtn = document.getElementById('visualize-tree-btn');
    const visualizeModal = new bootstrap.Modal(document.getElementById('visualize-modal'));
    const treeVisualizerEl = document.getElementById('tree-visualizer');

    // Function to check if a tree is loaded and enable/disable the button
    const checkTreeStatus = () => {
        if (window.treeBuilder && window.treeBuilder.rootNode.children.length > 0) {
            visualizeBtn.disabled = false;
        } else {
            visualizeBtn.disabled = true;
        }
    };

    // Periodically check if a tree is loaded.
    // This is needed because the tree can be loaded or modified after the page has loaded.
    setInterval(checkTreeStatus, 1000);


    const transformToTreant = (treeData) => {
        const transformNode = (node) => {
            const image = window.treeBuilder.images.find(img => img.id === node.id);
            let imagePath = '/static/images/prohibit-bold.png';
            if (image) {
                 if (image.path.startsWith('/')) {
                    imagePath = image.path;
                } else {
                    imagePath = `/pictograms/${image.path}`;
                }
            }

            const nodeContent = `
                <div class="custom-node">
                    <img src="${imagePath}" alt="${node.name}">
                    <p class="node-description">${node.description || ''}</p>
                </div>
            `;

            const treantNode = {
                innerHTML: nodeContent,
                children: []
            };

            if (node.children && node.children.length > 0) {
                treantNode.children = node.children.map(transformNode);
            }

            return treantNode;
        };

        let nodeStructure;
        if (treeData.roots.length === 1) {
            nodeStructure = transformNode(treeData.roots[0]);
        } else {
            nodeStructure = {
                pseudo: true,
                children: treeData.roots.map(transformNode)
            };
        }
        return nodeStructure;
    };


    if (visualizeBtn) {
        visualizeBtn.addEventListener('click', () => {
            if (window.treeBuilder) {
                const treeData = window.treeBuilder.getTreeAsJSON();
                if (treeData.roots.length === 0) {
                    alert('The tree is empty. Cannot visualize.');
                    return;
                }

                const treantConfig = {
                    chart: {
                        container: "#tree-visualizer",
                        connectors: {
                            type: "step"
                        },
                        node: {
                            collapsable: true
                        }
                    },
                    nodeStructure: transformToTreant(treeData)
                };

                // Clear the container before rendering a new chart
                treeVisualizerEl.innerHTML = '';
                new Treant(treantConfig);
                visualizeModal.show();
            }
        });
    }

    // Initial check
    checkTreeStatus();
});
