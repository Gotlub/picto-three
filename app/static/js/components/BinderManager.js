/**
 * BinderManager - Gestionnaire du classeur multi-arbres (Profils / Onglet "Profile Builder").
 * Gère la composition de classeurs, la réorganisation par glisser-déposer,
 * le choix de couleur des onglets, l'avatar et la persistance API.
 */

import { ApiClient } from '../services/ApiClient.js';
import { NotificationService } from '../services/NotificationService.js';
import ImageTree from './ImageTree.js';
import ArasaacSearch from './ArasaacSearch.js';

export const BINDER_COLORS = [
    { hex: '#000000', label: 'Black' },
    { hex: '#FFEB3B', label: 'Yellow' },
    { hex: '#4CAF50', label: 'Green' },
    { hex: '#FF9800', label: 'Orange' },
    { hex: '#2196F3', label: 'Blue' },
    { hex: '#E91E63', label: 'Pink' }
];

export const DEFAULT_AVATAR_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 24 24' fill='none' stroke='%236c757d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path><circle cx='12' cy='7' r='4'></circle></svg>";

/**
 * Résout de façon sécurisée l'URL de la miniature d'un arbre.
 * @param {Object} treeData
 * @returns {string} URL sécurisée de la miniature
 */
export function resolveThumbnailUrl(treeData) {
    if (!treeData) return '/static/images/folder-bold.png';

    let thumbUrl = '/static/images/folder-bold.png';
    const rootId = Number(treeData.root_id);

    if (treeData.root_url && typeof treeData.root_url === 'string') {
        const url = treeData.root_url.trim();
        if (url.toLowerCase().startsWith('javascript:')) {
            return '/static/images/folder-bold.png';
        }
        if (url.startsWith('http://') || url.startsWith('https://')) {
            thumbUrl = url.replace(/_500\.png$/, '_300.png');
        } else if (!isNaN(rootId) && rootId > 0) {
            thumbUrl = `/pictogramsmin/${rootId}`;
        } else if (url.startsWith('/pictograms/')) {
            thumbUrl = url.replace('/pictograms/', '/pictogramsmin/');
        } else if (url.startsWith('/')) {
            thumbUrl = url;
        } else {
            thumbUrl = `/pictogramsmin/${url}`;
        }
    } else if (!isNaN(rootId) && rootId > 0) {
        thumbUrl = `/pictogramsmin/${rootId}`;
    }

    return thumbUrl;
}

export class BinderManager {
    constructor(options = {}) {
        this.userTrees = [];
        this.currentUserId = null;
        this.savedProfiles = [];
        this.getUserTrees = options.getUserTrees || (() => this.userTrees);
        this.getCurrentUserId = options.getCurrentUserId || (() => this.currentUserId);

        this.profileArea = typeof document !== 'undefined' ? document.getElementById('profile-builder-area') : null;
        this.profileTreesList = typeof document !== 'undefined' ? document.getElementById('profile-trees-list') : null;
        this.emptyMsg = typeof document !== 'undefined' ? document.getElementById('profile-builder-empty-msg') : null;
        this.profileTreeList = typeof document !== 'undefined' ? document.getElementById('profile-builder-tree-list') : null;

        this.modalImageTree = null;
        this.modalArasaacSearch = null;

        this.init();
    }

    init() {
        if (typeof document === 'undefined') return;
        this.initProfileEvents();
        this.initProfileDragDrop();
    }

    setUserTrees(trees, currentUserId) {
        this.userTrees = Array.isArray(trees) ? trees : [];
        if (currentUserId !== undefined) {
            this.currentUserId = currentUserId;
        }
        this.renderProfileBuilderTreeList();
    }

    initProfileEvents() {
        const saveProfileBtn = document.getElementById('save-profile-btn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', () => this.saveProfile());
        }

        const loadProfileBtn = document.getElementById('load-profile-btn');
        if (loadProfileBtn) {
            loadProfileBtn.addEventListener('click', () => this.loadSelectedProfile());
        }

        const deleteProfileBtn = document.getElementById('delete-profile-btn');
        if (deleteProfileBtn) {
            deleteProfileBtn.addEventListener('click', () => this.deleteProfile());
        }

        const profileSearch = document.getElementById('profile-search');
        if (profileSearch) {
            profileSearch.addEventListener('input', () => this.filterProfiles());
        }

        const newProfileBtn = document.getElementById('new-profile-btn');
        if (newProfileBtn) {
            newProfileBtn.addEventListener('click', () => this.createNewProfile());
        }

