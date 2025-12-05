import { initRendering, updateRendering} from "./rendering/rendering.js";
import { initTracking, getTargets } from "./tracking/tracking.js";
import { initBehaviour, updateBehaviour } from "./behaviour/behaviour.js";
import { initUI, updateUI } from "./ui/ui.js";

let lastTime = 0;

function mainLoop(currentTime) {
    // https://developer.mozilla.org/en-US/docs/Games/Anatomy
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    const faces = getTargets(); // get tracking targets
    const behaviourState = updateBehaviour(faces); // update behaviour based on emotions on face(s)
    updateRendering(deltaTime, behaviourState); // update rendering based on behaviour state
    updateUI(behaviourState); // update UI based on behaviour state
    requestAnimationFrame(mainLoop);
}

function startApp() {
    // autocompleted by Java IntelliSense
    const canvas = document.getElementById("eyeball-canvas");
    const rootElement = document.getElementById("ui-root");
    initRendering(canvas);
    initTracking();
    initBehaviour();
    initUI(rootElement);

    requestAnimationFrame(mainLoop);
}

startApp();