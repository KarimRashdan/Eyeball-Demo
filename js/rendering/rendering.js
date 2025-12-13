import * as THREE from "https://unpkg.com/three@0.181.2/build/three.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let scene, camera, renderer;
// root node of glTF eyeball model
let eyeballRoot = null;

// active eye rig
let currentEyeRig = null;

const MODEL_PATHS = {
    neutral: "assets/default/scene.gltf",
    happy: "assets/rubber_duck/scene.gltf",
    sad: "assets/despair/scene.gltf",
    surprised: "assets/bill_cipher/scene.gltf",
    angry: "assets/angry/scene.gltf",
};

const gltfLoader = new GLTFLoader();
const modelCache = new Map();

let activeModelKey = "neutral";
let isSwappingModel = false;

function loadModelRoot(modelKey) {
    if (modelCache.has(modelKey)) return Promise.resolve(modelCache.get(modelKey));

    const path = MODEL_PATHS[modelKey];
    if (!path) return Promise.reject(new Error(`Model path not found for key: ${modelKey}`));

    return new Promise((resolve, reject) => {
        gltfLoader.load(path, (gltf) => {
            const root = gltf.scene;
            modelCache.set(modelKey, root);
            resolve(root);
            },
            undefined,
            reject
        );
    }); 
}

// default config per model
const DEFAULT_EYE_CONFIG = {
    // gaze limits
    maxYaw: 0.14,
    maxPitch: 0.14,

    // pupil scale limits
    minPupilScale: 0.7,
    maxPupilScale: 1.5,

    // "eye open" limits
    minEyeOpen: 0.7,
    maxEyeOpen: 1.4,

    // base model scale
    baseScale: 1.0,

    smoothingSpeed: 10.0,
};

let currentGazeX = 0;
let currentGazeY = 0;

// smoothed emotion parameters
let currentPupilScale = 1.0;
let currentEyeOpen = 1.0;
let currentJitterStrength = 0.0;
let jitterTime = 0; // twitchy ahh emotion

// eyeball transform defaults
const EYE_START_POS = new THREE.Vector3(0, 0, 0);         // x y z
const EYE_START_SCALE = new THREE.Vector3(1.0, 1.0, 1.0); // uniform scale
const EYE_START_ROT = new THREE.Euler(0, 0, 0);           // radians

const MODEL_TRANSITION_MS = 2000;
const MODEL_SWAP_AT = 0.9;

