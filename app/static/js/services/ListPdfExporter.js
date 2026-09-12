import { NotificationService } from './NotificationService.js';

/**
 * ListPdfExporter - Service dédié au rendu d'impression et à l'export PDF de la liste de pictogrammes.
 */
export class ListPdfExporter {
    constructor({
        printPagesWrapper = typeof document !== 'undefined' ? document.getElementById('print-pages-wrapper') : null,
        zoomLevelText = typeof document !== 'undefined' ? document.getElementById('zoom-level-text') : null,
        exportPdfBtn = typeof document !== 'undefined' ? document.getElementById('export-pdf-btn') : null,
        btnZoomOut = typeof document !== 'undefined' ? document.getElementById('btn-zoom-out') : null,
        btnZoomIn = typeof document !== 'undefined' ? document.getElementById('btn-zoom-in') : null,
        btnRenderPreview = typeof document !== 'undefined' ? document.getElementById('btn-render-preview') : null,
        printImageSize = typeof document !== 'undefined' ? document.getElementById('print-image-size') : null,
        printBorderWidth = typeof document !== 'undefined' ? document.getElementById('print-border-width') : null,
        printSizePx = typeof document !== 'undefined' ? document.getElementById('print-size-px') : null,
        printSizeCm = typeof document !== 'undefined' ? document.getElementById('print-size-cm') : null,
        printBorderWidthVal = typeof document !== 'undefined' ? document.getElementById('print-border-width-val') : null,
        getItemsCallback = () => []
    } = {}) {
        this.printPagesWrapper = printPagesWrapper;
        this.zoomLevelText = zoomLevelText;
        this.exportPdfBtn = exportPdfBtn;
        this.btnZoomOut = btnZoomOut;
        this.btnZoomIn = btnZoomIn;
        this.btnRenderPreview = btnRenderPreview;
        this.printImageSize = printImageSize;
        this.printBorderWidth = printBorderWidth;
        this.printSizePx = printSizePx;
        this.printSizeCm = printSizeCm;
        this.printBorderWidthVal = printBorderWidthVal;
        this.getItemsCallback = getItemsCallback;

        this.currentZoom = 1.0;

        this.initEventListeners();
    }

    initEventListeners() {
        this.btnZoomOut?.addEventListener('click', () => this.changeZoom(-0.1));
        this.btnZoomIn?.addEventListener('click', () => this.changeZoom(0.1));

        this.printImageSize?.addEventListener('input', () => {
            if (this.printSizePx) this.printSizePx.textContent = this.printImageSize.value;
            if (this.printSizeCm) this.printSizeCm.textContent = (this.printImageSize.value / 37.8).toFixed(1);
        });

        this.printBorderWidth?.addEventListener('input', () => {
            if (this.printBorderWidthVal) this.printBorderWidthVal.textContent = this.printBorderWidth.value + 'px';
        });

        this.btnRenderPreview?.addEventListener('click', () => this.renderPreview());
        this.exportPdfBtn?.addEventListener('click', () => this.exportToPdf());

        const printModesAccordion = typeof document !== 'undefined' ? document.getElementById('printModesAccordion') : null;
        if (printModesAccordion) {
            printModesAccordion.addEventListener('show.bs.collapse', (e) => {
                if (e.target.id === 'collapseGridMode') {
                    const modeGrid = document.getElementById('mode-grid');
                    if (modeGrid) modeGrid.checked = true;
                } else if (e.target.id === 'collapseChainMode') {
                    const modeChain = document.getElementById('mode-chain');
                    if (modeChain) modeChain.checked = true;
                }
            });
        }

        // Tab <-> Accordion Synchronization
        const constructAccordion = typeof document !== 'undefined' ? document.getElementById('collapseConstruct') : null;
        const exportAccordion = typeof document !== 'undefined' ? document.getElementById('collapseExportPdf') : null;
        const importTabBtn = typeof document !== 'undefined' ? document.getElementById('import-describe-tab') : null;
        const printTabBtn = typeof document !== 'undefined' ? document.getElementById('print-tab') : null;

        if (constructAccordion && exportAccordion && importTabBtn && printTabBtn && typeof bootstrap !== 'undefined') {
            let isSyncing = false;

            constructAccordion.addEventListener('show.bs.collapse', () => {
                if (isSyncing) return;
                isSyncing = true;
                bootstrap.Tab.getOrCreateInstance(importTabBtn).show();
                isSyncing = false;
            });

            exportAccordion.addEventListener('show.bs.collapse', () => {
                if (isSyncing) return;
                isSyncing = true;
                bootstrap.Tab.getOrCreateInstance(printTabBtn).show();
                isSyncing = false;
            });

            importTabBtn.addEventListener('show.bs.tab', () => {
                if (isSyncing) return;
                isSyncing = true;
                bootstrap.Collapse.getOrCreateInstance(constructAccordion).show();
                isSyncing = false;
            });

            printTabBtn.addEventListener('show.bs.tab', () => {
                if (isSyncing) return;
                isSyncing = true;
                bootstrap.Collapse.getOrCreateInstance(exportAccordion).show();
                isSyncing = false;
            });
        }

        // Print Tab specific logic (hide chain buttons & auto render preview)
        if (printTabBtn && importTabBtn && typeof document !== 'undefined') {
            const deleteLinkBtn = document.getElementById('delete-link-btn');
            const newChainBtn = document.getElementById('new-chain-btn');
            const importLocalPicBtn = document.getElementById('import-local-pic-btn');

            printTabBtn.addEventListener('show.bs.tab', () => {
                if (deleteLinkBtn) deleteLinkBtn.style.display = 'none';
                if (newChainBtn) newChainBtn.style.display = 'none';
                if (importLocalPicBtn) importLocalPicBtn.style.display = 'none';
                this.renderPreview();
            });

            importTabBtn.addEventListener('show.bs.tab', () => {
                if (deleteLinkBtn) deleteLinkBtn.style.display = 'inline-block';
                if (newChainBtn) newChainBtn.style.display = 'inline-block';
                if (importLocalPicBtn) importLocalPicBtn.style.display = 'inline-block';
            });
        }
    }

