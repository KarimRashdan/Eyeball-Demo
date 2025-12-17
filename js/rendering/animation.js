import * as THREE from "https://unpkg.com/three@0.181.2/build/three.module.js";

const DEFAULT_DURATION_MS = 4000;

const EDGE_MARGIN = 0.7;

const LOOK_RIGHT_YAW = +1.3;
const LOOK_LEFT_YAW = -1.3;

const SEG_TURN_RIGHT = 0.20;
const SEG_HOLD_RIGHT = 0.10;
const SEG_TURN_CENTER = 0.05;
const SEG_HOLD_CENTER = 0.15;
const SEG_EXIT_LEFT = 0.15;
const SEG_ENTER_RIGHT = 0.25;

let state = {
    active: false,
    startTime: 0,
    durationMs: DEFAULT_DURATION_MS,

    fromKey: null,
    toKey: null,

    scene: null,
    camera: null,
    loadModelRoot: null,

    outgoingRoot: null,
    incomingRoot: null,

    outgoingStartPos: null,

    enterX: 3.0,
    exitX: -3.0,

    baseYaw: 0,
    basePitch: 0,
    incomingShown: false,
};

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function clamp01(t) {
    return Math.max(0, Math.min(1, t));
}

function getApproxRadius(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    return 0.5 * size.length();
}

function computeOffScreenX(camera, atZ, radius) {
    const distance = Math.abs(camera.position.z - atZ);

    const halfFovRad = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const halfHeight = Math.tan(halfFovRad) * distance;

    const halfWidth = halfHeight * camera.aspect;

    const margin = EDGE_MARGIN;
    const off = halfWidth + radius + margin;

    return { enterX: +off, exitX: -off}
}

export function isSlideTransitionActive() {
    return !!state.active;
}

export function getSlideTransitionRoots() {
    return { outgoingRoot: state.outgoingRoot, incomingRoot: state.incomingRoot };
}

export function beginSlideTransition({
    scene,
    camera,
    fromKey,
    toKey,
    outgoingRoot,
    loadModelRoot,
    durationMs,
    baseYaw,
    basePitch,
}) {
    if (state.active) return;
    if (!scene || !camera || !outgoingRoot || !loadModelRoot) return;
    if (!toKey || fromKey === toKey) return;

    state.active = true;
    state.startTime = performance.now();
    state.durationMs = typeof durationMs === "number" ? durationMs : DEFAULT_DURATION_MS;

    state.scene = scene;
    state.camera = camera;
    state.loadModelRoot = loadModelRoot;

    state.fromKey = fromKey;
    state.toKey = toKey;

    state.outgoingRoot = outgoingRoot;
    state.incomingRoot = null;

    // cap start pos
    state.outgoingStartPos = outgoingRoot.position.clone();

    state.baseYaw = typeof baseYaw === "number" ? baseYaw : 0;
    state.basePitch = typeof basePitch === "number" ? basePitch : 0;
    state.incomingShown = false;

    const outRadius = getApproxRadius(outgoingRoot);
    const { enterX, exitX } = computeOffScreenX(camera, outgoingRoot.position.z, outRadius);
    state.enterX = enterX;
    state.exitX = exitX;

    // incoming laod
    loadModelRoot(toKey).then((root) => {
        if (!state.active || state.toKey !== toKey) return;
        const incoming = root.clone(true);

        const inRadius = getApproxRadius(incoming);
        const refined = computeOffScreenX(camera, state.outgoingStartPos.z, inRadius);
        state.enterX = refined.enterX;
        state.exitX = refined.exitX;

        incoming.position.set(state.enterX, state.outgoingStartPos.y, state.outgoingStartPos.z);
        incoming.scale.copy(outgoingRoot.scale);
        incoming.rotation.copy(outgoingRoot.rotation);

        incoming.visible = false;
        state.incomingShown = false;

        state.incomingRoot = incoming;
        state.scene.add(incoming);
    })
    .catch((err) => {
        console.error("Error loading model for slide transition:", err);
        state.active = false;
    });
}

