import { updateIdleBehaviour } from "./idle.js";

let behaviourState = {
    mode: "idle",                 // idle or tracking
    targetCoords: { x: 0, y: 0 }, // coordinates the eyeball wants to look at
    numFaces: 0,                  // number of faces detected in current frame
    emotion: "neutral",           // placeholder for emotional state
    idleTarget: { x: 0, y: 0 },   // where to wander in idle mode
    idleTimerFrames: 0,           // frames until next idle target change
    noFaceFrames: 0,              // frames since last face detected
    currentTargetIdx: -1,         // index of current target face being tracked
    lockFrames: 0                 // frames to keep locked on current target face
};

// pretty self explanatory really
let hadFaceLastFrame = false;
// when target disappears don't instantly wander, wait
const HOLD_GAZE_FRAMES = 30; // 30 = 0.5 seconds at 60 fps
const MIN_LOCK_FRAMES = 300;  // drastically change these later
const MAX_LOCK_FRAMES = 1200;


// responsible for initializing eyeball's behavioural state
export function initBehaviour() {
    behaviourState = {
        mode: "idle",
        targetCoords: { x: 0, y: 0 },
        numFaces: 0,
        emotion: "neutral",
        idleTarget: { x: 0, y: 0 },
        idleTimerFrames: 0,
        noFaceFrames: 0,
        currentTargetIdx: -1,
        lockFrames: 0,
    };
    hadFaceLastFrame = false;
    console.log("Behaviour initialized:", behaviourState);
}

// updates the eyeball's emotional state, choose target, not entirely sure yet
export function updateBehaviour(faces, emotionLabel) {
    const safeFaces = faces || [];
    const numFaces = safeFaces.length;

    // keep behaviourState emotion synced up w detector
    behaviourState.emotion = emotionLabel || "neutral";

    const hadFace = hadFaceLastFrame;
    hadFaceLastFrame = numFaces > 0;

    // if the face has just been lost this frame
    if (numFaces === 0) {
        behaviourState.numFaces = 0;
        behaviourState.currentTargetIdx = -1;
        behaviourState.lockFrames = 0;

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

    let targetIdx = behaviourState.currentTargetIdx;

    // if no valid target yet, pick one
    if (targetIdx < 0 || targetIdx >= numFaces) {
        targetIdx = 0;                 // pick first face for now
        behaviourState.lockFrames = 0; // reset lock timer
    } else {
        behaviourState.lockFrames += 1;
    }

    // simple logic for switching between targets, update later
    if (behaviourState.lockFrames > MAX_LOCK_FRAMES && numFaces > 1) {
        // just cycle to the next face for now
        targetIdx = (targetIdx + 1) % numFaces;
        behaviourState.lockFrames = 0;
    }

    // chosen target idx
    behaviourState.currentTargetIdx = targetIdx;

    // just pick first face in array, update later  
    const primaryFace = safeFaces[targetIdx];

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