import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '../../app/static/js/services/NotificationService.js';

describe('NotificationService', () => {
    it('should delegate alert to window.alert', () => {
        let alertedMsg = null;
        globalThis.window = {
            alert: (msg) => { alertedMsg = msg; }
        };

        NotificationService.alert('Test alert message');
        assert.equal(alertedMsg, 'Test alert message');

        NotificationService.error('Test error message');
        assert.equal(alertedMsg, 'Test error message');

        NotificationService.success('Test success message');
        assert.equal(alertedMsg, 'Test success message');
    });

    it('should delegate confirm to window.confirm', () => {
        globalThis.window = {
            confirm: (msg) => msg === 'Are you sure?'
        };

        assert.equal(NotificationService.confirm('Are you sure?'), true);
        assert.equal(NotificationService.confirm('Other?'), false);
    });
});
