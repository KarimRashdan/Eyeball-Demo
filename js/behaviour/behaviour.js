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
    lockFrames: 0,                // frames to keep locked on current target face
    pupilScale: 1.0,              // scale of the pupil based on emotion
    eyeOpen: 1.0,                 // how open the eye is based on emotion
    jitterStrength: 0.0,          // amount of jitter to apply based on emotion

    // blink
    blinkProgress: 0.0,          // 0.0 = open, 1.0 = closed
    blinkPhase: "idle",          // idle, closing, opening
};

const EMOTION_PRESETS = {
    neutral:  { pupilScale: 1.0, eyeOpen: 1.0, jitterStrength: 0.0 },
    happy:    { pupilScale: 1.15, eyeOpen: 1.05, jitterStrength: 0.08 },
    sad:      { pupilScale: 0.95, eyeOpen: 0.8, jitterStrength: 0.0 },
    angry:    { pupilScale: 0.85, eyeOpen: 0.9, jitterStrength: 0.45 },
    surprised:{ pupilScale: 1.3, eyeOpen: 1.25, jitterStrength: 0.18 },
}

function applyEmotionPreset(state) {
    const label = state.emotion || "neutral";
    const preset = EMOTION_PRESETS[label] || EMOTION_PRESETS.neutral;

    state.pupilScale = preset.pupilScale;
    state.eyeOpen = preset.eyeOpen;
    state.jitterStrength = preset.jitterStrength;
}

function updateBlinkState(state, emotionChanged) {
    // safety
    if (state.blinkProgress == null) {
        state.blinkProgress = 0.0;
        state.blinkPhase = "idle";
    }

    // start blink if emotion changed
    if (emotionChanged && state.blinkPhase === "idle") {
            state.blinkPhase = "closing";
    }

    if (state.blinkPhase === "closing") {
        state.blinkProgress += BLINK_CLOSE_SPEED;

        if (state.blinkProgress >= 1.0) {
            state.blinkProgress = 1.0;
            state.blinkPhase = "opening";
        }
        return;
    }

    if (state.blinkPhase === "opening") {
        state.blinkProgress -= BLINK_OPEN_SPEED;

        if (state.blinkProgress <= 0.0) {
            state.blinkProgress = 0.0;
            state.blinkPhase = "idle";
        }
    }
}


// pretty self explanatory really
let hadFaceLastFrame = false;
// when target disappears don't instantly wander, wait
const HOLD_GAZE_FRAMES = 30; // 30 = 0.5 seconds at 60 fps
const MIN_LOCK_FRAMES = 300;  // drastically change these later
const MAX_LOCK_FRAMES = 1200;
// blink
const BLINK_CLOSE_SPEED = 0.25; // per frame, 0.25 = 4 frames to close
const BLINK_OPEN_SPEED = 0.20;  // per frame, 0.20 = 5 frames to open


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
        pupilScale: 1.0,
        eyeOpen: 1.0,
        jitterStrength: 0.0,

        // blink
        blinkProgress: 0.0,
        blinkPhase: "idle",
    };
    hadFaceLastFrame = false;
    console.log("Behaviour initialized:", behaviourState);
}

// updates the eyeball's emotional state, choose target, not entirely sure yet
export function updateBehaviour(faces, emotionLabel) {
    const safeFaces = faces || [];
    const numFaces = safeFaces.length;

    // detect emotion change for blink
    const previousEmotion = behaviourState.emotion;
    const newEmotion = emotionLabel || "neutral";
    const emotionChanged = newEmotion !== previousEmotion;

    // keep behaviourState emotion synced up w detector
    behaviourState.emotion = newEmotion;

    updateBlinkState(behaviourState, emotionChanged);

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

            // apply emotion
            applyEmotionPreset(behaviourState);

            return behaviourState;
        }

        // basic idle mode
        behaviourState.mode = "idle";
        const updatedIdle = updateIdleBehaviour(behaviourState);
        applyEmotionPreset(updatedIdle);
        return updatedIdle;
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
    applyEmotionPreset(behaviourState);

    return behaviourState
}