let modelTransition = {
    active: false,
    fromKey: "default",
    toKey: "default",
    startTime: 0,
    swapped: false,
    baseRot: null,
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function startModelTransition(toKey) {
    if (!scene) return;
    if (modelTransition.active) return;
    if (toKey === activeModelKey) return;

    modelTransition.active = true;
    modelTransition.fromKey = activeModelKey;
    modelTransition.toKey = toKey;
    modelTransition.startTime = performance.now();
    modelTransition.swapped = false;

    const r = currentEyeRig?.root?.rotation;
    modelTransition.baseRot = r ? r.clone() : new THREE.Euler(0, 0, 0);
}

// https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js
export function initRendering(canvas) {

    // create renderer and attach it to canvas
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // create camera
    camera = new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        1000
    );
    camera.position.z = 5;

    // placeholder lousy eyeball
    // https://threejs.org/docs/
    /* --------------------------------------------------------------
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('https://threejs.org/examples/textures/uv_grid_opengl.jpg');
    const material = new THREE.MeshStandardMaterial({ map: texture });

    eyeball = new THREE.Mesh(geometry, material);
    scene.add(eyeball);
    -------------------------------------------------------------- */

    // lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 0, 5).normalize();
    scene.add(light);

    // first eyeball model
    // https://threejs.org/docs/#GLTFLoader, https://discoverthreejs.com/book/first-steps/load-models/#:~:text=To%20load%20glTF%20files%2C%20first,this%20file%20in%20the%20editor.
    /*
    const gltfLoader = new GLTFLoader();
    gltfLoader.load("assets/blue_eyeball_free/scene.gltf", (gltf) => {
        // root of eyeball
        eyeballRoot = gltf.scene;

        // build inital rig for this model
        currentEyeRig = {
            root: eyeballRoot,

            // update
            pupilMesh: null,
            irisMesh: null,
            scleraMesh: null,

            config: { ...DEFAULT_EYE_CONFIG },
        }

        // positioning
        eyeballRoot.position.copy(EYE_START_POS);
        eyeballRoot.scale.copy(EYE_START_SCALE);
        eyeballRoot.rotation.copy(EYE_START_ROT);

        scene.add(eyeballRoot);

        console.log("Base eyeball loaded:", eyeballRoot);
    },
    undefined,
    (error) => {
        console.error("Error loading base eyeball model:", error);
    });
    */

    loadModelRoot("neutral").then((root) => {
        eyeballRoot = root.clone(true);

        currentEyeRig = {
            root: eyeballRoot,
            pupilMesh: null,
            irisMesh: null,
            scleraMesh: null,
            config: { ...DEFAULT_EYE_CONFIG },
        };

        eyeballRoot.position.copy(EYE_START_POS);
        eyeballRoot.scale.copy(EYE_START_SCALE);
        eyeballRoot.rotation.copy(EYE_START_ROT);

        scene.add(eyeballRoot);
        activeModelKey = "neutral";

        console.log("Base eyeball loaded:", eyeballRoot);
    }).catch((error) => {
        console.error("Error loading base eyeball model:", error);
    });

    // handle window resize
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

async function swapEyeModel(modelKey) {
    if (!scene) return;
    if (isSwappingModel) return;
    if (modelKey === activeModelKey) return;

    isSwappingModel = true;

    try {
        const oldRoot = currentEyeRig?.root;
        const oldPos = oldRoot ? oldRoot.position.clone() : EYE_START_POS.clone();
        const oldScale = oldRoot ? oldRoot.scale.clone() : EYE_START_SCALE.clone();
        const oldRot = oldRoot ? oldRoot.rotation.clone() : EYE_START_ROT.clone();

        if (oldRoot) scene.remove(oldRoot);

        const base = await loadModelRoot(modelKey);
        const newRoot = base.clone(true);

        newRoot.position.copy(oldPos);
        newRoot.scale.copy(oldScale);
        newRoot.rotation.copy(oldRot);

        eyeballRoot = newRoot;
        currentEyeRig = {
            root: newRoot,
            pupilMesh: null,
            irisMesh: null,
            scleraMesh: null,
            config: { ...DEFAULT_EYE_CONFIG },
        };
        scene.add(newRoot);
        activeModelKey = modelKey;
    } catch (e) {
        console.error("Error swapping eye model:", e);
    } finally {
        isSwappingModel = false;
    }
}

function applyEyeScale(rig, baseScale, safePupil, safeEyeOpen) {
    if (!rig || !rig.root) return;
    const root = rig.root;

    const pupilFactor = safePupil;

    const eyeOpenInfluence = 0.4; // how much eye open affects vertical scale
    const eyeOpenFactor = 1 + (safeEyeOpen - 1) * eyeOpenInfluence;

    const scaleX = baseScale * pupilFactor;
    const scaleY = baseScale * pupilFactor * eyeOpenFactor;
    const scaleZ = baseScale * pupilFactor;

    root.scale.set(scaleX, scaleY, scaleZ);
}

export function updateRendering(deltaTime, behaviourState) {
    // safety check if something is not initialized
    if (!renderer || !scene || !camera) return;

    // eyeball not loaded yet
    if (!currentEyeRig || !currentEyeRig.root) {
        renderer.render(scene, camera);
        return;
    }
    // more safety, just render without changing rotation
    if (!behaviourState || !behaviourState.targetCoords) {
        renderer.render(scene, camera);
        return;
    }

    const desiredModelKey = MODEL_PATHS[behaviourState.emotion] ? behaviourState.emotion : "neutral";
    if (!modelTransition.active && desiredModelKey !== activeModelKey) {
        startModelTransition(desiredModelKey);
    }

    const eyeball = currentEyeRig.root;
    const config = currentEyeRig.config || DEFAULT_EYE_CONFIG; 

    const { x, y } = behaviourState.targetCoords;

    // https://lisyarus.github.io/blog/posts/exponential-smoothing.html
    // convert deltaTime from ms to seconds
    const deltaSeconds = deltaTime / 1000;

    // how quickly the eye catches up to the target (per second)
    const smoothingSpeed = config.smoothingSpeed ?? 10.0;

    // smoothing factor
    const alpha = 1 - Math.exp(-smoothingSpeed * deltaSeconds);

    // guard for weird deltaSeconds (first frame debug)
    // FIX CENTERING ISSUE...
    const lerpAmount = isNaN(alpha) ? 1.0 : alpha;

    const targetPupilScale = behaviourState.pupilScale ?? 1.0;
    const targetEyeOpen = behaviourState.eyeOpen ?? 1.0;
    const targetJitterStrength = behaviourState.jitterStrength ?? 0.0;

    currentPupilScale += (targetPupilScale - currentPupilScale) * lerpAmount;
    currentEyeOpen += (targetEyeOpen - currentEyeOpen) * lerpAmount;
    currentJitterStrength += (targetJitterStrength - currentJitterStrength) * lerpAmount;

    // advance time for jitter
    jitterTime += deltaSeconds;

    // make rendered gaze match ideal target (update)
    currentGazeX += (x - currentGazeX) * lerpAmount;
    currentGazeY += (y - currentGazeY) * lerpAmount;

    // how far the eye is allowed to rotate (adjust later)
    const MAX_YAW = config.maxYaw;
    const MAX_PITCH = config.maxPitch;

    // twitch bsed on emotion
    let jitterYaw = 0;
    let jitterPitch = 0;

    if (currentJitterStrength > 0.001) {
        const JITTER_BASE = 0.03; // max jitter angle
        const JITTER_SPEED_YAW = 35 ;   // speed of yaw jitter
        const JITTER_SPEED_PITCH = 30;  // speed of pitch jitter

        jitterYaw = Math.sin(jitterTime * JITTER_SPEED_YAW) * JITTER_BASE * currentJitterStrength;
        jitterPitch = Math.cos(jitterTime * JITTER_SPEED_PITCH) * JITTER_BASE * currentJitterStrength;
    }

    const yaw = -currentGazeX * MAX_YAW + jitterYaw;
    const pitch = -currentGazeY * MAX_PITCH + jitterPitch;

    // so jitter doesn't exceed limits
    const clampedYaw = clamp(yaw, -MAX_YAW, MAX_YAW);
    const clampedPitch = clamp(pitch, -MAX_PITCH, MAX_PITCH);

    if (modelTransition.active && currentEyeRig?.root) {
        const now2 = performance.now();
        const t = Math.min(1, (now2 - modelTransition.startTime) / MODEL_TRANSITION_MS);

        const spin = t * Math.PI * 3; // 2 full spins

        eyeballRoot.rotation.x = clampedPitch;
        eyeballRoot.rotation.y = modelTransition.baseRot.y + spin;

        if (!modelTransition.swapped && t >= MODEL_SWAP_AT) {
            modelTransition.swapped = true;
            swapEyeModel(modelTransition.toKey);
        }

        if (t >= 1) {
            modelTransition.active = false;

            if (modelTransition.baseRot) {
                eyeballRoot.rotation.copy(modelTransition.baseRot);
            }
        }
    } else {
        // apply rotation
        eyeballRoot.rotation.x = clampedPitch;
        eyeballRoot.rotation.y = clampedYaw;
    }

    // fake, placeholder behaviour until you get the actual model
    const BASE_SCALE = config.baseScale ?? 1.0;

    const safePupil = clamp(currentPupilScale, config.minPupilScale, config.maxPupilScale);
    const safeEyeOpen = clamp(currentEyeOpen, config.minEyeOpen, config.maxEyeOpen); 
    /*
    const scaleX = BASE_SCALE * safePupil;
    const scaleY = BASE_SCALE * safePupil * safeEyeOpen;
    const scaleZ = BASE_SCALE * safePupil;
    eyeball.scale.set(scaleX, scaleY, scaleZ);
    */

    // applyPupilScale(currentEyeRig, BASE_SCALE, safePupil);
    applyEyeScale(currentEyeRig, BASE_SCALE, safePupil, safeEyeOpen);

    /*
    const blinkOverlay = document.getElementById("blink-overlay");
    if (blinkOverlay && behaviourState && typeof behaviourState.blinkProgress === "number") {
        const raw = clamp(behaviourState.blinkProgress, 0.0, 1.0);

        // smooth
        const t = raw * raw * (3 - 2 * raw); // smoothstep

        // scale(0) = fully open, scale(1) = fully closed
        blinkOverlay.style.transform = `scaleY(${t})`;

        // opacity ramps w curve
        blinkOverlay.style.opacity = (0.9 * t).toFixed(3); // max opacity 0.8
    }
        */

    renderer.render(scene, camera);
}   