import { BOARD_COLORS, PIECE_ASSETS, UI_ICONS } from '../core/Constants';
import { ToastManager } from './ToastManager';

export class UIManager {
    private canvas: HTMLCanvasElement;
    private toastManager: ToastManager;
    private boardEl: HTMLElement | null = null;

    constructor() {
        this.canvas = document.getElementById('overlayCanvas') as HTMLCanvasElement;
        this.toastManager = new ToastManager();
        this.initHelpModal();
    }

    private initHelpModal(): void {
        const btnHelp = document.getElementById('btn-help');
        const btnClose = document.getElementById('btn-close-help');
        const modal = document.getElementById('helpModal');

        if (btnHelp && modal) {
            btnHelp.addEventListener('click', () => {
                modal.classList.remove('hidden');
            });
        }

        if (btnClose && modal) {
            btnClose.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        // Close when clicking outside
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    }

    updateStatus(msg: string, type: 'ready' | 'waiting' | 'error' = 'ready'): void {
        const el = document.getElementById('statusLabel');
        if (el) {
            const iconName = UI_ICONS[type] || 'info';
            el.innerHTML = `<span class="material-symbols-rounded">${iconName}</span> ${msg}`;
            el.className = `status-box status-${type}`;
        }
    }

    showToast(msg: string, type: 'info' | 'success' | 'error' = 'info'): void {
        this.toastManager.show(msg, type);
    }

    logMove(move: string): void {
        const el = document.getElementById('moveLog');
        if (el) {
            if (el.innerText === 'Odotetaan peliä...') el.innerText = '';
            el.innerText += move + ' ';
            el.scrollTop = el.scrollHeight;
        }
    }

    clearLog(): void {
        const el = document.getElementById('moveLog');
        if (el) el.innerText = "Odotetaan peliä...";
    }

    updateEvalBar(cp: number): void {
        const bar = document.getElementById('eval-fill');
        const text = document.getElementById('evaluation');

        // CP is from white's perspective. 
        // Max range usually +/- 500 or 1000.
        // Normalize to 0-100%
        // cp=0 -> 50%
        // cp=500 -> 100%
        // cp=-500 -> 0%

        const percent = 50 + (cp / 10); // Simple scaling
        const clamped = Math.max(0, Math.min(100, percent));

        if (bar) bar.style.width = `${clamped}%`;
        if (text) text.innerText = `Arvio: ${(cp / 100).toFixed(2)}`;
    }

    updateTurn(turn: 'w' | 'b'): void {
        const badge = document.getElementById('turn-indicator');
        const icon = document.getElementById('turn-icon');
        const text = document.getElementById('turn-text');

        if (badge && icon && text) {
            if (turn === 'w') {
                text.innerText = "Vuoro: Valkoinen";
                icon.innerText = "circle"; // Open circle or specific white piece icon
                badge.style.background = "#ffffff";
                badge.style.color = "#000000";
                badge.style.border = "1px solid #ccc";
            } else {
                text.innerText = "Vuoro: Musta";
                icon.innerText = "circle";

                badge.style.background = "#1f2937";
                badge.style.color = "#ffffff";
                badge.style.border = "1px solid #000";
            }
        }
    }

    updateBestMove(move: string): void {
        const text = document.getElementById('evaluation');
        if (text) text.innerText = ` | Paras siirto: ${move}`;

        this.clearHighlights();

        if (move && move !== "...") {
            // move is like "e2e4" or "a7a8q"
            const from = move.substring(0, 2);
            const to = move.substring(2, 4);
            this.highlightSquare(from);
            this.highlightSquare(to);
        }
    }

    private clearHighlights(): void {
        const squares = document.querySelectorAll('.highlight-move');
        squares.forEach(el => el.classList.remove('highlight-move'));
    }

    private highlightSquare(sqName: string): void {
        // e.g. "e2" -> col 4, row 6 (rank 2 is row 6)
        if (sqName.length < 2) return;

        const file = sqName.charCodeAt(0) - 97; // 'a' -> 0
        const rank = parseInt(sqName[1]); // '1' -> 1
        const row = 8 - rank; // 8 -> 0
        const col = file;

        const el = document.getElementById(`sq-${row}-${col}`);
        if (el) el.classList.add('highlight-move');
    }

    bindButtons(
        onCapture: () => void,
        onLock: () => void,
        onReset: () => void
    ): void {
        document.getElementById('btn-capture')?.addEventListener('click', onCapture);
        document.getElementById('btn-lock')?.addEventListener('click', onLock);
        document.getElementById('btn-reset')?.addEventListener('click', onReset);
    }

    bindSensitivity(onChange: (val: number) => void): void {
        const slider = document.getElementById('sensitivitySlider') as HTMLInputElement;
        const label = document.getElementById('sensValue');
        if (slider && label) {
            slider.addEventListener('input', () => {
                const val = parseInt(slider.value);
                label.innerText = val.toString();
                onChange(val);
            });
        }
    }

    setSliderValue(val: number): void {
        const slider = document.getElementById('sensitivitySlider') as HTMLInputElement;
        const label = document.getElementById('sensValue');
        if (slider && label) {
            slider.value = val.toString();
            label.innerText = val.toString();
        }
    }

    bindCanvasClick(callback: (x: number, y: number) => void): void {
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            callback(x, y);
        });
    }

    bindBoardInteraction(onManualMove: (from: string, to: string) => void): void {
        // We will attach listeners to the board container to handle drops
        if (!this.boardEl) return;

        let draggedFrom: string | null = null;

        this.boardEl.addEventListener('dragstart', (e: DragEvent) => {
            const target = e.target as HTMLElement;
            // Target is the image. Parent is the square div with id="sq-r-c"
            const parent = target.parentElement;
            if (parent && parent.id.startsWith('sq-')) {
                const parts = parent.id.split('-');
                const r = parseInt(parts[1]);
                const c = parseInt(parts[2]);
                // Convert to algebraic (e.g., e2)
                const file = String.fromCharCode(97 + c);
                const rank = 8 - r;
                draggedFrom = `${file}${rank}`;
                // Optional: set drag image ghost
            }
        });

        this.boardEl.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault(); // Allow drop
        });

        this.boardEl.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            if (!draggedFrom) return;

            // Find drop target (closest square)
            // The drop target might be the img inside the square, or the square itself
            let target = e.target as HTMLElement;
            let squareDiv = target.closest('div[id^="sq-"]');

            if (squareDiv) {
                const parts = squareDiv.id.split('-');
                const r = parseInt(parts[1]);
                const c = parseInt(parts[2]);
                const file = String.fromCharCode(97 + c);
                const rank = 8 - r;
                const droppedTo = `${file}${rank}`;

                if (draggedFrom !== droppedTo) {
                    // Call the callback
                    onManualMove(draggedFrom, droppedTo);
                }
            }
            draggedFrom = null; // Reset
        });
    }

    // --- Virtual Board Logic ---

    // private boardEl: HTMLElement | null = null; // REMOVED DUPLICATE
    // private pieceCache: Map<string, string> = new Map(); (Unused for now)

    initBoard(): void {
        this.boardEl = document.getElementById('board-container');
        if (!this.boardEl) return;

        this.boardEl.style.display = 'grid';
        this.boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
        this.boardEl.style.gridTemplateRows = 'repeat(8, 1fr)';
        this.boardEl.style.border = '2px solid #333';

        // Create 64 squares
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = document.createElement('div');
                sq.id = `sq-${r}-${c}`;
                sq.style.width = '100%';
                sq.style.height = '100%';
                sq.style.display = 'flex';
                sq.style.justifyContent = 'center';
                sq.style.alignItems = 'center';
                sq.style.position = 'relative';

                // Color
                if ((r + c) % 2 === 0) {
                    sq.style.backgroundColor = BOARD_COLORS.light;
                } else {
                    sq.style.backgroundColor = BOARD_COLORS.dark;
                }

                this.boardEl.appendChild(sq);
            }
        }
    }

    updateBoard(fen: string): void {
        if (!this.boardEl) return;

        // Parse FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        const rows = fen.split(' ')[0].split('/');

        for (let r = 0; r < 8; r++) {
            let c = 0;
            const rowStr = rows[r];
            for (let i = 0; i < rowStr.length; i++) {
                const char = rowStr[i];

                if (/\d/.test(char)) {
                    // Empty squares
                    const skip = parseInt(char);
                    for (let k = 0; k < skip; k++) {
                        this.setSquare(r, c + k, null);
                    }
                    c += skip;
                } else {
                    // Piece
                    this.setSquare(r, c, char);
                    c++;
                }
            }
        }
    }

    private setSquare(r: number, c: number, pieceCode: string | null): void {
        const sq = document.getElementById(`sq-${r}-${c}`);
        if (!sq) return;

        sq.innerHTML = ''; // Clear
        if (pieceCode) {
            const color = (pieceCode === pieceCode.toUpperCase()) ? 'w' : 'b';
            const type = pieceCode.toLowerCase(); // p, n, b, r, q, k

            const url = PIECE_ASSETS[`${color}-${type}`] || '';
            const img = document.createElement('img');
            img.src = url;
            img.style.width = '90%';
            img.style.height = '90%';
            img.style.cursor = 'grab';
            img.draggable = true; // Enable Drag
            sq.appendChild(img);
        }
    }

    // REMOVED getPieceUrl helper as it is no longer needed
}