    changeZoom(delta) {
        this.currentZoom += delta;
        if (this.currentZoom < 0.3) this.currentZoom = 0.3;
        if (this.currentZoom > 2.0) this.currentZoom = 2.0;

        if (this.zoomLevelText) {
            this.zoomLevelText.textContent = Math.round(this.currentZoom * 100) + '%';
        }

        if (this.printPagesWrapper) {
            this.printPagesWrapper.style.transform = `scale(${this.currentZoom})`;
        }
    }

    readSettings() {
        if (typeof document === 'undefined') {
            return {
                orientation: 'portrait',
                imageSize: 100,
                borderWidth: 1,
                borderColor: '#000000',
                showText: true,
                textPosition: 'bottom',
                textPlacement: 'outside',
                textSize: 14,
                mode: 'grid',
                gridMultiplier: 1,
                marginX: 10,
                marginY: 10
            };
        }

        const orientRadios = document.querySelector('input[name="print-orientation"]:checked');
        const orientation = orientRadios ? orientRadios.value : 'portrait';
        const imageSize = parseInt(this.printImageSize?.value || 100, 10);
        const borderWidth = parseInt(this.printBorderWidth?.value || 1, 10);
        const colorRadios = document.querySelector('input[name="print-border-color"]:checked');
        const borderColor = colorRadios ? colorRadios.value : '#000000';
        const showText = document.getElementById('print-show-text')?.checked ?? true;
        const textPosition = document.getElementById('print-text-position')?.value || 'bottom';
        const textPlacement = document.getElementById('print-text-placement')?.value || 'outside';
        const textSizeInput = parseInt(document.getElementById('print-text-size')?.value, 10);
        const textSize = isNaN(textSizeInput) ? 14 : textSizeInput;

        const modeRadios = document.querySelector('input[name="print-mode"]:checked');
        const mode = modeRadios ? modeRadios.value : 'grid';

        const gridMultiplier = parseInt(document.getElementById('print-grid-multiplier')?.value, 10) || 1;

        const rawMarginX = parseInt(document.getElementById('print-margin-x')?.value, 10);
        const marginX = isNaN(rawMarginX) ? 10 : rawMarginX;

        const rawMarginY = parseInt(document.getElementById('print-margin-y')?.value, 10);
        const marginY = isNaN(rawMarginY) ? 10 : rawMarginY;

        return {
            orientation,
            imageSize,
            borderWidth,
            borderColor,
            showText,
            textPosition,
            textPlacement,
            textSize,
            mode,
            gridMultiplier,
            marginX,
            marginY
        };
    }

