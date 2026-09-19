import { NotificationService } from './NotificationService.js';
import { ApiClient } from './ApiClient.js';

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
        this._previewTimer = null;

        this.initEventListeners();
    }

    schedulePreview() {
        if (this._previewTimer) {
            if (typeof cancelAnimationFrame !== 'undefined') {
                cancelAnimationFrame(this._previewTimer);
            } else {
                clearTimeout(this._previewTimer);
            }
        }
        if (typeof requestAnimationFrame !== 'undefined') {
            this._previewTimer = requestAnimationFrame(() => {
                this._previewTimer = null;
                this.renderPreview();
            });
        } else {
            this.renderPreview();
        }
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
                this.renderPreview();
            });
        }

        // Tab <-> Accordion Synchronization & Live rendering on tab switch
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
                this.renderPreview();
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

        // Real-time WYSIWYG auto-rendering on any print option modification
        if (exportAccordion) {
            exportAccordion.addEventListener('change', (e) => {
                if (e.target.closest && e.target.closest('#savePrintOptionModal')) return;
                this.renderPreview();
            });

            exportAccordion.addEventListener('input', (e) => {
                if (e.target.closest && e.target.closest('#savePrintOptionModal')) return;
                this.schedulePreview();
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

        // Progressive Disclosure: Borders select (0 to 3)
        const borderCountSelect = typeof document !== 'undefined' ? document.getElementById('print-border-count') : null;
        const bordersContainer = typeof document !== 'undefined' ? document.getElementById('print-borders-container') : null;

        const updateBorderVisibility = () => {
            const count = parseInt(borderCountSelect?.value || 1, 10);
            if (bordersContainer) {
                bordersContainer.style.display = count === 0 ? 'none' : 'block';
            }
            for (let i = 1; i <= 3; i++) {
                const settingDiv = document.getElementById(`border-settings-${i}`);
                if (settingDiv) {
                    settingDiv.style.display = i <= count ? 'block' : 'none';
                }
            }
        };

        if (borderCountSelect) {
            borderCountSelect.addEventListener('change', () => {
                updateBorderVisibility();
                this.renderPreview();
            });
            updateBorderVisibility();
        }

        // Live input listeners for border widths and colors
        for (let i = 1; i <= 3; i++) {
            const widthInput = typeof document !== 'undefined' ? document.getElementById(`print-border-width-${i}`) : null;
            const widthVal = typeof document !== 'undefined' ? document.getElementById(`print-border-width-val-${i}`) : null;
            if (widthInput) {
                widthInput.addEventListener('input', () => {
                    if (widthVal) widthVal.textContent = widthInput.value + 'px';
                });
            }
        }

        // Progressive Disclosure: Text options toggle
        const showTextSwitch = typeof document !== 'undefined' ? document.getElementById('print-show-text') : null;
        const textOptionsContainer = typeof document !== 'undefined' ? document.getElementById('print-text-options-container') : null;
        if (showTextSwitch && textOptionsContainer) {
            showTextSwitch.addEventListener('change', () => {
                textOptionsContainer.style.display = showTextSwitch.checked ? 'block' : 'none';
                this.renderPreview();
            });
        }

        this.initPresets();
    }

    initPresets() {
        if (typeof document === 'undefined') return;

        const presetSelect = document.getElementById('print-preset-select');
        const btnOpenSaveModal = document.getElementById('btn-open-save-print-options');
        const btnConfirmSave = document.getElementById('btn-confirm-save-print-option');
        const btnDeletePreset = document.getElementById('btn-delete-preset');

        if (!presetSelect) return;

        this.loadSavedPrintOptions();

        presetSelect.addEventListener('change', () => {
            const presetKey = presetSelect.value;
            if (presetKey) {
                this.applyPreset(presetKey);
                this.renderPreview();
            }
        });

        btnOpenSaveModal?.addEventListener('click', () => {
            const modalEl = document.getElementById('savePrintOptionModal');
            const nameInput = document.getElementById('print-option-name');
            if (nameInput) nameInput.value = '';
            if (modalEl && typeof window !== 'undefined' && window.bootstrap?.Modal) {
                const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
            }
        });

        btnConfirmSave?.addEventListener('click', () => {
            const nameInput = document.getElementById('print-option-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                NotificationService.alert(window.translations?.enterOptionName || 'Please enter a name for the print options.');
                return;
            }

            const currentSettings = this.readSettings();
            currentSettings.name = name;

            const saveLocal = (key, data) => {
                const custom = this.getCustomPresets();
                custom[key] = data;
                try {
                    localStorage.setItem(this.getPresetStorageKey(), JSON.stringify(custom));
                } catch (e) {
                    console.warn('Could not save to localStorage', e);
                }
            };

            const closeModal = () => {
                const modalEl = document.getElementById('savePrintOptionModal');
                if (modalEl && typeof window !== 'undefined' && window.bootstrap?.Modal) {
                    const modal = window.bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
            };

            const userMeta = document.getElementById('current-user-meta');
            const userId = userMeta && userMeta.dataset.userId ? userMeta.dataset.userId : null;

            if (userId) {
                ApiClient.post('/api/print_options', { name, payload: currentSettings })
                    .then((resp) => {
                        const savedOpt = resp.print_option;
                        const key = 'api_' + savedOpt.id;
                        saveLocal(key, { ...currentSettings, id: savedOpt.id, apiId: savedOpt.id });
                        this.populatePresetDropdown(key);
                        closeModal();
                        NotificationService.alert(window.translations?.presetSaved || `Print options "${name}" saved successfully!`);
                    })
                    .catch((err) => {
                        console.warn('API save failed, falling back to local:', err);
                        const key = 'custom_' + Date.now();
                        saveLocal(key, currentSettings);
                        this.populatePresetDropdown(key);
                        closeModal();
                        NotificationService.alert(window.translations?.presetSaved || `Print options "${name}" saved successfully!`);
                    });
            } else {
                const key = 'custom_' + Date.now();
                saveLocal(key, currentSettings);
                this.populatePresetDropdown(key);
                closeModal();
                NotificationService.alert(window.translations?.presetSaved || `Print options "${name}" saved successfully!`);
            }
        });

        btnDeletePreset?.addEventListener('click', () => {
            const presetKey = presetSelect.value;
            if (!presetKey) {
                return;
            }
            if (!NotificationService.confirm(window.translations?.confirmDeletePreset || 'Delete this print option?')) {
                return;
            }

            const customPresets = this.getCustomPresets();
            const item = customPresets[presetKey];
            const apiId = item?.apiId || (presetKey.startsWith('api_') ? presetKey.replace('api_', '') : null);

            delete customPresets[presetKey];
            try {
                localStorage.setItem(this.getPresetStorageKey(), JSON.stringify(customPresets));
            } catch (e) {
                console.warn('Could not update localStorage', e);
            }

            if (apiId) {
                ApiClient.delete(`/api/print_options/${apiId}`).catch((err) => {
                    console.warn('Could not delete print option on server', err);
                });
            }

            this.populatePresetDropdown('');
            this.renderPreview();
        });
    }

    async loadSavedPrintOptions() {
        if (typeof document === 'undefined') return;
        const userMeta = document.getElementById('current-user-meta');
        const userId = userMeta && userMeta.dataset.userId ? userMeta.dataset.userId : null;
        if (userId) {
            try {
                const resp = await ApiClient.get('/api/print_options');
                if (resp && Array.isArray(resp.print_options)) {
                    const custom = this.getCustomPresets();
                    resp.print_options.forEach((opt) => {
                        const key = 'api_' + opt.id;
                        let payloadData;
                        try {
                            payloadData = typeof opt.payload === 'string' ? JSON.parse(opt.payload) : opt.payload;
                        } catch {
                            payloadData = {};
                        }
                        custom[key] = {
                            ...payloadData,
                            name: opt.name,
                            id: opt.id,
                            apiId: opt.id
                        };
                    });
                    try {
                        localStorage.setItem(this.getPresetStorageKey(), JSON.stringify(custom));
                    } catch (e) {
                        console.warn('Could not cache options in localStorage', e);
                    }
                }
            } catch (err) {
                console.warn('Could not load remote print options:', err);
            }
        }
        this.populatePresetDropdown('');
    }

    getPresetStorageKey() {
        if (typeof document === 'undefined') return 'picto_print_presets_anon';
        const userMeta = document.getElementById('current-user-meta');
        const userId = userMeta && userMeta.dataset.userId ? userMeta.dataset.userId : 'anon';
        return `picto_print_presets_${userId}`;
    }

    getDefaultPresets() {
        return {};
    }

    getCustomPresets() {
        if (typeof localStorage === 'undefined') return {};
        try {
            const key = this.getPresetStorageKey();
            const raw = localStorage.getItem(key) || (key !== 'picto_print_presets_anon' ? localStorage.getItem('picto_print_presets') : null);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    populatePresetDropdown(selectedKey = '') {
        const presetSelect = document.getElementById('print-preset-select');
        if (!presetSelect) return;
        const currentVal = selectedKey !== null ? selectedKey : (presetSelect.value || '');
        presetSelect.innerHTML = '';

        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        placeholderOpt.textContent = window.translations?.selectPrintOption || '-- Load print options --';
        presetSelect.appendChild(placeholderOpt);

        const customPresets = this.getCustomPresets();
        const customKeys = Object.keys(customPresets);
        for (const key of customKeys) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = customPresets[key].name || key;
            presetSelect.appendChild(opt);
        }

        presetSelect.value = currentVal;
    }

    applyPreset(presetKey) {
        const custom = this.getCustomPresets();
        const preset = custom[presetKey];
        if (!preset) return;

        const orientRadio = document.querySelector(`input[name="print-orientation"][value="${preset.orientation}"]`);
        if (orientRadio) orientRadio.checked = true;

        if (this.printImageSize && preset.imageSize) {
            this.printImageSize.value = preset.imageSize;
            if (this.printSizePx) this.printSizePx.textContent = preset.imageSize;
            if (this.printSizeCm) this.printSizeCm.textContent = (preset.imageSize / 37.8).toFixed(1);
        }

        const borderCountSelect = document.getElementById('print-border-count');
        const bordersContainer = document.getElementById('print-borders-container');
        const borderCount = preset.borderCount !== undefined ? preset.borderCount : (preset.showBorders === false ? 0 : 1);
        if (borderCountSelect) {
            borderCountSelect.value = String(borderCount);
            if (bordersContainer) bordersContainer.style.display = borderCount === 0 ? 'none' : 'block';
            for (let i = 1; i <= 3; i++) {
                const settingDiv = document.getElementById(`border-settings-${i}`);
                if (settingDiv) settingDiv.style.display = i <= borderCount ? 'block' : 'none';
            }
        }

        if (Array.isArray(preset.borders)) {
            preset.borders.forEach((b, idx) => {
                const i = idx + 1;
                const widthInput = document.getElementById(`print-border-width-${i}`);
                const widthVal = document.getElementById(`print-border-width-val-${i}`);
                if (widthInput && b.width !== undefined) {
                    widthInput.value = b.width;
                    if (widthVal) widthVal.textContent = b.width + 'px';
                }
                if (b.color) {
                    const colorRadio = document.querySelector(`input[name="print-border-color-${i}"][value="${b.color}"]`);
                    if (colorRadio) colorRadio.checked = true;
                }
            });
        } else if (preset.borderWidth !== undefined) {
            const widthInput = document.getElementById('print-border-width-1');
            const widthVal = document.getElementById('print-border-width-val-1');
            if (widthInput) {
                widthInput.value = preset.borderWidth;
                if (widthVal) widthVal.textContent = preset.borderWidth + 'px';
            }
            if (preset.borderColor) {
                const colorRadio = document.querySelector(`input[name="print-border-color-1"][value="${preset.borderColor}"]`);
                if (colorRadio) colorRadio.checked = true;
            }
        }

        const showTextSwitch = document.getElementById('print-show-text');
        const textOptionsContainer = document.getElementById('print-text-options-container');
        if (showTextSwitch) {
            showTextSwitch.checked = preset.showText ?? true;
            if (textOptionsContainer) textOptionsContainer.style.display = showTextSwitch.checked ? 'block' : 'none';
        }
        const textBoxSwitch = document.getElementById('print-text-box');
        if (textBoxSwitch) {
            textBoxSwitch.checked = !!preset.textBox;
        }
        const textPosSelect = document.getElementById('print-text-position');
        if (textPosSelect && preset.textPosition) textPosSelect.value = preset.textPosition;
        const textPlacementSelect = document.getElementById('print-text-placement');
        if (textPlacementSelect && preset.textPlacement) textPlacementSelect.value = preset.textPlacement;
        const textSizeInput = document.getElementById('print-text-size');
        if (textSizeInput && preset.textSize) textSizeInput.value = preset.textSize;

        const modeRadio = document.querySelector(`input[name="print-mode"][value="${preset.mode}"]`);
        if (modeRadio) modeRadio.checked = true;
        const gridMultiplierInput = document.getElementById('print-grid-multiplier');
        if (gridMultiplierInput && preset.gridMultiplier) gridMultiplierInput.value = preset.gridMultiplier;

        const chainDirRadio = document.querySelector(`input[name="print-chain-direction"][value="${preset.chainDirection}"]`);
        if (chainDirRadio) chainDirRadio.checked = true;

        const marginXInput = document.getElementById('print-margin-x');
        if (marginXInput && preset.marginX !== undefined) marginXInput.value = preset.marginX;
        const marginYInput = document.getElementById('print-margin-y');
        if (marginYInput && preset.marginY !== undefined) marginYInput.value = preset.marginY;
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
                showBorders: true,
                borderCount: 1,
                borders: [{ width: 2, color: '#000000' }],
                effectiveBorderWidth: 2,
                borderWidth: 2,
                borderColor: '#000000',
                showText: true,
                textBox: false,
                textPosition: 'bottom',
                textPlacement: 'outside',
                textSize: 14,
                mode: 'grid',
                gridMultiplier: 1,
                chainDirection: 'horizontal',
                marginX: 10,
                marginY: 10
            };
        }

        const orientRadios = document.querySelector('input[name="print-orientation"]:checked');
        const orientation = orientRadios ? orientRadios.value : 'portrait';
        const imageSize = parseInt(this.printImageSize?.value || 100, 10);

        const borderCount = parseInt(document.getElementById('print-border-count')?.value || 1, 10);
        const showBorders = borderCount > 0;

        const borders = [];
        for (let i = 1; i <= 3; i++) {
            const w = parseInt(document.getElementById(`print-border-width-${i}`)?.value || 2, 10);
            const cRadio = document.querySelector(`input[name="print-border-color-${i}"]:checked`);
            const c = cRadio ? cRadio.value : (i === 2 ? '#FFFFFF' : '#000000');
            if (i <= borderCount) {
                borders.push({ width: w, color: c });
            }
        }

        const effectiveBorderWidth = showBorders
            ? borders.reduce((acc, b) => acc + b.width, 0)
            : 0;

        const borderWidth = borders[0]?.width || 1;
        const borderColor = borders[0]?.color || '#000000';

        const showText = document.getElementById('print-show-text')?.checked ?? true;
        const textBox = document.getElementById('print-text-box')?.checked ?? false;
        const textPosition = document.getElementById('print-text-position')?.value || 'bottom';
        const textPlacement = document.getElementById('print-text-placement')?.value || 'outside';
        const textSizeInput = parseInt(document.getElementById('print-text-size')?.value, 10);
        const textSize = isNaN(textSizeInput) ? 14 : textSizeInput;

        const modeRadios = document.querySelector('input[name="print-mode"]:checked');
        const mode = modeRadios ? modeRadios.value : 'grid';

        const rawGridMultiplier = parseInt(document.getElementById('print-grid-multiplier')?.value, 10);
        const gridMultiplier = isNaN(rawGridMultiplier) ? 1 : Math.max(1, Math.min(50, rawGridMultiplier));

        const chainDirRadios = document.querySelector('input[name="print-chain-direction"]:checked');
        const chainDirection = chainDirRadios ? chainDirRadios.value : 'horizontal';

        const rawMarginX = parseInt(document.getElementById('print-margin-x')?.value, 10);
        const marginX = isNaN(rawMarginX) ? 10 : rawMarginX;

        const rawMarginY = parseInt(document.getElementById('print-margin-y')?.value, 10);
        const marginY = isNaN(rawMarginY) ? 10 : rawMarginY;

        return {
            orientation,
            imageSize,
            effectiveBorderWidth,
            showBorders,
            borderCount,
            borders,
            borderWidth,
            borderColor,
            showText,
            textBox,
            textPosition,
            textPlacement,
            textSize,
            mode,
            gridMultiplier,
            chainDirection,
            marginX,
            marginY
        };
    }

    calculateLayout(items, settings) {
        const {
            orientation,
            imageSize,
            effectiveBorderWidth: rawEffectiveBorder,
            borderWidth = 1,
            showBorders = true,
            borderCount = 1,
            borders = [],
            textBox = false,
            chainDirection = 'horizontal',
            showText,
            textPlacement,
            textSize,
            mode,
            gridMultiplier = 1,
            marginX = 10,
            marginY = 10
        } = settings;

        const safeMultiplier = Math.max(1, Math.min(50, parseInt(gridMultiplier, 10) || 1));
        let itemsToRender = [];
        if (mode === 'grid') {
            for (const item of items) {
                for (let i = 0; i < safeMultiplier; i++) {
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

        let effectiveBorderWidth;
        if (rawEffectiveBorder !== undefined) {
            effectiveBorderWidth = rawEffectiveBorder;
        } else if (borders && borders.length > 0) {
            effectiveBorderWidth = showBorders ? borders.reduce((acc, b) => acc + b.width, 0) : 0;
        } else {
            effectiveBorderWidth = showBorders ? borderWidth : 0;
        }
        const textHeight = showText ? (textSize + 10) : 0;
        let itemTotalW = imageSize + 2 * effectiveBorderWidth;
        let itemTotalH = imageSize + 2 * effectiveBorderWidth;

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
        if (mode === 'chain') {
            if (chainDirection === 'vertical') {
                rows = Math.max(1, Math.floor(availHeight / itemTotalH));
                cols = Math.max(1, Math.floor(availWidth / itemTotalW));
            } else {
                cols = Math.max(1, Math.floor(availWidth / itemTotalW));
                rows = Math.max(1, Math.floor(availHeight / itemTotalH));
            }
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
            textHeight,
            effectiveBorderWidth,
            showBorders,
            borderCount,
            borders,
            textBox,
            chainDirection
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
            itemsPerPage,
            effectiveBorderWidth
        } = layout;

        const {
            orientation,
            imageSize,
            showBorders,
            borders = [],
            showText,
            textBox,
            textPosition,
            textPlacement,
            textSize,
            mode,
            chainDirection,
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
                if (chainDirection === 'vertical') {
                    contentDiv.style.flexDirection = 'column';
                } else {
                    contentDiv.style.flexDirection = 'row';
                }
            }

            chunk.forEach(item => {
                const itemData = item.data || item;
                const itemContainer = document.createElement('div');
                itemContainer.style.display = 'flex';
                itemContainer.style.flexDirection = 'column';
                itemContainer.style.alignItems = 'center';
                itemContainer.style.width = `${imageSize + 2 * effectiveBorderWidth}px`;

                // Fixed inner box strictly sized to imageSize x imageSize.
                // Ensures image area never shrinks, and borders never encroach inside or sit under/over the image.
                const innerBox = document.createElement('div');
                innerBox.style.width = `${imageSize}px`;
                innerBox.style.height = `${imageSize}px`;
                innerBox.style.display = 'flex';
                innerBox.style.justifyContent = 'center';
                innerBox.style.alignItems = 'center';
                innerBox.style.backgroundColor = '#ffffff';
                innerBox.style.position = 'relative';
                innerBox.style.overflow = 'hidden';
                innerBox.style.flexShrink = '0';
                innerBox.style.boxSizing = 'border-box';

                const img = document.createElement('img');
                img.src = this.resolveImageUrl(item);
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.objectFit = 'contain';
                img.style.position = 'relative';
                img.style.zIndex = '1';
                innerBox.appendChild(img);

                // Multi-borders styling (Border 1: Inner, Border 2: Middle, Border 3: Outer)
                // Wrap outward: Border 1 directly wraps innerBox, Border 2 wraps Border 1, Border 3 wraps Border 2.
                let borderWrapper = innerBox;
                if (showBorders && effectiveBorderWidth > 0 && borders && borders.length > 0) {
                    for (let bIndex = 0; bIndex < borders.length; bIndex++) {
                        const b = borders[bIndex];
                        if (!b || b.width <= 0) continue;
                        const bWrap = document.createElement('div');
                        bWrap.style.display = 'flex';
                        bWrap.style.justifyContent = 'center';
                        bWrap.style.alignItems = 'center';
                        bWrap.style.border = `${b.width}px solid ${b.color}`;
                        bWrap.style.boxSizing = 'content-box';
                        bWrap.style.flexShrink = '0';
                        bWrap.appendChild(borderWrapper);
                        borderWrapper = bWrap;
                    }
                }

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
                textSpan.style.padding = '2px 4px';
                textSpan.style.boxSizing = 'border-box';
                textSpan.style.zIndex = '2';

                const mainBorderColor = (borders && borders.length > 0) ? borders[0].color : '#000000';

                if (textBox) {
                    textSpan.style.backgroundColor = '#ffffff';
                    textSpan.style.border = `1px solid ${mainBorderColor}`;
                    textSpan.style.borderRadius = '3px';
                } else if (textPlacement === 'inside') {
                    textSpan.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
                }

                if (textPlacement === 'inside') {
                    textSpan.style.position = 'absolute';
                    textSpan.style.left = '0';
                    textSpan.style.right = '0';
                    textSpan.style.width = '100%';

                    if (textPosition === 'top') {
                        textSpan.style.top = '0';
                    } else {
                        textSpan.style.bottom = '0';
                    }

                    if (showText) innerBox.appendChild(textSpan);
                    itemContainer.appendChild(borderWrapper);
                } else {
                    if (showText) {
                        if (textPosition === 'top') {
                            itemContainer.appendChild(textSpan);
                            itemContainer.appendChild(borderWrapper);
                        } else {
                            itemContainer.appendChild(borderWrapper);
                            itemContainer.appendChild(textSpan);
                        }
                    } else {
                        itemContainer.appendChild(borderWrapper);
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
                showBorders,
                borders = [],
                showText,
                textBox,
                textPosition,
                textPlacement,
                textSize,
                mode,
                chainDirection
            } = settings;

            const {
                itemsToRender,
                pagePadding,
                cols,
                rows,
                itemsPerPage,
                itemTotalW,
                itemTotalH,
                textHeight,
                effectiveBorderWidth
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
                if (mode === 'chain' && chainDirection === 'vertical') {
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

                const totalBoxW = imageSize + 2 * effectiveBorderWidth;
                const totalBoxH = imageSize + 2 * effectiveBorderWidth;

                if (showBorders && effectiveBorderWidth > 0 && borders && borders.length > 0) {
                    let currentOffset = 0;
                    // Draw outer to inner concentric filled rectangles (Border 3 down to Border 1)
                    for (let bIndex = borders.length - 1; bIndex >= 0; bIndex--) {
                        const b = borders[bIndex];
                        doc.setFillColor(b.color);
                        doc.rect(
                            imgBoxX + currentOffset,
                            imgBoxY + currentOffset,
                            totalBoxW - 2 * currentOffset,
                            totalBoxH - 2 * currentOffset,
                            'F'
                        );
                        currentOffset += b.width;
                    }

                    // Background behind image inside innermost border
                    doc.setFillColor('#ffffff');
                    doc.rect(imgBoxX + effectiveBorderWidth, imgBoxY + effectiveBorderWidth, imageSize, imageSize, 'F');
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

                    const ix = imgBoxX + effectiveBorderWidth + (innerSize - w) / 2;
                    const iy = imgBoxY + effectiveBorderWidth + (innerSize - h) / 2;

                    doc.addImage(imgElement, 'PNG', ix, iy, w, h);
                }

                if (showText) {
                    const textStr = itemData.description || itemData.name || '';
                    doc.setFontSize(textSize);
                    doc.setTextColor('#000000');
                    const mainBorderColor = (borders && borders.length > 0) ? borders[0].color : '#000000';

                    if (textPlacement === 'inside') {
                        const rectHeight = textSize + 6;
                        const rectX = imgBoxX + effectiveBorderWidth;
                        const rectW = imageSize;
                        const rectY = (textPosition === 'top')
                            ? (imgBoxY + effectiveBorderWidth)
                            : (imgBoxY + effectiveBorderWidth + imageSize - rectHeight);

                        doc.setFillColor('#ffffff');
                        if (textBox) {
                            doc.setDrawColor(mainBorderColor);
                            doc.setLineWidth(0.5);
                            doc.rect(rectX, rectY, rectW, rectHeight, 'FD');
                        } else {
                            doc.rect(rectX, rectY, rectW, rectHeight, 'F');
                        }

                        const textX = rectX + rectW / 2;
                        const textY = rectY + textSize;
                        const splitTextInside = doc.splitTextToSize(textStr, rectW - 4);
                        doc.text(splitTextInside[0], textX, textY, { align: 'center' });
                    } else {
                        const textX = imgBoxX + totalBoxW / 2;
                        const rectHeight = textSize + 6;
                        let rectY;
                        if (textPosition === 'top') {
                            rectY = y;
                        } else {
                            rectY = imgBoxY + totalBoxW + 2;
                        }

                        if (textBox) {
                            doc.setFillColor('#ffffff');
                            doc.setDrawColor(mainBorderColor);
                            doc.setLineWidth(0.5);
                            doc.roundedRect(imgBoxX, rectY, totalBoxW, rectHeight, 2, 2, 'FD');
                        }

                        const textY = rectY + textSize;
                        const splitTextOutside = doc.splitTextToSize(textStr, totalBoxW - 4);
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
