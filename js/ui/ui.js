let root = null;
let panelElement = null;
let promptElement = null;
let debugElement = null;
let promptText = null;

const EMOTIONS = ["neutral", "happy", "sad", "angry", "surprised"];

let currentEmotionForPrompt = null;
let emotionEnterTime = 0;
let hasPromptedForCurrentEmotion = false;

const EMOTION_PROMPT_DELAY_MS = 3000;


const LABELS = {
    neutral: "Neutral 😊",
    happy: "Happy 😄",
    sad: "Sad 😢",
    angry: "Angry 😠",
    surprised: "Surprised 😲",
};

function pickAlternativeEmotion(current) {
    const remaining = EMOTIONS.filter((e) => e !== current);
    const choice = remaining[Math.floor(Math.random() * remaining.length)];
    return `Try acting ${LABELS[choice]}!`;
}

// initializes the UI components
export function initUI(rootElement) {
    root = rootElement;
    if (!root) return;

    // clear existing content
    root.textContent = "";
    root.style.whiteSpace = "normal";

    // panel
    const panel = document.createElement("div");
    panel.className = "ui-panel";

    // header
    const header = document.createElement("div");
    header.className = "ui-header";
    header.textContent = "Eyeball Debug";
    panel.appendChild(header);

    // prompt
    const promptSection = document.createElement("div");
    promptSection.className = "ui-section";

    const promptLabel = document.createElement("div");
    promptLabel.className = "ui-section-label";
    promptLabel.textContent = "Prompt:";
    promptSection.appendChild(promptLabel);

    promptText = document.createElement("div");
    promptText.id = "ui-prompts";
    promptText.textContent = "";
    promptSection.appendChild(promptText);

    panel.appendChild(promptSection);

    // debug
    const debugSection = document.createElement("div");
    debugSection.className = "ui-section";

    const debugLabel = document.createElement("div");
    debugLabel.className = "ui-section-label";
    debugLabel.textContent = "State";
    debugSection.appendChild(debugLabel);

    const debugText = document.createElement("pre");
    debugText.id = "ui-debug";
    debugText.textContent = "Waiting for behaviour state...";
    debugSection.appendChild(debugText);

    panel.appendChild(debugSection);

    // append panel to root
    root.appendChild(panel);

    panelElement = panel;
    promptElement = promptSection;
    debugElement = debugText;
}

// updates the UI based on the behaviour state
export function updateUI(behaviourState) {
    if (!root || !debugElement) return;

    if (!behaviourState) {
        debugElement.textContent = "No behaviour state yet";
        return;
    }

    const mode = behaviourState.mode ?? "unknown";
    const numFaces = behaviourState.numFaces ?? 0;
    const emotion = behaviourState.emotion ?? "unknown";
    const pupilScale = behaviourState.pupilScale ?? 1;
    const eyeOpen = behaviourState.eyeOpen ?? 1;
    const jitterStrength = behaviourState.jitterStrength ?? 0;
    const target = behaviourState.targetCoords ?? { x: 0, y: 0 };

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed
    const tx = Number.isFinite(target.x) ? target.x.toFixed(2) : "NaN";
    const ty = Number.isFinite(target.y) ? target.y.toFixed(2) : "NaN";

    // Delete later
    debugElement.textContent =
        `mode=${mode}\n` +
        `numFaces=${numFaces}\n` +
        `target=(${tx}, ${ty})\n` +
        `emotion=${emotion}\n` +
        `pupilScale=${pupilScale.toFixed(2)}\n` +
        `eyeOpen=${eyeOpen.toFixed(2)}\n` +
        `jitterStrength=${jitterStrength.toFixed(2)}`;

    if (!promptText) return;

    const now = performance.now();

    if (numFaces === 0) {
        promptText.textContent = "";
        currentEmotionForPrompt = null;
        hasPromptedForCurrentEmotion = false;
        return;
    }

    if (emotion !== currentEmotionForPrompt) {
        currentEmotionForPrompt = emotion;
        emotionEnterTime = now;
        hasPromptedForCurrentEmotion = false;
        return;
    }

    if (!hasPromptedForCurrentEmotion && now - emotionEnterTime >= EMOTION_PROMPT_DELAY_MS) {
        const suggestion = pickAlternativeEmotion(emotion);
        promptText.textContent = suggestion;
        hasPromptedForCurrentEmotion = true;
    }
}