    calculateLayout(items, settings) {
        const {
            orientation,
            imageSize,
            borderWidth,
            showText,
            textPlacement,
            textSize,
            mode,
            gridMultiplier,
            marginX,
            marginY
        } = settings;

        let itemsToRender = [];
        if (mode === 'grid') {
            for (const item of items) {
                for (let i = 0; i < gridMultiplier; i++) {
                    itemsToRender.push(item);
                }
            }
        } else {
            itemsToRender = [...items];
        }

        const A4_PORTRAIT_W = 794;
        const A4_PORTRAIT_H = 1123;
        const pageWidth = orientation === 'portrait' ? A4_PORTRAIT_W : A4_PORTRAIT_H;
        const pageHeight = orientation === 'portrait' ? A4_PORTRAIT_H : A4_PORTRAIT_W;

        const pagePadding = 40;
        const availWidth = pageWidth - 2 * pagePadding;
        const availHeight = pageHeight - 2 * pagePadding;

        const textHeight = showText ? (textSize + 10) : 0;
        let itemTotalW = imageSize + 2 * borderWidth;
        let itemTotalH = imageSize + 2 * borderWidth;

        if (textPlacement === 'outside') {
            itemTotalH += textHeight;
        }

        if (mode === 'grid') {
            const gap = 5;
            itemTotalW += gap;
            itemTotalH += gap;
        } else {
            itemTotalW += marginX;
            itemTotalH += marginY;
        }

        let cols, rows;
        if (mode === 'chain' && orientation === 'portrait') {
            rows = Math.max(1, Math.floor(availHeight / itemTotalH));
            cols = Math.max(1, Math.floor(availWidth / itemTotalW));
        } else {
            cols = Math.max(1, Math.floor(availWidth / itemTotalW));
            rows = Math.max(1, Math.floor(availHeight / itemTotalH));
        }
        const itemsPerPage = Math.max(1, cols * rows);

        return {
            itemsToRender,
            pageWidth,
            pageHeight,
            pagePadding,
            cols,
            rows,
            itemsPerPage,
            itemTotalW,
            itemTotalH,
            textHeight
        };
    }

    resolveImageUrl(item) {
        const data = item.data || item;
        const imageId = Number(data.image_id);
        const path = data.path || data.url || '';

        if (path && path.startsWith('http')) {
            return path;
        } else if (!isNaN(imageId) && imageId >= 0) {
            return `/pictograms/${imageId}`;
        } else if (path) {
            return path.startsWith('/') || path.startsWith('data:')
                ? path
                : '/pictograms/' + path;
        }
        return '/static/images/prohibit-bold.png';
    }

