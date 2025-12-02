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
    const root = document.getElementById("ui-root");
    if (!root) return;

    if (!behaviourState) {
        root.textContent = "No behaviour state available";
        return;
    }
}