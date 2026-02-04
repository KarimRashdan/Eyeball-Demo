let settingsButtonElement = null;
let settingsOverlayElement = null;

let currentSettings = {
    mode: "mode1",
    model: "modelA",
};

let draftSettings = { ...currentSettings };

export function getCurrentSettings() {
    return { ...currentSettings };
}

function openSettings() {
    if (!settingsOverlayElement) return;
    settingsOverlayElement.style.display = "flex";
    syncSettingsUI();
}

function closeSettings() {
    if (!settingsOverlayElement) return;
    settingsOverlayElement.style.display = "none";
}

function syncSettingsUI() {
    if (!settingsOverlayElement) return;

    const modeInputs = settingsOverlayElement.querySelectorAll('input[name="setting-mode"]');
    modeInputs.forEach((el) => (el.checked = (el.value === draftSettings.mode)));

    const modelInputs = settingsOverlayElement.querySelectorAll('input[name="setting-model"]');
    modelInputs.forEach((el) => (el.checked = (el.value === draftSettings.model)));

    updateMode1Visibility();
}

function updateMode1Visibility() {
    if (!settingsOverlayElement) return;
    const mode1Block = settingsOverlayElement.querySelector("#setting-mode1-suboptions");
    if (!mode1Block) return;

    const isMode1 = (draftSettings.mode === "mode1");
    mode1Block.style.display = isMode1 ? "block" : "none";

    if (!isMode1) {
        const modelInputs = settingsOverlayElement.querySelectorAll('input[name="setting-model"]');
        modelInputs.forEach((el) => (el.checked = false));
    }
}

export function initSettingsUI() {
    settingsButtonElement = document.createElement("button");
    settingsButtonElement.id = "settings-button";
    settingsButtonElement.type = "button";
    settingsButtonElement.title = "Settings";
    settingsButtonElement.innerHTML = "⚙️";

    settingsButtonElement.addEventListener("click", () => {
        if (!settingsOverlayElement) return;
        const isOpen = settingsOverlayElement.style.display === "flex";
        if (isOpen) closeSettings();
        else openSettings();
    });

    document.body.appendChild(settingsButtonElement);
    settingsOverlayElement = document.createElement("div");
    settingsOverlayElement.id = "settings-overlay";

    const panel = document.createElement("div");
    panel.id = "settings-panel";
    panel.innerHTML = `
        <div class="settings-title">User Settings</div>
        <div class="settings-section">
            <h3>Mode selection</h3>
            <label class="settings-option">
                <input type="radio" name="setting-mode" value="mode1">
                <div>Mode 1 <span style="opacity:0.7">(manual model select)</span></div>
            </label>

            <div id="setting-mode1-suboptions" class="settings-suboptions">
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelA">
                    <div>Model A</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelB">
                    <div>Model B</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelC">
                    <div>Model C</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelD">
                    <div>Model D</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelE">
                    <div>Model E</div>
                </label>
            </div>

            <label class="settings-option">
                <input type="radio" name="setting-mode" value="mode2">
                <div>Mode 2</div>
            </label>

            <label class="settings-option">
                <input type="radio" name="setting-mode" value="mode3">
                <div>Mode 3</div>
            </label>
        </div>

        <div class="settings-section">
            <h3>Admin settings</h3>
            <div style="opacity:0.7; font-size:13px;">(coming soon!!!)</div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn" id="settings-cancel" type="button">Cancel</button>
            <button class="settings-btn settings-btn-primary" id="settings-apply" type="button">Apply</button>
        </div>
    `;

    settingsOverlayElement.appendChild(panel);
    document.body.appendChild(settingsOverlayElement);

    settingsOverlayElement.addEventListener("click", (e) => {
        if (e.target === settingsOverlayElement) closeSettings();
    });

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSettings();
    });

    settingsOverlayElement.querySelectorAll('input[name="setting-mode"]').forEach((el) => {
        el.addEventListener("change", () => {
            draftSettings.mode = el.value;

            if (draftSettings.mode !== "mode1") {
                draftSettings.model = null;
            }

            updateMode1Visibility();
            syncSettingsUI();
        });
    });

    settingsOverlayElement.querySelectorAll('input[name="setting-model"]').forEach((el) => {
        el.addEventListener("change", () => {
            draftSettings.model = el.value;
        });
    });

    const cancelBtn = settingsOverlayElement.querySelector("#settings-cancel");
    cancelBtn.addEventListener("click", () => {
        draftSettings = { ...currentSettings };
        console.log("[settings] applied:", currentSettings);
        closeSettings();
    });

    syncSettingsUI();
}