    renderPreview() {
        if (!this.printPagesWrapper) return;
        this.printPagesWrapper.innerHTML = '';

        const items = this.getItemsCallback() || [];
        if (items.length === 0) {
            this.printPagesWrapper.innerHTML = '<div class="text-center p-5 text-white">No images to print.</div>';
            return;
        }

        const settings = this.readSettings();
        const layout = this.calculateLayout(items, settings);
        const {
            itemsToRender,
            pagePadding,
            itemsPerPage
        } = layout;

        const {
            orientation,
            imageSize,
            borderWidth,
            borderColor,
            showText,
            textPosition,
            textPlacement,
            textSize,
            mode,
            marginX,
            marginY
        } = settings;

        for (let i = 0; i < itemsToRender.length; i += itemsPerPage) {
            const chunk = itemsToRender.slice(i, i + itemsPerPage);

            const pageDiv = document.createElement('div');
            pageDiv.className = `a4-page ${orientation}`;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'page-content';
            contentDiv.style.padding = `${pagePadding}px`;
            contentDiv.style.display = 'flex';
            contentDiv.style.flexWrap = 'wrap';
            contentDiv.style.alignContent = 'flex-start';

            if (mode === 'grid') {
                contentDiv.style.gap = '5px';
            } else {
                contentDiv.style.columnGap = `${marginX}px`;
                contentDiv.style.rowGap = `${marginY}px`;
                if (orientation === 'portrait') {
                    contentDiv.style.flexDirection = 'column';
                }
            }

            chunk.forEach(item => {
                const itemData = item.data || item;
                const itemContainer = document.createElement('div');
                itemContainer.style.display = 'flex';
                itemContainer.style.flexDirection = 'column';
                itemContainer.style.alignItems = 'center';
                itemContainer.style.width = `${imageSize + 2 * borderWidth}px`;

                const imgContainer = document.createElement('div');
                imgContainer.style.border = `${borderWidth}px solid ${borderColor}`;
                imgContainer.style.width = `${imageSize + 2 * borderWidth}px`;
                imgContainer.style.height = `${imageSize + 2 * borderWidth}px`;
                imgContainer.style.display = 'flex';
                imgContainer.style.justifyContent = 'center';
                imgContainer.style.alignItems = 'center';
                imgContainer.style.backgroundColor = 'white';
                imgContainer.style.overflow = 'hidden';
                imgContainer.style.position = 'relative';

                const img = document.createElement('img');
                img.src = this.resolveImageUrl(item);
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.objectFit = 'contain';

                const textSpan = document.createElement('span');
                textSpan.textContent = itemData.description || itemData.name || '';
                textSpan.style.fontSize = `${textSize}px`;
                textSpan.style.fontFamily = 'sans-serif';
                textSpan.style.textAlign = 'center';
                textSpan.style.width = '100%';
                textSpan.style.whiteSpace = 'nowrap';
                textSpan.style.overflow = 'hidden';
                textSpan.style.textOverflow = 'ellipsis';
                textSpan.style.display = 'block';
                textSpan.style.height = `${textSize + 10}px`;
                textSpan.style.lineHeight = `${textSize + 6}px`;
                textSpan.style.padding = '2px';

                if (textPlacement === 'inside') {
                    textSpan.style.position = 'absolute';
                    textSpan.style.left = '0';
                    textSpan.style.right = '0';
                    textSpan.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';

                    if (textPosition === 'top') {
                        textSpan.style.top = '0';
                    } else {
                        textSpan.style.bottom = '0';
                    }

                    imgContainer.appendChild(img);
                    if (showText) imgContainer.appendChild(textSpan);
                    itemContainer.appendChild(imgContainer);
                } else {
                    imgContainer.appendChild(img);

                    if (showText && textPosition === 'top') {
                        itemContainer.appendChild(textSpan);
                    }

                    itemContainer.appendChild(imgContainer);

                    if (showText && textPosition === 'bottom') {
                        itemContainer.appendChild(textSpan);
                    }
                }

                contentDiv.appendChild(itemContainer);
            });

            pageDiv.appendChild(contentDiv);
            this.printPagesWrapper.appendChild(pageDiv);
        }
    }

