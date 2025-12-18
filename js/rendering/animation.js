import * as THREE from "https://unpkg.com/three@0.181.2/build/three.module.js";
import { baseTransition } from "./base.js";
import { happyTransition } from "./happy.js";

const DEFAULT_DURATION_MS = 4000;

const EDGE_MARGIN = 0.1;

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

    outgoingBaseScale: null,
    incomingBaseScale: null,
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

export function isTransitionActive() {
    return !!state.active;
}

export function getTransitionRoots() {
    return { outgoingRoot: state.outgoingRoot, incomingRoot: state.incomingRoot };
}

export function pickTransitionForToKey(toKey) {
    if (toKey === "happy") return happyTransition;
    return baseTransition;
}

export function beginTransition({
    scene,
    camera,
    fromKey,
    toKey,
    outgoingRoot,
    loadModelRoot,
    durationMs,
    baseYaw,
    basePitch,
    transition,
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

    state.outgoingBaseScale = outgoingRoot.scale.clone();
    state.incomingBaseScale = null;

    state.transition = transition || pickTransitionForToKey(toKey);

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

        incoming.visible = false;
        incoming.position.set(state.enterX, state.outgoingStartPos.y, state.outgoingStartPos.z);

        incoming.scale.copy(state.outgoingBaseScale);
        incoming.rotation.copy(outgoingRoot.rotation);

        state.incomingBaseScale = incoming.scale.clone();

        state.incomingRoot = incoming;
        state.scene.add(incoming);

        state.transition.onBegin?.(state);
    })
    .catch((err) => {
        console.error("Error loading model for slide transition:", err);
        state.active = false;
    });

    state.transition.onBegin?.(state);
}

export function updateTransition(nowMs) {
    if (!state.active) {
        return { done: false, outgoingPose: null, incomingPose: null, lockIncomingRotX: false };
    }

    const t = clamp01((nowMs - state.startTime) / state.durationMs);

    const res = state.transition.update(state, t) || {
        outgoingPose: null,
        incomingPose: null,
        lockIncomingRotX: false,
    };

    return {
        done: t >= 1,
        outgoingPose: res.outgoingPose ?? null,
        incomingPose: res.incomingPose ?? null,
        lockIncomingRotX: !!res.lockIncomingRotX,
    };
}

export function completeTransition() {
    if (!state.active) return null;

    const incoming = state.incomingRoot;
    const outgoing = state.outgoingRoot;

    if (!incoming) {
        state.active = false;
        return null;
    }

    if (state.scene && outgoing) state.scene.remove(outgoing);

    if (state.outgoingStartPos) incoming.position.x = state.outgoingStartPos.x;
    

    const result = { root: incoming, toKey: state.toKey };

    state = {
        active: false,
        startTime: 0,
        durationMs: DEFAULT_DURATION_MS,
        transition: baseTransition,
        fromKey: null,
        toKey: null,
        scene: null,
        camera: null,
        loadModelRoot: null,
        outgoingRoot: null,
        incomingRoot: null,
        outgoingStartPos: null,

        baseYaw: 0,
        basePitch: 0,

        enterX: 3,
        exitX: -3,

        incomingShown: false,
        outgoingBaseScale: null,
        incomingBaseScale: null,
    };

    return result;
}