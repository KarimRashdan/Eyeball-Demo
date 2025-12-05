import { initRendering, updateRendering} from "./rendering/rendering.js";
import { initTracking, getTargets } from "./tracking/tracking.js";
import { initBehaviour, updateBehaviour } from "./behaviour/behaviour.js";
import { initUI, updateUI } from "./ui/ui.js";
import { initEmotionDetector, updateEmotion } from "./tracking/emotion.js";

let lastTime = 0;

function mainLoop(currentTime) {
    // https://developer.mozilla.org/en-US/docs/Games/Anatomy
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    const faces = getTargets(); // get tracking targets

    let emotionLabel = "neutral";
    const video = document.getElementById("webcamVideo");
    if (video && video.readyState >= 2) {
        const emotionState = updateEmotion(video, currentTime); // update emotion detection
        if (emotionState && emotionState.label) {
            emotionLabel = emotionState.label;
        }
    }

    const behaviourState = updateBehaviour(faces, emotionLabel); // update behaviour based on emotions on face(s)
    updateRendering(deltaTime, behaviourState); // update rendering based on behaviour state
    updateUI(behaviourState); // update UI based on behaviour state

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