export class CameraManager {
    private videoElement: HTMLVideoElement;

    constructor(videoElementId: string) {
        const element = document.getElementById(videoElementId);
        if (!element || !(element instanceof HTMLVideoElement)) {
            throw new Error(`Video element #${videoElementId} not found`);
        }
        this.videoElement = element;
    }

    async start(width: number = 640, height: number = 480): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width, height }
            });
            this.videoElement.srcObject = stream;

            return new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });
        } catch (err) {
            console.error("Error accessing camera:", err);
            throw new Error("Could not access camera. Please check permissions.");
        }
    }

    getVideoElement(): HTMLVideoElement {
        return this.videoElement;
    }
}
