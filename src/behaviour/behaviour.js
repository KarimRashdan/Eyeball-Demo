let behaviourState = {
    mode: "idle",                 // idle or tracking
    targetCoords: { x: 0, y: 0 }, // coordinates the eyeball wants to look at
    numFaces: 0,                  // number of faces detected in current frame
    emotion: "neutral",           // placeholder for emotional state
};

// responsible for initializing eyeball's behavioural state
export function initBehaviour() {
    behaviourState.mode = "idle";
    behaviourState.targetCoords = { x: 0, y: 0 };
    behaviourState.numFaces = 0;
    behaviourState.emotion = "neutral";

    console.log("Behaviour initialized:", behaviourState);
}

// updates the eyeball's emotional state, choose target, not entirely sure yet
export function updateBehaviour() {
    if (!faces) faces = [];
    // update number of faces detected
    behaviourState.numFaces = faces.length;

    // logic for no faces detected
    if (faces.length === 0) {
        behaviourState.mode = "idle";
        behaviourState.targetCoords = { x: 0, y: 0 };
        return behaviourState;
    }

    // logic for faces detected
    behaviourState.mode = "tracking";

    // choose first face as target (update later)
    const primaryFace = faces[0];
}