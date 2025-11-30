let root = null;

// initializes the UI components
export function initUI(rootElement) {
    root = rootElement;
    if (root) {
        root.textContent = "UI initialized";
    }
}

// updates the UI based on the behaviour state
export function updateUI(behaviourState) {
    // prompts e.g. make angry face
}