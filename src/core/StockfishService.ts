export class StockfishService {
    private worker: Worker | null = null;
    private onEvaluation: (cp: number) => void;
    private onBestMove: (move: string) => void;

    constructor(
        onEvaluation: (cp: number) => void,
        onBestMove: (move: string) => void
    ) {
        this.onEvaluation = onEvaluation;
        this.onBestMove = onBestMove;
    }

    init(workerPath: string = '/stockfish.js'): void {
        this.worker = new Worker(workerPath);
        this.worker.onmessage = (event) => {
            const msg = event.data;

            if (msg.startsWith('info depth')) {
                const scoreMatch = msg.match(/cp (-?\d+)/);
                if (scoreMatch) {
                    this.onEvaluation(parseInt(scoreMatch[1]));
                }
            }
            if (msg.startsWith('bestmove')) {
                const parts = msg.split(' ');
                if (parts.length > 1) {
                    this.onBestMove(parts[1]);
                }
            }
        };
    }

    analyze(fen: string, depth: number = 12): void {
        if (!this.worker) return;
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${depth}`);
    }
}
