let root = null;

// initializes the UI components
export function initUI(rootElement) {
    root = rootElement;
    if (root) {
        root.style.whiteSpace = "pre";
        root.textContent = "UI initialized";
    }
}

// updates the UI based on the behaviour state
export function updateUI(behaviourState) {
    const root = document.getElementById("ui-root");
    if (!root) return;

    if (!behaviourState) {
        root.textContent = "No behaviour state available";
        return;
    }

    const { mode, numFaces, targetCoords, emotion } = behaviourState;

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed
    const tx = behaviourState.targetCoords.x.toFixed(2);
    const ty = behaviourState.targetCoords.y.toFixed(2);

    // Delete later
    root.textContent =
        `mode=${mode}\n` +
        `numFaces=${numFaces}\n` +
        `target=(${tx}, ${ty})\n` +
        `emotion=${emotion}`;
}