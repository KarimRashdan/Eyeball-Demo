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
let lastPreviewW = 0;
let lastPreviewH = 0;   
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
    lastPreviewW = rect.width;
    lastPreviewH = rect.height;
}

function ensureWebcamOverlaySize() {
    if (!previewVideoElement || !previewCanvas || !previewCtx) return;
    const rect = previewVideoElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (Math.abs(w - lastPreviewW) > 0.5 || Math.abs(h - lastPreviewH) > 0.5) {
        syncWebcamOverlaySize();
    }
}

function drawWebcamBBs(faces, primaryIdx = -1) {
    if (!previewCtx || !previewVideoElement || !previewCanvas) return;

    ensureWebcamOverlaySize();

    const rect = previewVideoElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    previewCtx.clearRect(0, 0, w, h);
    if (!faces || faces.length === 0) return;

    const vidW = previewVideoElement.videoWidth;
    const vidH = previewVideoElement.videoHeight;
    if (!vidW || !vidH) return;

    const coverScale = Math.max(w / vidW, h / vidH);
    const drawnW = vidW * coverScale;
    const drawnH = vidH * coverScale;
    const offsetX = (drawnW - w) / 2;
    const offsetY = (drawnH - h) / 2;

    const toPreviewBox = (f) => {
        const xDrawn = f.x * drawnW;
        const yDrawn = f.y * drawnH;
        const wDrawn = f.width * drawnW;
        const hDrawn = f.height * drawnH;

        let x = xDrawn - offsetX;
        let y = yDrawn - offsetY;
        const bw = wDrawn;
        const bh = hDrawn;

        if (PREVIEW_MIRRORED) {
            x = w - (x + bw);
        }

        return { x, y, bw, bh };
    }

    previewCtx.lineWidth = 2;
    previewCtx.strokeStyle = "rgba(255,255,255,0.75)";

    for (let i = 0; i < faces.length; i++) {
        const b = toPreviewBox(faces[i]);
        previewCtx.strokeRect(b.x, b.y, b.bw, b.bh);
    }

    if (primaryIdx >= 0 && primaryIdx < faces.length) {
        const b = toPreviewBox(faces[primaryIdx]);
        previewCtx.strokeStyle = "rgba(80, 255, 120, 0.95)";
        previewCtx.lineWidth = 3;
        previewCtx.strokeRect(b.x, b.y, b.bw, b.bh);
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