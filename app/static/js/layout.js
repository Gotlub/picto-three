function adjustContentHeight() {
    const header = document.querySelector('.navbar');
    const footer = document.querySelector('.footer');
    const content = document.querySelector('.content');

    if (header && footer && content) {
        const headerHeight = header.offsetHeight;
        const footerHeight = footer.offsetHeight;
        const windowHeight = window.innerHeight;

        const contentHeight = windowHeight - headerHeight - footerHeight;

        content.style.height = `${contentHeight}px`;
    }
}

// Adjust on initial load
document.addEventListener('DOMContentLoaded', adjustContentHeight);

// Adjust on window resize
window.addEventListener('resize', adjustContentHeight);
