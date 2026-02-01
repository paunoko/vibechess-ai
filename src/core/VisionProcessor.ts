import { VISION_CONFIG } from './Constants';

declare const cv: any;

export interface VisionEvents {
    onStabilityChange: (stable: boolean) => void;
    onMoveDetected: (activeIndices: number[]) => void;
}

export class VisionProcessor {
    private src: any = null;
    private gray: any = null;
    private baseline: any = null;
    private diff: any = null;
    private cap: any = null;
    private kernel: any = null;


    private videoElement: HTMLVideoElement;
    private canvasElement: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // Config
    private sensitivity: number = VISION_CONFIG.DEFAULT_SENSITIVITY;
    private pixelDiffThreshold: number = VISION_CONFIG.DEFAULT_THRESHOLD;

    private readonly STABILITY_MS = VISION_CONFIG.STABILITY_MS;

    // State
    private isLocked: boolean = false;
    private requestAnimationId: number | null = null;
    private lastActiveIndices: number[] = [];
    private stabilityStart: number = 0;
    private isStable: boolean = false;

    // Calibration
    private corners: { x: number, y: number }[] = [];
    private perspectiveMatrix: any = null;
    private warped: any = null;
    private readonly WARPED_SIZE = VISION_CONFIG.WARPED_SIZE;

    // External listeners
    public events: VisionEvents = {
        onStabilityChange: () => { },
        onMoveDetected: () => { }
    };

    // Context Awareness
    private boardState: ({ type: string, color: string } | null)[] = []; // 64 squares

    constructor(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        const context = this.canvasElement.getContext('2d');
        if (!context) throw new Error("Could not get canvas context");
        this.ctx = context;
    }

    setSensitivity(val: number): void {
        this.sensitivity = val;
        console.log("Sensitivity set to:", val);
    }

    setThreshold(val: number): void {
        this.pixelDiffThreshold = val;
        console.log("Threshold set to:", val);
    }

    updateState(board: ({ type: string, color: string } | null)[][]): void {
        // Flatten 2D board to 1D array to match indices 0-63
        // Chess.js board() returns [rank8, rank7...] (top to bottom)
        // Our indices are also 0=a8 (top-left) to 63=h1. Matches perfectly.
        this.boardState = board.flat();
        console.log("Vision state updated with board context.");
    }

    async init(): Promise<void> {
        return new Promise((resolve) => {
            const checkCv = () => {
                if (typeof cv !== 'undefined' && cv.Mat) {
                    resolve();
                } else {
                    setTimeout(checkCv, 100);
                }
            };
            checkCv();
        });
    }

    start(): void {
        const w = this.videoElement.width || this.videoElement.videoWidth;
        const h = this.videoElement.height || this.videoElement.videoHeight;

        if (!w || !h) {
            console.error("Video dimensions are 0! Waiting for metadata...");
            requestAnimationFrame(() => this.start());
            return;
        }

        if (this.videoElement.width !== w) this.videoElement.width = w;
        if (this.videoElement.height !== h) this.videoElement.height = h;

        this.src = new cv.Mat(h, w, cv.CV_8UC4);
        this.gray = new cv.Mat(h, w, cv.CV_8UC1);
        this.baseline = new cv.Mat();
        this.diff = new cv.Mat();
        this.warped = new cv.Mat();
        this.kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        this.cap = new cv.VideoCapture(this.videoElement);


        this.processFrame();
    }

