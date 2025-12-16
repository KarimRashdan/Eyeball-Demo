import { initRendering, updateRendering} from "./rendering/rendering.js";
import { initTracking, getTargets } from "./tracking/tracking.js";
import { initBehaviour, updateBehaviour } from "./behaviour/behaviour.js";
import { initUI, updateUI } from "./ui/ui.js";
import { initEmotionDetector, updateEmotion } from "./tracking/emotion.js";

let lastTime = 0;
let accumulator = 0;
const FPS = 60;
const FRAME_TIME = 1000 / FPS;

function updateFixed(dt) {
    const faces = getTargets();
    let emotionLabel = "neutral";
    const video = document.getElementById("webcamVideo");

    if (video && video.readyState >= 2) {
        try {
            const emotionState = updateEmotion(video, performance.now());
            if (emotionState?.label) emotionLabel = emotionState.label;
        } catch (error) {
            console.error("Error updating emotion:", error);
        }
    }

    const behaviourState = updateBehaviour(faces, emotionLabel);

    updateRendering(dt, behaviourState);
    updateUI(behaviourState);

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
    // autocompleted by Java IntelliSense
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