function updateContainerHeight(containerId) {
    const header = document.querySelector('nav.navbar');
    const footer = document.querySelector('footer.footer');
    const mainContent = document.querySelector('main.content');
    const pageContainer = document.getElementById(containerId);

    if (!header || !footer || !mainContent || !pageContainer) {
        return;
    }

    const mainContentStyles = window.getComputedStyle(mainContent);
    const mainMarginTop = parseInt(mainContentStyles.marginTop, 10) || 0;
    const mainMarginBottom = parseInt(mainContentStyles.marginBottom, 10) || 0;

    const headerHeight = header.offsetHeight;
    const footerHeight = footer.offsetHeight;

    const availableHeight = Math.max(0, window.innerHeight - headerHeight - footerHeight - mainMarginTop - mainMarginBottom);

    pageContainer.style.height = `${availableHeight}px`;
}

export function initializeDynamicContainerHeight(containerId) {
    if (!document.getElementById(containerId)) {
        return;
    }

    // Initial call
    updateContainerHeight(containerId);

    // Update on resize
    window.addEventListener('resize', () => updateContainerHeight(containerId));
}