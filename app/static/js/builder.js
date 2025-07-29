document.addEventListener('DOMContentLoaded', function() {
    const imageSidebar = document.getElementById('image-sidebar');
    const treeDisplay = document.getElementById('tree-display');

    // The images are now passed from the template
    const images = JSON.parse(document.getElementById('images-data').textContent);

    images.forEach(image => {
        const imgElement = document.createElement('img');
        imgElement.src = image.path;
        imgElement.alt = image.name;
        imgElement.dataset.imageId = image.id;
        imageSidebar.appendChild(imgElement);
    });
});
