import { CameraManager } from './core/CameraManager';
import { VisionProcessor } from './core/VisionProcessor';
import { ChessLogic } from './core/ChessLogic';
import { StockfishService } from './core/StockfishService';
import { UIManager } from './ui/UIManager';
import './style.css';

async function main() {
    const ui = new UIManager();
    const chess = new ChessLogic();

    const stockfish = new StockfishService(
        (cp) => ui.updateEvalBar(cp),
        (move) => ui.updateBestMove(move)
    );
    stockfish.init();

    const camera = new CameraManager('videoInput');
    await camera.start();

    const canvas = document.getElementById('overlayCanvas') as HTMLCanvasElement;
    const vision = new VisionProcessor(camera.getVideoElement(), canvas);

    ui.updateStatus("Ladataan OpenCV...", 'waiting');
    ui.initBoard(); // Initialize the board elements
    ui.updateBoard(chess.getFen()); // Show initial empty/start state

    await vision.init();
    ui.updateStatus("Valmis kalibrointiin", 'waiting');

    vision.start();

    // Connect Vision Events
    vision.events.onMoveDetected = (indices) => {
        try {
            const move = chess.inferMove(indices);
            if (move) {
                console.log("Detected Move:", move.lan);
                chess.makeMove(move);
                ui.logMove(`${move.san}`);
                ui.updateBoard(chess.getFen()); // Sync board visual
                ui.updateBestMove("..."); // Clear old highlight

                // Wait a moment for visual update then re-baseline
                vision.captureBaseline();

                ui.updateTurn(chess.getTurn());
                // Update Vision Context
                vision.updateState(chess.getBoard());

                stockfish.analyze(chess.getFen());
                ui.updateStatus("Lauta lukittu - Pelaa!", 'ready');
            } else {
                ui.updateStatus("Tuntematon siirto", 'waiting');
            }
        } catch (e) {
            console.error("Move processing error:", e);
            ui.updateStatus("Virhe siirron tunnistuksessa", 'error');
        }
    };

    vision.events.onStabilityChange = (isStable) => {
        if (!isStable) {
            ui.updateStatus("Tunnistetaan...", 'waiting');
        }
    };

    // Bind Controls
    ui.bindCanvasClick((x, y) => {
        vision.addCorner(x, y);
    });

    ui.bindSensitivity((val) => {
        vision.setSensitivity(val);
    });

    // Handle Manual Moves (Drag & Drop fixes)
    ui.bindBoardInteraction((from, to) => {
        try {
            const move = chess.makeMove({ from, to });
            if (move) {
                console.log("Manual Fix:", move.lan);
                ui.logMove(`(Fix) ${move.san}`);
                ui.updateBoard(chess.getFen());
                ui.updateBestMove("...");
                ui.updateTurn(chess.getTurn());

                // Update Vision Context
                vision.updateState(chess.getBoard());

                // IMPORTANT: Re-baseline immediately to accept the new reality
                vision.captureBaseline();

                stockfish.analyze(chess.getFen());
            } else {
                console.warn("Invalid manual move:", from, to);
                // Optionally warn user, or checking logic prevents illegal moves
                // Re-render board to snap piece back
                ui.updateBoard(chess.getFen());
            }
        } catch (e) {
            console.error("Manual move error:", e);
            ui.updateBoard(chess.getFen()); // Reset on error
        }
    });

    // State for Calibration Wizard (Replaced by explicit buttons)
    // let calibrationStep = 0;

    // Auto-Tune Step 1 state implicit in disabled buttons.

    ui.bindButtons(
        () => { // Capture (Manual Reset / Wizard Step 1)
            vision.resetCorners();
            vision.setLocked(false);
            ui.updateStatus("Klikkaa 4 kulmaa...", 'waiting');
            ui.showToast("Klikkaa 4 kulmaa videosta (myötäpäivään, alkaen vasen ylä).", "info");
        },
        () => { // Lock
            if (!vision.hasPerspective()) {
                ui.showToast("Virhe: Klikkaa ensin 4 kulmaa!", "error");
                return;
            }
            vision.setLocked(true);
            ui.updateStatus("Lauta lukittu - Pelaa!", 'ready');
            ui.showToast("Lauta lukittu! Peli alkaa.", "success");
            // Initial Vision Context
            vision.updateState(chess.getBoard());
            stockfish.analyze(chess.getFen());
        },
        () => { // Reset
            chess.reset();
            ui.updateBoard(chess.getFen()); // Reset visual pieces
            vision.setLocked(false);
            vision.resetCorners();
            ui.updateStatus("Klikkaa 4 kulmaa", 'waiting');
            ui.clearLog();
            ui.updateBestMove("...");
            ui.updateEvalBar(0);
            ui.updateTurn('w');
            ui.showToast("Peli nollattu.", "info");
        }
    );
}

document.addEventListener('DOMContentLoaded', main);
