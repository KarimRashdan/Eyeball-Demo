import { updateIdleBehaviour } from "./idle.js";

const STICKY_SWITCH_FRAMES = 45;
const SWITCH_MARGIN = 0.10;
const CENTER_WEIGHT = 0.0;
const SIZE_WEIGHT = 1.0;

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
};

const EMOTION_PRESETS = {
    neutral:  { pupilScale: 1.0, eyeOpen: 1.0, jitterStrength: 0.0 },
    happy:    { pupilScale: 1.0, eyeOpen: 1.0, jitterStrength: 0.0 },
    sad:      { pupilScale: 1, eyeOpen: 1.0, jitterStrength: 0.0 },
    angry:    { pupilScale: 1, eyeOpen: 1.0, jitterStrength: 0.45 },
    surprised:{ pupilScale: 1, eyeOpen: 1.25, jitterStrength: 0.2 },
}

function applyEmotionPreset(state) {
    const label = state.emotion || "neutral";
    const preset = EMOTION_PRESETS[label] || EMOTION_PRESETS.neutral;

    state.pupilScale = preset.pupilScale;
    state.eyeOpen = preset.eyeOpen;
    state.jitterStrength = preset.jitterStrength;
}

function scoreFace(face) {
    const cx = face.x + face.width / 2;
    const cy = face.y + face.height / 2;

    const dx = cx - 0.5;
    const dy = cy - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const centerScore = 1 - Math.min(1, dist / 0.7);
    const area = face.width * face.height;
    const sizeScore = Math.min(1, area / 0.12);

    return CENTER_WEIGHT * centerScore + SIZE_WEIGHT * sizeScore;
}

function pickPrimaryIdx(faces) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < faces.length; i++) {
        const score = scoreFace(faces[i]);
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    }
    
    return { bestIdx, bestScore };

}

function pickSecondaryIdx(faces, primaryIdx) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < faces.length; i++) {
        if (i === primaryIdx) continue;
        const score = scoreFace(faces[i]);
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    }

    return bestIdx;

}

// pretty self explanatory really
let hadFaceLastFrame = false;
// when target disappears don't instantly wander, wait
const HOLD_GAZE_FRAMES = 30; // 30 = 0.5 seconds at 60 fps
const MAX_LOCK_FRAMES = 1200;

const LOST_FACE_GRACE_FRAMES = 80;

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

        uiLocked: true,
        uiLockedEmotion: "neutral",
        emotion: "neutral",

        primaryTargetIdx: -1,
        primaryScore: 0,
        switchCandidateIdx: -1,
        switchCandidateFrames: 0,
        glanceUntilMs: 0,
        glanceTargetIdx: -1,
        requestGlance: false,
    };
    hadFaceLastFrame = false;
    console.log("Behaviour initialized:", behaviourState);
}

// updates the eyeball's emotional state, choose target, not entirely sure yet
export function updateBehaviour(faces, emotionLabel, nowMs) {
    const safeFaces = faces || [];
    const numFaces = safeFaces.length;

    const previousEmotion = behaviourState.emotion;
    const rawEmotion = emotionLabel || "neutral";
    behaviourState.rawEmotion = rawEmotion;

    const uiLocked = (behaviourState.uiLocked ?? true);
    const uiLockedEmotion = (behaviourState.uiLockedEmotion ?? "neutral");

    if (uiLocked) {
        if (uiLockedEmotion !== previousEmotion) {
            behaviourState.emotion = uiLockedEmotion;
        }
    } else {
        if (rawEmotion !== "neutral" && rawEmotion !== previousEmotion) {
            behaviourState.emotion = rawEmotion;
        }
    }

    const hadFace = hadFaceLastFrame;
    hadFaceLastFrame = numFaces > 0;

    // if the face has just been lost this frame
    if (numFaces === 0) {
        behaviourState.noFaceFrames += 1;

        if (behaviourState.noFaceFrames === 1) {
            behaviourState.idleTarget = { ...behaviourState.targetCoords };
        }

        if (behaviourState.noFaceFrames <= LOST_FACE_GRACE_FRAMES) {
            behaviourState.mode = "tracking";
            behaviourState.numFaces = 1;
            behaviourState.targetCoords = behaviourState.idleTarget;
            applyEmotionPreset(behaviourState);
            return behaviourState;
        }

        behaviourState.mode = "Idle";
        behaviourState.numFaces = 0;
        behaviourState.currentTargetIdx = -1;
        behaviourState.lockFrames = 0;

        if (behaviourState.noFaceFrames <= LOST_FACE_GRACE_FRAMES + HOLD_GAZE_FRAMES) {
            behaviourState.targetCoords = behaviourState.idleTarget;
            applyEmotionPreset(behaviourState);
            return behaviourState;
        }

        // basic idle mode
        const updatedIdle = updateIdleBehaviour(behaviourState);
        applyEmotionPreset(updatedIdle);
        return updatedIdle;
    }

    // if faces are present
    behaviourState.mode = "tracking";
    behaviourState.numFaces = numFaces;
    behaviourState.noFaceFrames = 0; // reset no face counter

    const { bestIdx, bestScore } = pickPrimaryIdx(safeFaces);

    if (behaviourState.primaryTargetIdx < 0 || behaviourState.primaryTargetIdx >= numFaces) {
        behaviourState.primaryTargetIdx = bestIdx;
        behaviourState.primaryScore = bestScore;
        behaviourState.switchCandidateIdx = -1;
        behaviourState.switchCandidateFrames = 0;
    } else {
        const currentIdx = behaviourState.primaryTargetIdx;
        const currentScore = scoreFace(safeFaces[currentIdx]);

        if (bestIdx !== currentIdx && bestScore > currentScore + SWITCH_MARGIN) {
            if (behaviourState.switchCandidateIdx !== bestIdx) {
                behaviourState.switchCandidateIdx = bestIdx;
                behaviourState.switchCandidateFrames = 1;
            } else {
                behaviourState.switchCandidateFrames += 1;
            }

            if (behaviourState.switchCandidateFrames >= STICKY_SWITCH_FRAMES) {
                behaviourState.primaryTargetIdx = bestIdx;
                behaviourState.primaryScore = bestScore;
                behaviourState.switchCandidateIdx = -1;
                behaviourState.switchCandidateFrames = 0;
            }
        } else {
            behaviourState.switchCandidateIdx = -1;
            behaviourState.switchCandidateFrames = 0;
            behaviourState.primaryScore = currentScore;
        }
    }

    if (behaviourState.requestGlance && numFaces > 1) {
        const secondaryIdx = pickSecondaryIdx(safeFaces, behaviourState.primaryTargetIdx);
        if (secondaryIdx >= 0) {
            behaviourState.glanceTargetIdx = secondaryIdx;
            behaviourState.glanceUntilMs = nowMs + 1000;
        }
        behaviourState.requestGlance = false;
    }

    let lookIdx = behaviourState.primaryTargetIdx;

    if (behaviourState.glanceUntilMs > nowMs && 
        behaviourState.glanceTargetIdx >= 0 &&
        behaviourState.glanceTargetIdx < numFaces) {
        lookIdx = behaviourState.glanceTargetIdx;
    }

    const primaryFace = safeFaces[lookIdx];

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