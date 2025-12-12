let root = null;
let panelElement = null;
let debugElement = null;
let promptText = null;
let chosenEmotionLabel = null;

const EMOTIONS = ["neutral", "happy", "sad", "angry", "surprised"];

const EDGE_EMOTIONS = {
    top: "happy",
    bottom: "sad",
    left: "surprised",
    right: "angry",
};

const LABELS = {
    neutral: "Neutral 😊",
    happy: "Happy 😄",
    sad: "Sad 😢",
    angry: "Angry 😠",
    surprised: "Surprised 😲",
};

// ADJUST ------------------------
const INITIAL_NEUTRAL_MS = 3000;
const EMOTION_LOCK_MS = 5000;
const CHOICE_DELAY_MS = 1500;
const CHOSEN_LABEL_MS = 3000;
const NEUTRAL_ARM_MS = 300;
const PICK_HOLD_MS = 200;
const FACE_ACQUIRED_MS = 1500;

let choiceArmed = false;
let neutralSince = null;

let candidateEmotion = "neutral";
let candidateSince = null;

let hadFacePrev = false;

let chosenLabelStartTime = null;

// initial -> choice -> locked -> choice ...
let phase =  "initial";
let phaseStartTime = performance.now();
let lockedEmotion = "neutral";

// edge promptss
let promptTop = null;
let promptBottom = null;
let promptLeft = null;
let promptRight = null;

function createEdgePrompt(position) {
    const el = document.createElement("div");
    el.className = `emotion-edge-prompt emotion-edge-prompt-${position}`;
    el.textContent = "";
    document.body.appendChild(el);
    return el;
}

function setEdgePromptsVisible(visible) {
    const display = visible ? "flex" : "none";
    [promptTop, promptRight, promptBottom, promptLeft].forEach((el) => {
        if (el) el.style.display = display;
    });
}

function updateEdgePromptTexts() {
    if (!promptTop) return;

    const topLabel = LABELS[EDGE_EMOTIONS.top] ?? "Happy";
    const bottomLabel = LABELS[EDGE_EMOTIONS.bottom] ?? "Sad";
    const leftLabel = LABELS[EDGE_EMOTIONS.left] ?? "Surprised";
    const rightLabel = LABELS[EDGE_EMOTIONS.right] ?? "Angry";

    promptTop.textContent = `Try acting ${topLabel}!`;
    promptBottom.textContent = `Try acting ${bottomLabel}!`;
    promptLeft.textContent = `Try acting ${leftLabel}!`;
    promptRight.textContent = `Try acting ${rightLabel}!`;
}

function ensureChosenEmotionLabel() {
    if (chosenEmotionLabel) return;

    chosenEmotionLabel = document.createElement("div");
    chosenEmotionLabel.id = "chosen-emotion-label";
    chosenEmotionLabel.style.display = "none";
    document.body.appendChild(chosenEmotionLabel);
}

function setChosenEmotionLabel(emotion) {
    ensureChosenEmotionLabel();
    chosenEmotionLabel.textContent = emotion;
    chosenEmotionLabel.style.display = emotion ? "block" : "none";
}

/*
let currentEmotionForPrompt = null;
let emotionEnterTime = 0;
let hasPromptedForCurrentEmotion = false;

const EMOTION_PROMPT_DELAY_MS = 3000;

function pickAlternativeEmotion(current) {
    const remaining = EMOTIONS.filter((e) => e !== current);
    const choice = remaining[Math.floor(Math.random() * remaining.length)];
    return `Try acting ${LABELS[choice]}!`;
}*/

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

    // prompt (ui)
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
    debugElement = debugText;

    // the big four (Metallica, Anthrax, Megadeth, Slayer)
    promptTop = createEdgePrompt("top");
    promptBottom = createEdgePrompt("bottom");
    promptLeft = createEdgePrompt("left");
    promptRight = createEdgePrompt("right");

    updateEdgePromptTexts();
    setEdgePromptsVisible(false);

    phase = "initial";
    phaseStartTime = performance.now();
    lockedEmotion = "neutral";
}