export function updateSlideTransition(nowMs) {
    if (!state.active) {
        return { done: false, outgoingPose: null, incomingPose: null };
    }

    const t = clamp01((nowMs - state.startTime) / state.durationMs);

    const a0 = 0;
    const a1 = a0 + SEG_TURN_RIGHT;
    const a2 = a1 + SEG_HOLD_RIGHT;
    const a3 = a2 + SEG_TURN_CENTER;
    const a4 = a3 + SEG_HOLD_CENTER;
    const a5 = a4 + SEG_EXIT_LEFT;
    const a6 = a5 + SEG_ENTER_RIGHT;

    const norm = (start, end) => clamp01((t - start) / Math.max((end - start), 0.0001));

    let outgoingYaw = state.baseYaw;
    let outgoingPitch = state.basePitch;

    if (t < a1) {
        const u = norm(a0, a1);
        outgoingYaw = lerp(state.baseYaw, state.baseYaw + LOOK_RIGHT_YAW, u);
    } else if (t < a2) {
        outgoingYaw = state.baseYaw + LOOK_RIGHT_YAW;
    } else if (t < a3) {
        const u = norm(a2, a3);
        outgoingYaw = lerp(state.baseYaw + LOOK_RIGHT_YAW, state.baseYaw, u);
    } else if (t < a4) {
        outgoingYaw = state.baseYaw;
    } else if (t < a5) {
        const u = norm(a4, a5);
        outgoingYaw = lerp(state.baseYaw, state.baseYaw + LOOK_LEFT_YAW, u);
    } else {
        outgoingYaw = state.baseYaw + LOOK_LEFT_YAW;
    }

    if (state.outgoingRoot && state.outgoingStartPos) {
        if (t < a4) {
            state.outgoingRoot.position.x = state.outgoingStartPos.x;
        } else if (t < a5) {
            const u = norm(a4, a5);
            state.outgoingRoot.position.x = lerp(state.outgoingStartPos.x, state.exitX, u);
        } else {
            state.outgoingRoot.position.x = state.exitX;
        }
    }

    let incomingYaw = null;
    let incomingPitch = null;

    if (state.incomingRoot && state.outgoingStartPos) {
        if (t >= a5) {
            if (!state.incomingShown) {
                state.incomingRoot.visible = true;
                state.incomingShown = true
                state.incomingRoot.position.x = state.enterX;
            }

            const u = norm(a5, a6);

            state.incomingRoot.position.x = lerp(state.enterX, state.outgoingStartPos.x, u);

            const blendStart = 0.85;
            if (u < blendStart) {
                incomingYaw = state.baseYaw + LOOK_LEFT_YAW;
            } else {
                const v = (u - blendStart) / (1 - blendStart);
                incomingYaw = lerp(state.baseYaw + LOOK_LEFT_YAW, state.baseYaw, clamp01(v));
            }

            incomingPitch = state.basePitch;

        }
    }

    const done = t >= 1;

    return { 
        done,
        outgoingPose: state.outgoingRoot ? { yaw: outgoingYaw, pitch: outgoingPitch } : null,
        incomingPose: state.incomingRoot && incomingYaw !== null ? { yaw: incomingYaw, pitch: incomingPitch } : null,
    };
}

export function completeSlideTransition() {
    if (!state.active) return null;

    const incoming = state.incomingRoot;
    const outgoing = state.outgoingRoot;

    if (!incoming) {
        state.active = false;
        return null;
    }

    if (state.scene && outgoing) {
        state.scene.remove(outgoing);
    }

    if (state.outgoingStartPos) {
        incoming.position.x = state.outgoingStartPos.x;
    }

    const result = { root: incoming, toKey: state.toKey };

    state = {
        active: false,
        startTime: 0,
        durationMs: DEFAULT_DURATION_MS,
        fromKey: null,
        toKey: null,
        scene: null,
        loadModelRoot: null,
        outgoingRoot: null,
        incomingRoot: null,
        outgoingStartPos: null,
    };

    return result;
}