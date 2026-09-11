/**
 * NotificationService - Service centralisé pour les notifications et dialogues utilisateur.
 * Maintient la compatibilité avec les dialogues natifs du navigateur (alert/confirm)
 * requis par les contrats de test E2E Playwright.
 */

export class NotificationService {
    /**
     * Affiche un message d'information ou d'alerte générale.
     * @param {string} message 
     */
    static alert(message) {
        if (typeof window !== 'undefined' && window.alert) {
            window.alert(message);
        } else {
            console.warn(`[ALERT]: ${message}`);
        }
    }

    /**
     * Demande une confirmation booléenne à l'utilisateur.
     * @param {string} message 
     * @returns {boolean}
     */
    static confirm(message) {
        if (typeof window !== 'undefined' && window.confirm) {
            return window.confirm(message);
        }
        return true;
    }

    /**
     * Affiche une notification d'erreur.
     * @param {string} message 
     */
    static error(message) {
        this.alert(message);
    }

    /**
     * Affiche une notification de succès.
     * @param {string} message 
     */
    static success(message) {
        this.alert(message);
    }
}