// updates the UI based on the behaviour state
export function updateUI(behaviourState) {
    if (!root || !debugElement) return;

    if (!behaviourState) {
        debugElement.textContent = "No behaviour state yet";
        return;
    }

    const now = performance.now();
    ensureChosenEmotionLabel();

    const mode = behaviourState.mode ?? "unknown";
    const numFaces = behaviourState.numFaces ?? 0;
    const emotion = behaviourState.emotion ?? "unknown";
    const displayEmotion = behaviourState.emotion ?? "neutral";
    const rawEmotion = behaviourState.rawEmotion ?? displayEmotion;
    const pupilScale = behaviourState.pupilScale ?? 1;
    const eyeOpen = behaviourState.eyeOpen ?? 1;
    const jitterStrength = behaviourState.jitterStrength ?? 0;
    const target = behaviourState.targetCoords ?? { x: 0, y: 0 };

    const hasFace = numFaces > 0;
    if (hasFace && !hadFacePrev) {
        phase = "acquire";
        phaseStartTime = now;

        setEdgePromptsVisible(false);
        if (promptText) promptText.textContent = "";
        setChosenEmotionLabel("");
        chosenLabelStartTime = null;

        behaviourState.uiLocked = false;
        behaviourState.uiLockedEmotion = "neutral";
    }

    hadFacePrev = hasFace;

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

    // reset to initial neutral
    if (numFaces === 0) {
        promptText.textContent = "";
        setEdgePromptsVisible(false);
        phase = "initial";
        phaseStartTime = now;
        lockedEmotion = "neutral";

        behaviourState.uiLocked = false;
        behaviourState.uiLockedEmotion = "neutral";

        setChosenEmotionLabel("");
        chosenLabelStartTime = null;

        hadFacePrev = false;

        return;
    }

    if (phase === "acquire") {
        setEdgePromptsVisible(false);
        promptText.textContent = "";
        setChosenEmotionLabel("");

        behaviourState.uiLocked = false;
        behaviourState.uiLockedEmotion = "neutral";

        if (now - phaseStartTime >= FACE_ACQUIRED_MS) {
            phase = "initial";
            phaseStartTime = now;
        }
        return;
    }

    // phase initial neutral
    if (phase === "initial") {
        window.choicePhaseStart = null;
        lockedEmotion = "neutral";
        setEdgePromptsVisible(false);
        promptText.textContent = "Staying neutral for a moment...";

        setChosenEmotionLabel("");
        chosenLabelStartTime = null;

        behaviourState.uiLocked = true;
        behaviourState.uiLockedEmotion = "neutral";

        if (now - phaseStartTime >= INITIAL_NEUTRAL_MS) {
            phase = "choice";
            phaseStartTime = now;

            choiceArmed = false;
            neutralSince = null;
            candidateEmotion = "neutral";
            candidateSince = null;
        }
    return;
    }

    // user choosing next emotion
    if (phase === "choice") {
        updateEdgePromptTexts();

        setChosenEmotionLabel("");
        chosenLabelStartTime = null;

        if (!window.choicePhaseStart) {
            window.choicePhaseStart = now;
        }

        const choiceDelayPassed = now - window.choicePhaseStart >= CHOICE_DELAY_MS;

        if (!choiceDelayPassed) {
            setEdgePromptsVisible(false);
            promptText.textContent = "Get ready...";
            behaviourState.uiLocked = false;
            behaviourState.uiLockedEmotion = "neutral";
            return;
        }

        promptText.textContent = "Pick an emotion from around the screen!";
        setEdgePromptsVisible(true);

        if (displayEmotion === EDGE_EMOTIONS.top && promptTop) promptTop.style.display = "none";
        if (displayEmotion === EDGE_EMOTIONS.bottom && promptBottom) promptBottom.style.display = "none";
        if (displayEmotion === EDGE_EMOTIONS.left && promptLeft) promptLeft.style.display = "none";
        if (displayEmotion === EDGE_EMOTIONS.right && promptRight) promptRight.style.display = "none";

        // arm after they come back to neutral, maybe adjust
        if (!choiceArmed) {
            if (rawEmotion === "neutral") {
                if (neutralSince == null) neutralSince = now;

                if ((now - neutralSince) >= NEUTRAL_ARM_MS && choiceDelayPassed) {
                    choiceArmed = true;
                    candidateEmotion = "neutral";
                    candidateSince = null;
                }
            } else {
                neutralSince = null;
            }
            return;
        }

        if (rawEmotion !== candidateEmotion) {
            candidateEmotion = rawEmotion;
            candidateSince = now;
        }

        const isValidPick = candidateEmotion !== "neutral" && EMOTIONS.includes(candidateEmotion) && candidateEmotion !== lockedEmotion;
        const heldLongEnough = candidateSince != null && (now - candidateSince) >= PICK_HOLD_MS;
        const userPicked = isValidPick && heldLongEnough;

        if (userPicked) {
            setEdgePromptsVisible(false);
            lockedEmotion = candidateEmotion;
            setChosenEmotionLabel(lockedEmotion);
            chosenLabelStartTime = now;
            phase = "locked";
            phaseStartTime = now;
            window.choicePhaseStart = null;

            choiceArmed = false;
            neutralSince = null;
            candidateEmotion = "neutral";
            candidateSince = null;
        }

        behaviourState.uiLocked = false;
        behaviourState.uiLockedEmotion = "neutral";

        return;
    }

    // locked on chosen emotion for EMOTION_LOCK_MS
    if (phase === "locked") {
        setEdgePromptsVisible(false);

        if (chosenLabelStartTime != null && (now - chosenLabelStartTime) >= CHOSEN_LABEL_MS) {
            setChosenEmotionLabel("");
            chosenLabelStartTime = null;
        }

        window.choicePhaseStart = null;

        const pretty = LABELS[lockedEmotion] ?? lockedEmotion;
        promptText.textContent = `Locked on: ${pretty}`;

        behaviourState.uiLocked = true;
        behaviourState.uiLockedEmotion = lockedEmotion;

        if (now - phaseStartTime >= EMOTION_LOCK_MS) {
            phase = "choice";
            phaseStartTime = now;

            choiceArmed = false;
            neutralSince = null;
            candidateEmotion = "neutral";
            candidateSince = null;
        }
        return;
    }
}