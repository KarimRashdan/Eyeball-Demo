import * as faceapi from "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.esm.js";

const EMOTION_FPS = 10; // run emotion detection at max 10 fps
const MIN_INTERVAL_MS = 1000 / EMOTION_FPS; // convert to ms

const INPUT_WIDTH = 256; // downscale
const TINYFACE_INPUT_SIZE = 224; // run actual face detector at this res

const HOLD_MS = 180; // hold last emotion for this long
const SWITCH_MARGIN = 0.12; // new emotion mmust beat curret by this much
const NEUTRAL_MARGIN = 0.10; // require neutral to be better than current by this much to swigh

let ready = false;
let lastEmotion = { label: "neutral", blendshapes: [], debug: { reason: "init" } };
let lastDetectionStartMs = 0;
let detectNow = false;
let downscaledCanvas = null;
let downscaledContext = null;
let detectorOptions = null;

let stableLabel = "neutral";
let stableScore = 0;
let stableSinceMs = 0;

let generation = 0;

function safeNowMs(time) {
    if (typeof time === "number") return time;
    if (typeof time === "function") return time();
    return performance.now();
}

function createCanvas(video) {
    if (!video || video.videowidth === 0 || video.videoHeight === 0) return;

    const w = INPUT_WIDTH;
    const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * w));

    if (!downscaledCanvas) {
        downscaledCanvas = document.createElement("canvas");
        downscaledCanvas.width = w;
        downscaledCanvas.height = h;
        downscaledContext = downscaledCanvas.getContext("2d");
        return;
    }

    if (downscaledCanvas.width !== w || downscaledCanvas.height !== h) {
        downscaledCanvas.width = w;
        downscaledCanvas.height = h;
    }
}

function drawDownscaled(video) {
    if (!downscaledCanvas || !downscaledContext) return null;
    downscaledContext.drawImage(video, 0, 0, downscaledCanvas.width, downscaledCanvas.height);
    return downscaledCanvas;
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
        const s = typeof score === "number" ? score : 0;
        if (s > bestScore) {
            bestScore = s;
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
    generation += 1;
    lastEmotion = { label: "neutral", blendshapes: [], debug: { reason: "reset" } };
    lastDetectionStartMs = 0;
    detectNow = false;
    stableLabel = "neutral";
    stableScore = 0;
    stableSinceMs = 0;
}

export function updateEmotion(video, time) {
    if (!ready || !video) return lastEmotion;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return lastEmotion;
    const nowMs = safeNowMs(time);

    // hold up a second there bubba
    if (nowMs - lastDetectionStartMs < MIN_INTERVAL_MS) return lastEmotion;
    if (detectNow) return lastEmotion;

    const myGen = generation;

    detectNow = true;
    lastDetectionStartMs = nowMs;

    createCanvas(video);
    const input = drawDownscaled(video);
    if (!input) {
        detectNow = false;
        return lastEmotion;
    }

    (async () => {
        try {
            const result = await faceapi.detectSingleFace(input, detectorOptions).withFaceExpressions();
            if (myGen !== generation) return;
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
            if (myGen !== generation) return;
            lastEmotion = {label: stableLabel, blendshapes: [], debug: { reason: "error" } };
        } finally {
            if (myGen !== generation) return;
            detectNow = false;
        }
    })();

    return lastEmotion;
}

export function getCurrentEmotion() {
    return lastEmotion;
}