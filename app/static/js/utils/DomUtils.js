/**
 * DomUtils - Fonctions utilitaires partagées pour la manipulation et sécurisation du DOM.
 */

export class DomUtils {
    /**
     * Échappe les caractères HTML dangereux pour éviter les injections XSS.
     * @param {string} text 
     * @returns {string}
     */
    static escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Crée un élément DOM avec classes, attributs et contenu.
     * @param {string} tag 
     * @param {object} options 
     * @returns {HTMLElement}
     */
    static createElement(tag, { classes = [], attributes = {}, text = '', html = '', children = [] } = {}) {
        if (typeof document === 'undefined') {
            throw new Error('createElement requires a DOM environment');
        }

        const el = document.createElement(tag);

        if (Array.isArray(classes)) {
            classes.filter(Boolean).forEach(cls => el.classList.add(cls));
        } else if (typeof classes === 'string' && classes.trim()) {
            el.className = classes.trim();
        }

        Object.entries(attributes).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                el.setAttribute(key, String(value));
            }
        });

        if (text) {
            el.textContent = text;
        } else if (html) {
            if (typeof DOMPurify !== 'undefined') {
                el.innerHTML = DOMPurify.sanitize(html);
            } else {
                el.innerHTML = html;
            }
        }

        if (Array.isArray(children)) {
            children.filter(Boolean).forEach(child => {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child instanceof Node) {
                    el.appendChild(child);
                }
            });
        }

        return el;
    }

    /**
     * Sélecteur d'un élément unique
     */
    static qs(selector, scope = (typeof document !== 'undefined' ? document : null)) {
        return scope ? scope.querySelector(selector) : null;
    }

    /**
     * Sélecteur de plusieurs éléments (renvoyés sous forme de tableau)
     */
    static qsa(selector, scope = (typeof document !== 'undefined' ? document : null)) {
        return scope ? Array.from(scope.querySelectorAll(selector)) : [];
    }
}