    private processFrame = () => {
        try {
            if (this.cap && this.src && !this.src.isDeleted()) {
                this.cap.read(this.src);
                cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);

                this.ctx.clearRect(0, 0, 640, 480);
                this.ctx.drawImage(this.videoElement, 0, 0, 640, 480);

                this.drawCalibrationMarkers();

                // Always warp if perspective is known (for Auto-Tune)
                if (this.perspectiveMatrix) {
                    cv.warpPerspective(
                        this.gray,
                        this.warped,
                        this.perspectiveMatrix,
                        new cv.Size(this.WARPED_SIZE, this.WARPED_SIZE)
                    );
                }

                if (this.isLocked) {
                    if (this.perspectiveMatrix) {
                        this.monitorOccupancy(this.warped);
                    } else {
                        // Fallback
                        this.monitorOccupancy(this.gray);
                    }
                }
            }
        } catch (e) {
            console.error("OpenCV processing error", e);
        }
        this.requestAnimationId = requestAnimationFrame(this.processFrame);
    };

    stop(): void {
        if (this.requestAnimationId) cancelAnimationFrame(this.requestAnimationId);
        if (this.src) this.src.delete();
        if (this.gray) this.gray.delete();
        if (this.baseline) this.baseline.delete();
        if (this.diff) this.diff.delete();
        if (this.warped) this.warped.delete();
        if (this.kernel) this.kernel.delete();
        if (this.perspectiveMatrix) this.perspectiveMatrix.delete();
    }

    addCorner(x: number, y: number): void {
        if (this.isLocked) return;
        if (this.corners.length < 4) {
            this.corners.push({ x, y });

            if (this.corners.length === 4) {
                this.computePerspective();
            }
        }
    }

    resetCorners(): void {
        this.corners = [];
        if (this.perspectiveMatrix) {
            this.perspectiveMatrix.delete();
            this.perspectiveMatrix = null;
        }
    }

    private computePerspective(): void {
        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            this.corners[0].x, this.corners[0].y,
            this.corners[1].x, this.corners[1].y,
            this.corners[2].x, this.corners[2].y,
            this.corners[3].x, this.corners[3].y
        ]);

        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0,
            this.WARPED_SIZE, 0,
            this.WARPED_SIZE, this.WARPED_SIZE,
            0, this.WARPED_SIZE
        ]);

        this.perspectiveMatrix = cv.getPerspectiveTransform(srcTri, dstTri);
        srcTri.delete();
        dstTri.delete();
        console.log("Perspective Matrix Computed");
    }

    setLocked(locked: boolean): void {
        this.isLocked = locked;
        if (locked) {
            if (this.perspectiveMatrix) {
                cv.warpPerspective(
                    this.gray,
                    this.warped,
                    this.perspectiveMatrix,
                    new cv.Size(this.WARPED_SIZE, this.WARPED_SIZE)
                );
                this.captureBaseline(this.warped);
            } else {
                this.captureBaseline(this.gray);
            }
        }
    }

    captureBaseline(sourceMat: any = null): void {
        const src = sourceMat || (this.perspectiveMatrix ? this.warped : this.gray);

        if (this.baseline.cols !== src.cols || this.baseline.rows !== src.rows) {
            this.baseline.create(src.rows, src.cols, cv.CV_8UC1);
            this.diff.create(src.rows, src.cols, cv.CV_8UC1);
        }

        src.copyTo(this.baseline);
        console.log("Baseline captured");
    }

    private drawCalibrationMarkers(): void {
        this.ctx.strokeStyle = "#e74c3c";
        this.ctx.fillStyle = "#e74c3c";
        this.ctx.lineWidth = 2;

        this.corners.forEach((p, i) => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.fillText((i + 1).toString(), p.x + 8, p.y - 8);
        });

        if (this.corners.length === 4) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.corners[0].x, this.corners[0].y);
            this.ctx.lineTo(this.corners[1].x, this.corners[1].y);
            this.ctx.lineTo(this.corners[2].x, this.corners[2].y);
            this.ctx.lineTo(this.corners[3].x, this.corners[3].y);
            this.ctx.closePath();
            this.ctx.stroke();
        } else {
            if (!this.isLocked) {
                this.ctx.fillStyle = "#f1c40f";
                this.ctx.font = "20px var(--font-family)";
                const labels = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"];
                this.ctx.fillText(`Click ${labels[this.corners.length]}`, 20, 30);
            }
        }
    }


    // Getters for external logic if needed
    getBaseline(): any { return this.baseline; }
    getWarped(): any { return this.warped; }
    getGray(): any { return this.gray; }
    hasPerspective(): boolean { return !!this.perspectiveMatrix; }

    private monitorOccupancy(inputMat: any): void {
        cv.absdiff(inputMat, this.baseline, this.diff);
        cv.threshold(this.diff, this.diff, this.pixelDiffThreshold, 255, cv.THRESH_BINARY);
        cv.morphologyEx(this.diff, this.diff, cv.MORPH_OPEN, this.kernel);

        let activeIndices: number[] = [];
        let stepX = inputMat.cols / 8;
        let stepY = inputMat.rows / 8;
        let startX = 0;

        if (!this.perspectiveMatrix) {
            stepX = 480 / 8;
            stepY = 480 / 8;
            startX = (640 - 480) / 2;
        }

        // Debug Mini-View
        const miniX = 10;
        const miniY = 10;
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        this.ctx.strokeRect(miniX, miniY, 100, 100);
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillRect(miniX, miniY, 100, 100);

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const x = startX + (c * stepX);
                const y = r * stepY;

                // Center ROI Calculation
                // We only look at the inner 50% of the square to avoid edge bleeding
                const marginX = stepX * 0.25;
                const marginY = stepY * 0.25;
                const innerX = x + marginX;
                const innerY = y + marginY;
                const innerW = stepX * 0.5;
                const innerH = stepY * 0.5;

                let rect = new cv.Rect(innerX, innerY, innerW, innerH);
                let roi = this.diff.roi(rect);
                let count = cv.countNonZero(roi);
                roi.delete();

                // Dynamic Sensitivity
                const idx = r * 8 + c;
                const squareColor = (r + c) % 2 === 0 ? 'w' : 'b'; // Light or Dark square
                const piece = this.boardState[idx]; // Current piece on this square (from baseline)

                let threshold = this.sensitivity;

                // CONTEXT RULES:
                if (squareColor === 'b') {
                    if (piece && piece.color === 'b') {
                        // Black Piece on Black Square (The Hardest)
                        // This typically returns VERY FEW pixels even when moved.
                        // We need to be Hyper-Sensitive.
                        threshold = Math.max(10, this.sensitivity * 0.4);
                    } else if (piece === null) {
                        // Empty Black Square (detecting arrival of Black Piece)
                        // Also hard.
                        threshold = Math.max(15, this.sensitivity * 0.5);
                    }
                } else {
                    // White Squares are generally fine, but White-on-White can be tricky.
                    if (piece && piece.color === 'w') {
                        threshold = Math.max(20, this.sensitivity * 0.6);
                    }
                }

                // Global low-cap protection for noise
                // if (threshold < 10) threshold = 10;

                if (count > threshold) {
                    activeIndices.push(r * 8 + c);

                    // Draw on Mini-View
                    this.ctx.fillStyle = "red";
                    this.ctx.fillRect(
                        miniX + (c * (100 / 8)),
                        miniY + (r * (100 / 8)),
                        (100 / 8) - 1,
                        (100 / 8) - 1
                    );
                }
            }
        }

        this.checkStability(activeIndices);
    }

    private checkStability(currentIndices: number[]): void {
        const isSame =
            currentIndices.length === this.lastActiveIndices.length &&
            currentIndices.every((val, index) => val === this.lastActiveIndices[index]);

        const now = Date.now();

        // STRICT RULE: Only allow exactly 2 changes (From -> To)
        // This effectively filters out huge noise (hand waving) or partial noise (1 square flickering)
        if (isSame && currentIndices.length === 2) {
            if (!this.isStable) {
                if (now - this.stabilityStart > this.STABILITY_MS) {
                    this.isStable = true;
                    this.events.onStabilityChange(true);
                    this.events.onMoveDetected(currentIndices);
                }
            }
        } else {
            // Reset if signals change OR if we don't have exactly 2
            this.stabilityStart = now;
            this.lastActiveIndices = currentIndices;
            if (this.isStable) {
                this.isStable = false;
                this.events.onStabilityChange(false);
            }
        }
    }
}
