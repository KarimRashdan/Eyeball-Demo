import * as faceapi from "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.esm.js";

const EMOTION_FPS = 10; // run emotion detection at max 10 fps
const MIN_INTERVAL_MS = 1000 / EMOTION_FPS; // convert to ms

const ROI_OUTPUT_WIDTH = 256; 
const TINYFACE_INPUT_SIZE = 224; // run actual face detector at this res

const HOLD_MS = 180; // hold last emotion for this long
const SWITCH_MARGIN = 0.12; // new emotion mmust beat curret by this much
const NEUTRAL_MARGIN = 0.10; // require neutral to be better than current by this much to swigh

let ready = false;
let lastEmotion = { label: "neutral", blendshapes: [], debug: { reason: "init" } };
let lastDetectionStartMs = 0;
let detectNow = false;
let bbCanvas = null;
let bbCtx = null;
let detectorOptions = null;

let stableLabel = "neutral";
let stableScore = 0;
let stableSinceMs = 0;

function safeNowMs(time) {
    if (typeof time === "number") return time;
    if (typeof time === "function") return time();
    return performance.now();
}

// expand the region of interest by a padding fraction
function PadBB(bb, padFrac = 0.20) {
    if (!bb) return null;
    const cx = bb.x + bb.width * 0.5;
    const cy = bb.y + bb.height * 0.5;
    const w = bb.width * (1 + padFrac);
    const h = bb.height * (1 + padFrac);
    return {x: cx - w * 0.5, y: cy - h * 0.5, width: w, height: h };
}

// ensrue padded roi is inside the video
function clampBB(bb, vw, vh) {
    // convert to pixel coords
    let sx = Math.round((bb.x ?? 0) * vw);
    let sy = Math.round((bb.y ?? 0) * vh);
    let sw = Math.round((bb.width ?? 0) * vw);
    let sh = Math.round((bb.height ?? 0) * vh);
    // ensure min size
    sw = Math.max(1, sw);
    sh = Math.max(1, sh);
    // clamp to video bounds
    sx = Math.max(0, Math.min(vw - 1, sx));
    sy = Math.max(0, Math.min(vh - 1, sy));
    const ex = Math.max(sx + 1, Math.min(vw, sx + sw));
    const ey = Math.max(sy + 1, Math.min(vh, sy + sh));

    sw = Math.max(1, ex - sx);
    sh = Math.max(1, ey - sy);

    return { sx, sy, sw, sh };
}

// create and store the canvas + resizing
function ensureCanvas(outW, outH) {
    if (!bbCanvas) {
        bbCanvas = document.createElement("canvas");
        bbCtx = bbCanvas.getContext("2d", { willReadFrequently: false });
    }
    if (bbCanvas.width !== outW) bbCanvas.width = outW;
    if (bbCanvas.height !== outH) bbCanvas.height = outH;
}

function drawBB(video, bb) {
    if (!video || video.readyState < 2) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    if (!bb) return null;

    const paddedBB = PadBB(bb, 0.20);
    const { sx, sy, sw, sh } = clampBB(paddedBB, vw, vh);
    // preserve aspect ratio when fitting to ROI_OUTPUT_WIDTH
    const outW = ROI_OUTPUT_WIDTH;
    const outH  = Math.max(1, Math.round((sh / sw) * outW));

    ensureCanvas(outW, outH);
    bbCtx.clearRect(0, 0, outW, outH);
    bbCtx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);

    return bbCanvas;
}

function mapEmotionLabel(label) {
    switch (label) {
        case "happy":
            return "happy";
        case "sad":
            return "sad";
        case "angry":
            return "angry";
        case "surprised":
            return "surprised";
        case "neutral":
            return "neutral";

        // missing cases
        case "fearful":
            return "surprised";
        case "disgusted":
            return "angry";

        default:
            return "neutral";
    }
}

function bestCandidate(expressions) {
    let bestLabel = "neutral";
    let bestScore = -Infinity;

    for (const [label, score] of Object.entries(expressions)) {
        if (score > bestScore) {
            bestScore = score;
            bestLabel = label;
        }
    }
    return { bestLabel, bestScore };
}

function stabilize(nowMs, candidate, candidateScore) {
    const holdSwap = nowMs - stableSinceMs < HOLD_MS;
    if (candidate === stableLabel) {
        stableScore = candidateScore;
        return stableLabel;
    }
    // neutral flicker fix
    if (candidate === "neutral" && stableLabel !== "neutral") {
        if (candidateScore < stableScore + NEUTRAL_MARGIN) {
            return stableLabel;
        }
    }
    
    if (holdSwap) {
        if (candidateScore < stableScore + SWITCH_MARGIN) {
            return stableLabel;
        }
    }

    stableLabel = candidate;
    stableScore = candidateScore;
    stableSinceMs = nowMs;
    return stableLabel;
}

export function emotionDetectorReady() {
    return !!ready;
}

export async function initEmotionDetector() {
    if (ready) return;
    await faceapi.tf.ready();
    await faceapi.tf.setBackend("webgl");
    await faceapi.tf.ready();

    const MODEL_BASE = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_BASE),
    ]);

    detectorOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: TINYFACE_INPUT_SIZE,
    });

    resetEmotionState();
    ready = true;
    console.log("Emotion detector ready");
}

export function resetEmotionState() {
    lastEmotion = { label: "neutral", blendshapes: [], debug: { reason: "reset" } };
    lastDetectionStartMs = 0;
    detectNow = false;
    stableLabel = "neutral";
    stableScore = 0;
    stableSinceMs = 0;
}

export function updateEmotion(video, time, bb) {
    if (!ready || !video) return lastEmotion;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return lastEmotion;
    const nowMs = safeNowMs(time);

    // hold up a second there bubba
    if (nowMs - lastDetectionStartMs < MIN_INTERVAL_MS) return lastEmotion;
    if (detectNow) return lastEmotion;

    // can't run face detection on nothing...
    if (!bb) {
        const chosen = stabilize(nowMs, "neutral", 0);
        lastEmotion = { label: chosen, blendshapes: [], debug: { reason: "no bb" } };
        return lastEmotion;
    }

    const input = drawBB(video, bb);
    if (!input) {
        detectNow = false;
        return lastEmotion;
    }

    detectNow = true;
    lastDetectionStartMs = nowMs;

    (async () => {
        try {
            const result = await faceapi.detectSingleFace(input, detectorOptions).withFaceExpressions();
            if (!result || !result.expressions) {
                const chosen = stabilize(nowMs, "neutral", 0);
                lastEmotion = { label: chosen, blendshapes: [], debug: { reason: "no face" } };
                return;
            }

            const { bestLabel, bestScore } = bestCandidate(result.expressions);
            const mappedCandidate = mapEmotionLabel(bestLabel);
            const chosen = stabilize(nowMs, mappedCandidate, bestScore);

            lastEmotion = { label: chosen, blendshapes: [] };
        } catch (error) {
            console.error("Error during emotion detection:", error);
            lastEmotion = {label: stableLabel, blendshapes: [], debug: { reason: "error" } };
        } finally {
            detectNow = false;
        }
    })();
    return lastEmotion;
}

export function getCurrentEmotion() {
    return lastEmotion;
}