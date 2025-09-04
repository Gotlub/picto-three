// Fichier : app/static/js/common-filter.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration des sélecteurs CSS ---
    const SEARCH_INPUT_ID = 'filterInput';
    const FOLDER_CONTAINER_SELECTOR = '#image-sidebar-tree';
    const MAIN_IMAGE_CONTAINER_SELECTOR = '.image-container';

    // --- État de l'application ---
    let allPictos = []; // Stockera la liste complète des pictogrammes de l'API

    // --- Références aux éléments du DOM ---
    const searchInput = document.getElementById(SEARCH_INPUT_ID);
    const folderContainer = document.querySelector(FOLDER_CONTAINER_SELECTOR);
    const mainImageContainer = document.querySelector(MAIN_IMAGE_CONTAINER_SELECTOR);

    if (!searchInput || !folderContainer || !mainImageContainer) {
        console.error('Initialisation du filtre impossible : un ou plusieurs éléments DOM sont manquants.');
        return;
    }

    // Création d'un conteneur qui affichera les résultats de recherche.
    const searchResultsContainer = document.createElement('div');
    searchResultsContainer.id = 'search-results';
    searchResultsContainer.className = 'image-list-container';
    searchResultsContainer.style.display = 'none'; // Caché par défaut
    mainImageContainer.appendChild(searchResultsContainer);

    // --- Fonctions ---

    /**
     * Interroge notre API Flask pour obtenir la liste de tous les pictos.
     */
    const fetchAllPictos = async () => {
        try {
            const response = await fetch('/api/pictograms_all');
            if (!response.ok) throw new Error(`Erreur HTTP : ${response.status}`);
            allPictos = await response.json();
        } catch (error) {
            console.error("Échec de la récupération des pictogrammes :", error);
            // On pourrait afficher un message à l'utilisateur ici.
        }
    };

    /**
     * Filtre la liste `allPictos` et met à jour l'affichage.
     */
    const handleFilter = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();

        if (searchTerm.length === 0) {
            // Si la recherche est vide, on revient à la vue par dossiers
            searchResultsContainer.style.display = 'none';
            folderContainer.style.display = '';
            searchResultsContainer.innerHTML = '';
            return;
        }

        // Affiche le conteneur de résultats et cache les dossiers
        folderContainer.style.display = 'none';
        searchResultsContainer.style.display = 'flex';
        searchResultsContainer.innerHTML = ''; // Nettoie les anciens résultats

        const filteredPictos = allPictos.filter(picto =>
            picto.name.toLowerCase().includes(searchTerm)
        );

        if (filteredPictos.length > 0) {
            filteredPictos.forEach(picto => {
                const pictoElement = createPictoElement(picto);
                searchResultsContainer.appendChild(pictoElement);
            });
        } else {
            searchResultsContainer.innerHTML = '<p class="w-full text-center text-gray-500 p-4">Aucun résultat.</p>';
        }
    };

    /**
     * Crée et retourne un élément HTML pour un pictogramme donné.
     */
    function createPictoElement(picto) {
        const div = document.createElement('div');
        div.className = 'img-list';
        div.setAttribute('data-name', picto.name);
        div.setAttribute('draggable', 'true');

        const img = document.createElement('img');
        img.src = `/${picto.path}`;
        img.alt = picto.name;
        img.loading = 'lazy'; // Optimisation : les images ne se chargent que si elles sont visibles.

        const p = document.createElement('p');
        p.textContent = picto.name;

        div.appendChild(img);
        div.appendChild(p);

        // Important pour la page /builder : on s'assure que les éléments créés sont déplaçables.
        if (typeof attachDragEvents === 'function') {
            attachDragEvents(div);
        }

        return div;
    }

    // --- Initialisation ---
    fetchAllPictos(); // Lance la récupération des données dès que la page est prête.
    searchInput.addEventListener('input', handleFilter);
});
