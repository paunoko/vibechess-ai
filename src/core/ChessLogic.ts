import { Chess, Move } from 'chess.js';

export class ChessLogic {
    private game: Chess;

    constructor() {
        this.game = new Chess();
    }

    reset(): void {
        this.game.reset();
    }

    getTurn(): 'w' | 'b' {
        return this.game.turn();
    }

    // Returns FEN
    getFen(): string {
        return this.game.fen();
    }

    // Returns raw board state (8x8 array of Piece | null)
    getBoard(): ({ type: string, color: string } | null)[][] {
        return this.game.board();
    }

    // Convert 0-63 index to algebraic 'a8', 'h1' etc.
    // NOTE: Chess.js uses 0=a8? No, wait.
    // Let's assume our grid r=0 is TOP (Rank 8), c=0 is LEFT (File a).
    private indexToSquare(index: number): string {
        const r = Math.floor(index / 8);
        const c = index % 8;

        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        return files[c] + ranks[r];
    }

    /**
     * Tries to find a legal move that explains the changed squares.
     * @param changedIndices Array of indices (0-63) that show visual difference.
     * @returns The move object if confident, or null.
     */
    inferMove(changedIndices: number[]): Move | null {
        if (changedIndices.length < 2) return null; // Need at least from & to

        const moves = this.game.moves({ verbose: true });
        const changedSquares = changedIndices.map(i => this.indexToSquare(i));

        // Find a move where BOTH 'from' and 'to' are in the changed list.
        const candidates = moves.filter(m =>
            changedSquares.includes(m.from) && changedSquares.includes(m.to)
        );

        // Simple Case: Just one move fits the changes (e.g. e2->e4)
        if (candidates.length === 1) {
            return candidates[0];
        }

        // Complex Case: Captures? Castling? 
        // If capture, the 'to' square changes (piece A replaced by piece B) and 'from' changes (empty).
        // Still just 2 squares changing visually.

        // Ensure we prioritize moves that match exactly the number of changes?
        // Actually, detecting captures is hard because 'to' might not look "changed" if colors are similar?
        // No, 'absdiff' usually detects piece swap comfortably.

        // Let's just return the first valid candidate for now
        if (candidates.length > 0) return candidates[0];

        return null;
    }

    makeMove(move: string | { from: string, to: string }): Move | null {
        try {
            return this.game.move(move);
        } catch (e) {
            return null;
        }
    }

    isCheckmate(): boolean {
        return this.game.isCheckmate();
    }
}