        const avatarContainer = document.getElementById('profile-avatar-container');
        if (avatarContainer) {
            avatarContainer.addEventListener('click', () => this.openAvatarModal());
        }
    }

    openAvatarModal() {
        const modalEl = document.getElementById('avatar-modal');
        if (!modalEl || typeof bootstrap === 'undefined') return;
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

        if (!this.modalImageTree) {
            this.modalImageTree = new ImageTree('modal-image-sidebar-tree');
            this.modalImageTree.onImageClick = (data) => {
                const imageId = Number(data.id);
                const avatarUrl = (data.path && (data.path.startsWith('http://') || data.path.startsWith('https://')))
                    ? data.path
                    : ((!isNaN(imageId) && imageId >= 0) ? `/pictogramsmin/${imageId}` : `/pictogramsmin/${data.path}`);
                this.setProfileAvatar(avatarUrl);
                modal.hide();
            };

            this.modalArasaacSearch = new ArasaacSearch('modal-arasaac-search-container', null, (imgUrl) => {
                this.setProfileAvatar(imgUrl);
                modal.hide();
            });
        }

        modal.show();
    }

    setProfileAvatar(url) {
        const urlInput = document.getElementById('profile-image-url');
        const previewImg = document.getElementById('profile-image-preview');
        if (urlInput) urlInput.value = url;
        if (previewImg) previewImg.src = url;
    }

    initProfileDragDrop() {
        if (!this.profileArea || !this.profileTreesList) return;

        this.profileArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.profileArea.classList.add('border-primary');

            const y = e.clientY;
            const target = e.target.closest('.profile-dropped-tree-item');
            if (target && !target.classList.contains('dragging')) {
                const box = target.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;

                this.profileTreesList.querySelectorAll('.drop-above, .drop-below').forEach(el => {
                    el.classList.remove('drop-above', 'drop-below');
                });

                if (offset < 0) {
                    target.classList.add('drop-above');
                } else {
                    target.classList.add('drop-below');
                }
            }
        });

        this.profileArea.addEventListener('dragleave', () => {
            this.profileArea.classList.remove('border-primary');
        });

        this.profileArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.profileArea.classList.remove('border-primary');
            this.profileTreesList.querySelectorAll('.drop-above, .drop-below').forEach(el => {
                el.classList.remove('drop-above', 'drop-below');
            });

            let dragData = null;
            try {
                const dataString = e.dataTransfer.getData('application/json');
                if (dataString) {
                    dragData = JSON.parse(dataString);
                }
            } catch (err) {
                console.error('Failed to parse drag data', err);
            }

            if (dragData && dragData.type === 'profile-tree-item') {
                const y = e.clientY;
                const afterElement = this.getDragAfterElement(this.profileTreesList, y);
                const trees = this.getUserTrees();
                const treeData = trees.find(t => t.id === dragData.treeId);

                if (treeData) {
                    const existingNode = this.profileTreesList.querySelector(`[data-tree-id="${treeData.id}"]`);
                    if (existingNode && dragData.isReorder) {
                        if (afterElement == null) {
                            this.profileTreesList.appendChild(existingNode);
                        } else {
                            this.profileTreesList.insertBefore(existingNode, afterElement);
                        }
                    } else if (!existingNode) {
                        const newElement = this.createProfileTreeElement(treeData);
                        if (afterElement == null) {
                            this.profileTreesList.appendChild(newElement);
                        } else {
                            this.profileTreesList.insertBefore(newElement, afterElement);
                        }
                        if (this.emptyMsg) this.emptyMsg.style.display = 'none';
                    }
                    this.updateProfileTreeNumbers();
                }
            }
        });
    }

    updateProfileTreeNumbers() {
        const profileTreesList = document.getElementById('profile-trees-list');
        if (!profileTreesList) return;
        const items = profileTreesList.querySelectorAll('.profile-dropped-tree-item');
        items.forEach((item, index) => {
            const numberSpan = item.querySelector('.tree-number');
            if (numberSpan) {
                numberSpan.textContent = `${index + 1}.`;
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.profile-dropped-tree-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    createProfileTreeElement(treeData) {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center profile-dropped-tree-item mb-2 shadow-sm rounded';
        li.setAttribute('draggable', 'true');
        li.dataset.treeId = treeData.id;

        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'profile-tree-item',
                treeId: treeData.id,
                isReorder: true
            }));
            li.classList.add('dragging');
            li.style.opacity = '0.5';
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            li.style.opacity = '1';
            const profileTreesList = document.getElementById('profile-trees-list');
            if (profileTreesList) {
                profileTreesList.querySelectorAll('.drop-above, .drop-below').forEach(el => {
                    el.classList.remove('drop-above', 'drop-below');
                });
            }
        });

        // Section gauche : poignée Unicode, numéro, image, nom
        const leftSection = document.createElement('div');
        leftSection.className = 'd-flex align-items-center flex-grow-1';

        const dragHandle = document.createElement('span');
        dragHandle.textContent = '\u22EE\u22EE'; // Poignée verticale Unicode sécurisée (évite innerHTML)
        dragHandle.style.cursor = 'grab';
        dragHandle.className = 'text-muted me-2 fs-5';
        leftSection.appendChild(dragHandle);

        const numberSpan = document.createElement('span');
        numberSpan.className = 'tree-number fw-bold text-muted me-3 fs-5';
        numberSpan.textContent = '1.';
        leftSection.appendChild(numberSpan);

        const imgContainer = document.createElement('div');
        imgContainer.style.width = '40px';
        imgContainer.style.height = '40px';
        imgContainer.className = 'me-3';

        const img = document.createElement('img');
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.src = resolveThumbnailUrl(treeData);
        img.onerror = function() {
            this.src = '/static/images/folder-bold.png';
        };
        imgContainer.appendChild(img);
        leftSection.appendChild(imgContainer);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'fw-bold';
        nameSpan.textContent = treeData.name || '';
        leftSection.appendChild(nameSpan);

        li.appendChild(leftSection);

        // Section droite : Sélecteur de couleur et suppression
        const rightSection = document.createElement('div');
        rightSection.className = 'd-flex align-items-center';

        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'dropdown me-3 profile-tree-color-dropdown';

        const dropdownBtn = document.createElement('button');
        dropdownBtn.className = 'btn btn-sm btn-outline-secondary dropdown-toggle d-flex align-items-center';
        dropdownBtn.type = 'button';
        dropdownBtn.dataset.bsToggle = 'dropdown';

        const selectedColorSpan = document.createElement('span');
        selectedColorSpan.className = 'rounded-circle me-2 color-indicator border';
        selectedColorSpan.style.width = '14px';
        selectedColorSpan.style.height = '14px';

        const selectedText = document.createElement('span');
        dropdownBtn.appendChild(selectedColorSpan);
        dropdownBtn.appendChild(selectedText);
        dropdownDiv.appendChild(dropdownBtn);

        const dropdownMenu = document.createElement('ul');
        dropdownMenu.className = 'dropdown-menu';
        dropdownMenu.style.minWidth = 'unset';

        const currentColor = treeData.colorCode || '#000000';
        dropdownDiv.dataset.selectedColor = currentColor;

        const updateBtnVisuals = (colorHex) => {
            const cInfo = BINDER_COLORS.find(c => c.hex === colorHex) || BINDER_COLORS[0];
            selectedColorSpan.style.backgroundColor = cInfo.hex;
            selectedText.textContent = cInfo.label;
            dropdownDiv.dataset.selectedColor = cInfo.hex;
        };
        updateBtnVisuals(currentColor);

        BINDER_COLORS.forEach(color => {
            const optionLi = document.createElement('li');
            const a = document.createElement('a');
            a.className = 'dropdown-item d-flex align-items-center';
            a.href = '#';

            const swatch = document.createElement('span');
            swatch.className = 'rounded-circle me-2 border';
            swatch.style.width = '14px';
            swatch.style.height = '14px';
            swatch.style.backgroundColor = color.hex;

            a.appendChild(swatch);
            a.appendChild(document.createTextNode(color.label));

            a.addEventListener('click', (e) => {
                e.preventDefault();
                updateBtnVisuals(color.hex);
            });

            optionLi.appendChild(a);
            dropdownMenu.appendChild(optionLi);
        });

        dropdownDiv.appendChild(dropdownMenu);
        rightSection.appendChild(dropdownDiv);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger border-0';
        deleteBtn.textContent = '\u2715'; // Croix de suppression Unicode (évite innerHTML)
        deleteBtn.addEventListener('click', () => {
            li.remove();
            this.updateProfileTreeNumbers();
            const profileTreesList = document.getElementById('profile-trees-list');
            const emptyMsg = document.getElementById('profile-builder-empty-msg');
            if (profileTreesList && profileTreesList.children.length === 0 && emptyMsg) {
                emptyMsg.style.display = 'block';
            }
        });

        rightSection.appendChild(deleteBtn);
        li.appendChild(rightSection);

        return li;
    }

    renderProfileBuilderTreeList() {
        if (typeof document === 'undefined') return;
        const profileTreeList = document.getElementById('profile-builder-tree-list');
        if (!profileTreeList) return;

        profileTreeList.innerHTML = '';
        const trees = this.getUserTrees();

        if (!trees || trees.length === 0) {
            const emptyMsg = document.createElement('li');
            emptyMsg.className = 'list-group-item text-muted text-center';
            emptyMsg.textContent = 'No trees available.';
            profileTreeList.appendChild(emptyMsg);
            return;
        }

        trees.forEach(tree => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action d-flex align-items-center profile-tree-item';
            li.setAttribute('draggable', 'true');
            li.dataset.treeId = tree.id;
            li.dataset.treeName = tree.name;

            const dragHandle = document.createElement('span');
            dragHandle.textContent = '\u22EE\u22EE';
            dragHandle.style.cursor = 'grab';
            dragHandle.className = 'text-muted me-2 flex-shrink-0';

            const imgContainer = document.createElement('div');
            imgContainer.style.width = '40px';
            imgContainer.style.height = '40px';
            imgContainer.style.flexShrink = '0';
            imgContainer.style.display = 'flex';
            imgContainer.style.justifyContent = 'center';
            imgContainer.style.alignItems = 'center';
            imgContainer.className = 'me-2';

            const img = document.createElement('img');
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.src = resolveThumbnailUrl(tree);
            img.alt = tree.name || '';
            img.onerror = function() {
                this.src = '/static/images/folder-bold.png';
            };
            imgContainer.appendChild(img);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'flex-grow-1 tree-name text-truncate';
            nameSpan.textContent = tree.name || '';

            li.appendChild(dragHandle);
            li.appendChild(imgContainer);
            li.appendChild(nameSpan);

            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'profile-tree-item',
                    treeId: tree.id,
                    treeName: tree.name
                }));
                li.style.opacity = '0.5';
            });

            li.addEventListener('dragend', () => {
                li.style.opacity = '1';
            });

            profileTreeList.appendChild(li);
        });

        // Filtrage de recherche des arbres du profil
        const searchInput = document.getElementById('profile-builder-tree-search');
        if (searchInput) {
            const newSearchInput = searchInput.cloneNode(true);
            if (searchInput.parentNode) {
                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            }

            newSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const items = profileTreeList.querySelectorAll('.profile-tree-item');

                items.forEach(item => {
                    const treeName = (item.dataset.treeName || '').toLowerCase();
                    if (treeName.includes(searchTerm)) {
                        item.style.setProperty('display', 'flex', 'important');
                    } else {
                        item.style.setProperty('display', 'none', 'important');
                    }
                });
            });
        }
    }

    async loadSavedProfiles() {
        try {
            const data = await ApiClient.get('/api/profiles/load');
            this.savedProfiles = Array.isArray(data.profiles) ? data.profiles : [];
            this.renderProfileList();
        } catch (error) {
            console.error('Error loading profiles:', error);
            NotificationService.alert('Failed to load profiles');
        }
    }

    renderProfileList() {
        if (typeof document === 'undefined') return;
        const profileList = document.getElementById('profile-list');
        if (!profileList) return;
        profileList.innerHTML = '';

        if (!this.savedProfiles || this.savedProfiles.length === 0) {
            const emptyNotice = document.createElement('div');
            emptyNotice.className = 'text-muted small';
            emptyNotice.textContent = 'No profiles saved yet.';
            profileList.appendChild(emptyNotice);
            return;
        }

        const select = document.createElement('select');
        select.id = 'profile-select';
        select.className = 'form-select form-select-sm mb-2 profile-select-list';

        this.savedProfiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            select.appendChild(option);
        });

        profileList.appendChild(select);
    }

    filterProfiles() {
        const profileSearch = document.getElementById('profile-search');
        if (!profileSearch) return;
        const query = profileSearch.value.toLowerCase();

        const select = document.getElementById('profile-select');
        if (!select) return;

        Array.from(select.options).forEach(option => {
            const name = option.textContent.toLowerCase();
            option.style.display = name.includes(query) ? '' : 'none';
        });

        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.style.display === 'none') {
            const firstVisible = Array.from(select.options).find(opt => opt.style.display !== 'none');
            if (firstVisible) {
                select.value = firstVisible.value;
            }
        }
    }

    async saveProfile() {
        const userId = this.getCurrentUserId();
        if (!userId) {
            NotificationService.alert(window.translations?.accountRequired || 'Account required');
            return;
        }

        const profileNameInput = document.getElementById('profile-name');
        if (!profileNameInput) return;

        const profileName = profileNameInput.value.trim();
        if (!profileName) {
            NotificationService.alert('Please enter a profile name.');
            return;
        }

        const profileTreesList = document.getElementById('profile-trees-list');
        const items = profileTreesList ? profileTreesList.querySelectorAll('.profile-dropped-tree-item') : [];
        if (items.length === 0) {
            NotificationService.alert('Please add at least one tree to the profile.');
            return;
        }

        const trees = [];
        items.forEach((item, index) => {
            const dropdown = item.querySelector('.profile-tree-color-dropdown');
            const colorCode = dropdown ? dropdown.dataset.selectedColor : '#000000';
            trees.push({
                treeId: parseInt(item.dataset.treeId, 10),
                colorCode: colorCode,
                display_order: index + 1
            });
        });

        const payload = {
            name: profileName,
            remote_avatar_url: document.getElementById('profile-image-url')?.value || '',
            trees: trees
        };

        const saveBtn = document.getElementById('save-profile-btn');
        const originalText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        try {
            const data = await ApiClient.post('/api/profile/save', payload);
            NotificationService.alert(data.message || 'Profile saved successfully');
            await this.loadSavedProfiles();
        } catch (error) {
            console.error('Error:', error);
            NotificationService.alert(error.message || 'Failed to save profile');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
        }
    }

    loadSelectedProfile() {
        const select = document.getElementById('profile-select');
        if (!select || !select.value) {
            NotificationService.alert('Please select a profile to load.');
            return;
        }

        const profileId = parseInt(select.value, 10);
        const profile = this.savedProfiles.find(p => p.id === profileId);

        if (profile) {
            this.loadProfileIntoBuilder(profile);
        }
    }

    loadProfileIntoBuilder(profile) {
        const profileNameInput = document.getElementById('profile-name');
        if (profileNameInput) profileNameInput.value = profile.name || '';

        if (profile.remote_avatar_url) {
            this.setProfileAvatar(profile.remote_avatar_url);
        } else {
            this.setProfileAvatar(DEFAULT_AVATAR_SVG);
            const urlInput = document.getElementById('profile-image-url');
            if (urlInput) urlInput.value = '';
        }

        const profileTreesList = document.getElementById('profile-trees-list');
        const emptyMsg = document.getElementById('profile-builder-empty-msg');

        if (profileTreesList) profileTreesList.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'none';

        if (profile.trees && profile.trees.length > 0) {
            profile.trees.forEach(treeData => {
                const element = this.createProfileTreeElement(treeData);
                if (profileTreesList) {
                    profileTreesList.appendChild(element);
                }
            });
            this.updateProfileTreeNumbers();
        } else {
            if (emptyMsg) emptyMsg.style.display = 'block';
        }
    }

    async deleteProfile() {
        const userId = this.getCurrentUserId();
        if (!userId) {
            NotificationService.alert(window.translations?.accountRequired || 'Account required');
            return;
        }

        const profileSelect = document.getElementById('profile-select');
        const profileId = profileSelect ? profileSelect.value : null;

        if (!profileId) {
            NotificationService.alert('Please select a profile to delete.');
            return;
        }

        if (!NotificationService.confirm('Are you sure you want to delete this profile?')) {
            return;
        }

        const deleteBtn = document.getElementById('delete-profile-btn');
        const originalText = deleteBtn ? deleteBtn.textContent : '';
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';
        }

        try {
            const data = await ApiClient.delete(`/api/profile/${profileId}`);
            NotificationService.alert(data.message || 'Profile deleted successfully');
            await this.loadSavedProfiles();
        } catch (error) {
            console.error('Error:', error);
            NotificationService.alert(error.message || 'Failed to delete profile');
        } finally {
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.textContent = originalText;
            }
        }
    }

    createNewProfile() {
        const userId = this.getCurrentUserId();
        if (!userId) {
            NotificationService.alert(window.translations?.accountRequired || 'Account required');
            return;
        }

        if (!NotificationService.confirm('Are you sure you want to start a new profile? This will clear the current list.')) {
            return;
        }

        const profileNameInput = document.getElementById('profile-name');
        if (profileNameInput) {
            profileNameInput.value = '';
        }

        this.setProfileAvatar(DEFAULT_AVATAR_SVG);
        const urlInput = document.getElementById('profile-image-url');
        if (urlInput) {
            urlInput.value = '';
        }

        const profileTreesList = document.getElementById('profile-trees-list');
        if (profileTreesList) {
            profileTreesList.innerHTML = '';
        }

        const emptyMsg = document.getElementById('profile-builder-empty-msg');
        if (emptyMsg) {
            emptyMsg.style.display = 'block';
        }

        const profileSelect = document.getElementById('profile-select');
        if (profileSelect) {
            profileSelect.value = '';
        }
    }
}
