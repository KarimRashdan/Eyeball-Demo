import { updateIdleBehaviour } from "./idle.js";

let behaviourState = {
    mode: "idle",                 // idle or tracking
    targetCoords: { x: 0, y: 0 }, // coordinates the eyeball wants to look at
    numFaces: 0,                  // number of faces detected in current frame
    emotion: "neutral",           // placeholder for emotional state
    idleTarget: { x: 0, y: 0 },   // where to wander in idle mode
    idleTimerFrames: 0,           // frames until next idle target change
    noFaceFrames: 0,              // frames since last face detected
};

// pretty self explanatory really
let hadFaceLastFrame = false;
// frames until new IDLE target, mess around with this when more progress
const IDLE_TARGET_CHANGE_FRAMES = 60; // 60 = 1 second ar 60 fps
// when target disappears don't instantly wander, wait
const HOLD_GAZE_FRAMES = 30; // 30 = 0.5 seconds at 60 fps


// responsible for initializing eyeball's behavioural state
export function initBehaviour() {
    behaviourState = {
        mode: "idle",
        targetCoords: { x: 0, y: 0 },
        numFaces: 0,
        emotion: "neutral",
        idleTarget: { x: 0, y: 0 },
        idleTimerFrames: 0,
    };
    hadFaceLastFrame = false;
    console.log("Behaviour initialized:", behaviourState);
}

// updates the eyeball's emotional state, choose target, not entirely sure yet
export function updateBehaviour(faces) {
    const safeFaces = faces || [];
    const numFaces = safeFaces.length;

    const hadFace = hadFaceLastFrame;
    hadFaceLastFrame = numFaces > 0;

    // if the face has just been lost this frame
    if (numFaces === 0) {
        behaviourState.numFaces = 0;

        if (hadFace) {
            behaviourState.mode = "idle";
            behaviourState.noFaceFrames = 0;

            // freeze idleTarget at wherever the eyeballl was last looking
            behaviourState.idleTarget = { ...behaviourState.targetCoords };
            behaviourState.targetCoords = behaviourState.idleTarget;

            return behaviourState;
        }

    // post disappearance settling period
    if (behaviourState.noFaceFrames < HOLD_GAZE_FRAMES) {
        behaviourState.noFaceFrames += 1;

        // keep looking at last target
        behaviourState.targetCoords = behaviourState.idleTarget;

        return behaviourState;
    }

    // basic idle mode
    behaviourState.mode = "idle";
    return updateIdleBehaviour(behaviourState);
    }

    // if faces are present
    behaviourState.mode = "tracking";
    behaviourState.numFaces = numFaces;
    behaviourState.noFaceFrames = 0; // reset no face counter

    // just pick first face in array, update later  
    const primaryFace = safeFaces[0];

    // face center in normalized video space
    const centerX = primaryFace.x + primaryFace.width / 2;
    const centerY = primaryFace.y + primaryFace.height / 2;

    // convert [0,1] to [-1,1]
    let gazeX = (centerX - 0.5) * 2; // -1 left, 0 mid, +1 right
    let gazeY = (0.5 - centerY) * 2; // +1 top, 0 mid, -1 bottom

    // clamp to [-1, 1]
    gazeX = Math.max(-1, Math.min(1, gazeX));
    gazeY = Math.max(-1, Math.min(1, gazeY));

    behaviourState.targetCoords = { x: gazeX, y: gazeY };

    return behaviourState
}