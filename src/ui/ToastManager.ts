import { UI_ICONS } from '../core/Constants';

export class ToastManager {
    private container: HTMLElement | null;

    constructor() {
        this.container = document.getElementById('toast-container');
    }

    show(msg: string, type: 'info' | 'success' | 'error' = 'info'): void {
        if (!this.container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Use generic icon map or specific toast map if needed.
        // Reusing UI_ICONS logic for simplicity or custom map here.
        const iconName = type === 'error' ? 'warning' : UI_ICONS[type] || 'info';

        toast.innerHTML = `<span class="material-symbols-rounded">${iconName}</span> ${msg}`;
        this.container.appendChild(toast);

        // Remove after 3s
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}
