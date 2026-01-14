import { initRendering, updateRendering} from "./rendering/rendering.js";
import { initTracking, getTargets } from "./tracking/tracking.js";
import { initBehaviour, updateBehaviour } from "./behaviour/behaviour.js";
import { initUI, updateUI } from "./ui/ui.js";
import { initEmotionDetector, updateEmotion, resetEmotionState } from "./tracking/emotion.js";

let lastTime = 0;
let accumulator = 0;
const FPS = 60;
const FRAME_TIME = 1000 / FPS;

// fps
let lastEmotionUpdateMs = 0;
let cachedEmotionLabel = "neutral";
let lastUiPhase = "initial";

const ENMOTION_UPDATE_INTERVAL_MS = 40; //////////////// go as high as you can

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
    requestAnimationFrame(mainLoop);
}

startApp();