    async exportToPdf() {
        const items = this.getItemsCallback() || [];
        if (items.length === 0) {
            NotificationService.alert('The list is empty. Add images to the list before exporting.');
            return;
        }

        const originalBtnText = this.exportPdfBtn ? this.exportPdfBtn.innerHTML : '';
        if (this.exportPdfBtn) {
            this.exportPdfBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
            this.exportPdfBtn.disabled = true;
        }

        try {
            const { jsPDF } = window.jspdf;
            const settings = this.readSettings();
            const layout = this.calculateLayout(items, settings);

            const {
                orientation,
                imageSize,
                borderWidth,
                borderColor,
                showText,
                textPosition,
                textPlacement,
                textSize,
                mode
            } = settings;

            const {
                itemsToRender,
                pagePadding,
                cols,
                rows,
                itemsPerPage,
                itemTotalW,
                itemTotalH,
                textHeight
            } = layout;

            const doc = new jsPDF({
                orientation: orientation,
                unit: 'px',
                format: [794, 1123]
            });

            const loadImage = (src, imgId) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);

                    let fullSrc = src;
                    const imageId = Number(imgId);
                    if (src && src.startsWith('http')) {
                        // Keep HTTP URL
                    } else if (!isNaN(imageId) && imageId >= 0) {
                        fullSrc = `/pictograms/${imageId}`;
                    } else if (src && src.startsWith('data:')) {
                        // Keep data URI
                    } else if (src && !src.startsWith('/')) {
                        fullSrc = '/pictograms/' + src;
                    } else if (!src) {
                        fullSrc = '/static/images/prohibit-bold.png';
                    }
                    img.src = fullSrc;
                });
            };

            let currentPage = 1;
            for (let i = 0; i < itemsToRender.length; i++) {
                const pageIndex = Math.floor(i / itemsPerPage);
                if (pageIndex + 1 > currentPage) {
                    doc.addPage();
                    currentPage++;
                }

                const indexOnPage = i % itemsPerPage;
                let col, row;
                if (mode === 'chain' && orientation === 'portrait') {
                    col = Math.floor(indexOnPage / rows);
                    row = indexOnPage % rows;
                } else {
                    row = Math.floor(indexOnPage / cols);
                    col = indexOnPage % cols;
                }

                const x = pagePadding + col * itemTotalW;
                const y = pagePadding + row * itemTotalH;

                const item = itemsToRender[i];
                const itemData = item.data || item;
                const imgElement = await loadImage(itemData.path || itemData.url, itemData.image_id);

                let imgBoxX = x;
                let imgBoxY = y;
                if (showText && textPlacement === 'outside' && textPosition === 'top') {
                    imgBoxY += textHeight;
                }

                if (borderWidth > 0) {
                    doc.setDrawColor(borderColor);
                    doc.setLineWidth(borderWidth);
                    doc.setFillColor('#ffffff');
                    doc.rect(imgBoxX, imgBoxY, imageSize + 2 * borderWidth, imageSize + 2 * borderWidth, 'FD');
                } else {
                    doc.setFillColor('#ffffff');
                    doc.rect(imgBoxX, imgBoxY, imageSize, imageSize, 'F');
                }

                if (imgElement) {
                    const innerSize = imageSize;
                    const iw = imgElement.naturalWidth || imgElement.width || 1;
                    const ih = imgElement.naturalHeight || imgElement.height || 1;
                    const scale = Math.min(innerSize / iw, innerSize / ih);
                    const w = iw * scale;
                    const h = ih * scale;

                    const ix = imgBoxX + borderWidth + (innerSize - w) / 2;
                    const iy = imgBoxY + borderWidth + (innerSize - h) / 2;

                    doc.addImage(imgElement, 'PNG', ix, iy, w, h);
                }

                if (showText) {
                    const textStr = itemData.description || itemData.name || '';
                    doc.setFontSize(textSize);
                    doc.setTextColor('#000000');

                    if (textPlacement === 'inside') {
                        doc.setFillColor('#ffffff');
                        const rectHeight = textSize + 6;
                        const rectY = textPosition === 'top' ? imgBoxY : imgBoxY + imageSize + 2 * borderWidth - rectHeight;
                        doc.rect(imgBoxX + borderWidth, rectY + borderWidth, imageSize, rectHeight, 'F');

                        const textX = imgBoxX + borderWidth + imageSize / 2;
                        const textY = textPosition === 'top' ? imgBoxY + borderWidth + textSize : imgBoxY + imageSize + 2 * borderWidth - 4;
                        const splitTextInside = doc.splitTextToSize(textStr, imageSize);
                        doc.text(splitTextInside[0], textX, textY, { align: 'center' });
                    } else {
                        const textX = imgBoxX + (imageSize + 2 * borderWidth) / 2;
                        let textY;
                        if (textPosition === 'top') {
                            textY = y + textSize + 4;
                        } else {
                            textY = imgBoxY + imageSize + 2 * borderWidth + textSize + 4;
                        }
                        const splitTextOutside = doc.splitTextToSize(textStr, imageSize + 2 * borderWidth);
                        doc.text(splitTextOutside[0], textX, textY, { align: 'center' });
                    }
                }
            }

            doc.save('pictograms-list.pdf');

        } catch (error) {
            console.error(error);
            NotificationService.alert('An error occurred during PDF generation.');
        } finally {
            if (this.exportPdfBtn) {
                this.exportPdfBtn.innerHTML = originalBtnText;
                this.exportPdfBtn.disabled = false;
            }
        }
    }
}
