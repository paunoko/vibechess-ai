# VibeChess AI - Live Assistant

VibeChess AI is a real-time chess assistant that uses computer vision to track physical chessboards and analyzing moves. It overlays a virtual board, detecting moves via camera feed, and provides Stockfish-powered evaluations and best-move suggestions.

## Features

-   **Real-time Board Tracking**: Uses OpenCV.js to detect and track the corners of a physical chessboard from a video feed.
-   **Move Detection**: Infers chess moves by detecting changes on the board.
-   **Stockfish Integration**: Integrated Stockfish.js engine for real-time position analysis and evaluation.
-   **Visual Overlay**: Classic chessboard style overlay showing the virtual board state next to the camera feed.
-   **Game History**: automatic logging of moves (Algebraic Notation).
-   **Manual Corrections**: Ability to fix board state via drag-and-drop on the virtual board.

## Prerequisites

-   **Node.js**
-   **npm**
-   **Webcam**: A working webcam connected to your computer.
-   **Physical Chessboard**: A standard chessboard and pieces.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/vibechess-ai.git
    cd vibechess-ai
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Usage

1.  Start the development server:
    ```bash
    npm run dev
    ```

2.  Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

3.  **Allow Camera Access**: The browser will ask for permission to use your camera. Allow it.

4.  **Calibration**:
    *   Click the **"1. Kalibroi"** (Calibrate) button or ensure the status asks to click 4 corners.
    *   Click the four corners of your physical chessboard on the video feed in **clockwise order**, starting from the **top-left**.

5.  **Lock & Play**:
    *   Once corners are selected, click **"2. Lukitse"** (Lock).
    *   The board is now monitored. Make your moves on the physical board; the app will detect them and update the virtual board and evaluation.

## Architecture

-   **Frontend**: Vite + TypeScript
-   **Computer Vision**: OpenCV.js (Perspective analysis, instability detection)
-   **Chess Logic**: Chess.js (Rules, move validation)
-   **Engine**: Stockfish.js (WebAssembly-based chess engine)

## Troubleshooting

-   **Lighting**: Ensure even lighting on the board for best detection results.
-   **Stability**: If the camera moves, click "Nollaa" (Reset) and recalibrate the corners.
-   **Move Detection**: If a move is missed, you can manually make the move on the virtual board to sync the state.
