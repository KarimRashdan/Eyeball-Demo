import { initRendering, updateRendering} from "./rendering/rendering.js";
import { initTracking, getTargets } from "./tracking/tracking.js";
import { initBehaviour, updateBehaviour } from "./behaviour/behaviour.js";
import { initUI, updateUI } from "./ui/ui.js";
import { initEmotionDetector, updateEmotion, resetEmotionState } from "./tracking/emotion.js";
import { initSettingsUI } from "./ui/settings.js";

let lastTime = 0;
let accumulator = 0;
const FPS = 60;
const FRAME_TIME = 1000 / FPS;

// webcam
let previewCanvas = null;
let previewCtx = null;
let previewVideoElement = null;
let previewDpr = 1;
const PREVIEW_MIRRORED = true;

// fps
let lastEmotionUpdateMs = 0;
let cachedEmotionLabel = "neutral";
let lastUiPhase = "initial";

const ENMOTION_UPDATE_INTERVAL_MS = 40; //////////////// go as high as you can

function initWebcamOverlay() {
    previewVideoElement = document.getElementById("webcamVideo");
    previewCanvas = document.getElementById("webcam-overlay");
    if (!previewVideoElement || !previewCanvas) return;
    previewCtx = previewCanvas.getContext("2d");
    syncWebcamOverlaySize();
    window.addEventListener("resize", syncWebcamOverlaySize);
}

function syncWebcamOverlaySize() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
    if (!previewVideoElement || !previewCanvas || !previewCtx) return;
    const rect = previewVideoElement.getBoundingClientRect();
    previewDpr = window.devicePixelRatio || 1;
    previewCanvas.width = Math.max(1, Math.round(rect.width * previewDpr));
    previewCanvas.height = Math.max(1, Math.round(rect.height * previewDpr));
    previewCtx.setTransform(previewDpr, 0, 0, previewDpr, 0, 0);
}

function drawWebcamBBs(faces, primaryIdx = -1) {
    if (!previewCtx || !previewVideoElement || !previewCanvas) return;
    const rect = previewVideoElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    previewCtx.clearRect(0, 0, w, h);
    if (!faces || faces.length === 0) return;

    const mapX = (xNorm, widthNorm) => {
        if (!PREVIEW_MIRRORED) return xNorm * w;
        return (1 - xNorm - widthNorm) * w;
    }

    previewCtx.lineWidth = 2;
    previewCtx.strokeStyle = "rgba(255,255,255,0.75)";
    for (let i=0; i < faces.length; i++) {
        const f = faces[i];
        const x = mapX(f.x, f.width);
        const y = f.y * h;
        const bw = f.width * w;
        const bh = f.height * h;
        previewCtx.strokeRect(x, y, bw, bh);
    }

    if (primaryIdx >= 0 && primaryIdx < faces.length) {
        const f = faces[primaryIdx];
        const x = mapX(f.x, f.width);
        const y = f.y * h;
        const bw = f.width * w;
        const bh = f.height * h;
        previewCtx.strokeStyle = "rgba(80, 255, 120, 0.95)";
        previewCtx.lineWidth = 3;
        previewCtx.strokeRect(x, y, bw, bh);
    }
}

async function updateFixed(dt) {
    const faces = getTargets();
    const nowMs = performance.now();
    let emotionLabel = cachedEmotionLabel;
    const video = document.getElementById("webcamVideo");

    const phaseNeedsEmotion = (lastUiPhase === "choice" || lastUiPhase === "acquire");
    const updateEmotionNow = phaseNeedsEmotion && (nowMs - lastEmotionUpdateMs) >= ENMOTION_UPDATE_INTERVAL_MS;

    if (video && video.readyState >= 2 && updateEmotionNow) {
        try {
            const emotionState = updateEmotion(video, nowMs);
            if (emotionState?.label) {
                cachedEmotionLabel = emotionState.label;
                emotionLabel = cachedEmotionLabel;
            }
            lastEmotionUpdateMs = nowMs;
        } catch (error) {
            console.error("Error updating emotion:", error);
        }
    }

    const behaviourState = updateBehaviour(faces, emotionLabel, nowMs);

    drawWebcamBBs(faces, behaviourState?.primaryTargetIdx ?? -1);

    updateRendering(dt, behaviourState);
    updateUI(behaviourState);
    const newUiPhase = behaviourState.uiPhase ?? lastUiPhase;
    if (lastUiPhase !== "choice" && newUiPhase === "choice") {
        resetEmotionState();
        cachedEmotionLabel = "neutral";
        lastEmotionUpdateMs = 0;
    }
    lastUiPhase = newUiPhase;
}

function mainLoop(currentTime) {
    // https://developer.mozilla.org/en-US/docs/Games/Anatomy
    if (!lastTime) lastTime = currentTime;

    const delta = currentTime - lastTime;
    lastTime = currentTime;

    accumulator += delta;

    // run logic at 60
    while (accumulator >= FRAME_TIME) {
        updateFixed(FRAME_TIME);
        accumulator -= FRAME_TIME;
    }

    requestAnimationFrame(mainLoop);
}

async function startApp() {
    const canvas = document.getElementById("eyeball-canvas");
    const rootElement = document.getElementById("ui-root");

    initRendering(canvas);
    initBehaviour();
    initUI(rootElement);
    initEmotionDetector();
    initTracking();
    initWebcamOverlay();
    initSettingsUI();
    requestAnimationFrame(mainLoop);
}

startApp();