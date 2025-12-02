let behaviourState = {
    mode: "idle",                 // idle or tracking
    targetCoords: { x: 0, y: 0 }, // coordinates the eyeball wants to look at
    numFaces: 0,                  // number of faces detected in current frame
    emotion: "neutral",           // placeholder for emotional state
};

// responsible for initializing eyeball's behavioural state
export function initBehaviour() {
    behaviourState = {
        mode: "idle",
        targetCoords: { x: 0, y: 0 },
        numFaces: 0,
        emotion: "neutral",
    };
    console.log("Behaviour initialized:", behaviourState);
}

// updates the eyeball's emotional state, choose target, not entirely sure yet
export function updateBehaviour(faces) {
    const safeFaces = faces || [];
    const numFaces = safeFaces.length;

    if (numFaces === 0) {
        behaviourState.mode = "idle";
        behaviourState.numFaces = 0;
        behaviourState.targetCoords = { x: 0, y: 0 };
        return behaviourState;
    }

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

    behaviourState.mode = "tracking";
    behaviourState.numFaces = numFaces;
    behaviourState.targetCoords = { x: gazeX, y: gazeY };

    return behaviourState
}