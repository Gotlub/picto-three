/**
 * ApiClient - Centralisation des requêtes HTTP fetch, de l'injection CSRF et de la gestion des erreurs.
 */

export class ApiClientError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'ApiClientError';
        this.status = status;
        this.data = data;
    }
}

export class ApiClient {
    /**
     * Récupère le jeton CSRF depuis le DOM (champ input caché ou balise meta).
     * @returns {string} Le token CSRF ou une chaîne vide.
     */
    static getCsrfToken() {
        if (typeof document === 'undefined') return '';
        const input = document.querySelector('input[name="csrf_token"]');
        if (input && input.value) return input.value;
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.content) return meta.content;
        return '';
    }

    /**
     * Effectue une requête HTTP générique avec gestion automatique du CSRF et du JSON.
     * @param {string} url - URL cible
     * @param {RequestInit} options - Options fetch
     * @returns {Promise<any>} Données parsées de la réponse
     */
    static async request(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const headers = { ...(options.headers || {}) };

        // Détection de la présence d'un body sous forme d'objet brut à sérialiser
        let body = options.body;
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

        if (body && typeof body === 'object' && !isFormData) {
            if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
            body = JSON.stringify(body);
        }

        // Ajout automatique du jeton CSRF pour les requêtes mutantes
        const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (mutatingMethods.includes(method) && !headers['X-CSRFToken']) {
            const csrf = this.getCsrfToken();
            if (csrf) {
                headers['X-CSRFToken'] = csrf;
            }
        }

        const fetchOptions = {
            ...options,
            method,
            headers,
            body
        };

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            let errorData = null;
            try {
                errorData = await response.json();
            } catch {
                // La réponse n'est pas du JSON
            }
            const message = (errorData && (errorData.message || errorData.error)) ||
                `HTTP Error ${response.status}: ${response.statusText}`;
            throw new ApiClientError(message, response.status, errorData);
        }

        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers ? response.headers.get('content-type') : '';
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        // Pour les endpoints renvoyant du texte ou si contentType n'est pas JSON
        try {
            return await response.json();
        } catch {
            return await response.text();
        }
    }

    /**
     * Requête GET
     */
    static async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    /**
     * Requête POST
     */
    static async post(url, data = null, options = {}) {
        return this.request(url, { ...options, method: 'POST', body: data });
    }

    /**
     * Requête PUT
     */
    static async put(url, data = null, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body: data });
    }

    /**
     * Requête DELETE
     */
    static async delete(url, data = null, options = {}) {
        const reqOptions = { ...options, method: 'DELETE' };
        if (data !== null) {
            reqOptions.body = data;
        }
        return this.request(url, reqOptions);
    }
}
