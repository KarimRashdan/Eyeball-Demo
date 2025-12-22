import * as THREE from "https://unpkg.com/three@0.181.2/build/three.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beginTransition, updateTransition, completeTransition, isTransitionActive, getTransitionRoots, pickTransitionForToKey } from "./animation.js";

let scene, camera, renderer;
// root node of glTF eyeball model
let eyeballRoot = null;

// active eye rig
let currentEyeRig = null;

const MODEL_PATHS = {
    neutral: "assets/default/scene.gltf",
    happy: "assets/rubber_duck/scene.gltf",
    sad: "assets/illusion_eyeball/scene.gltf",
    surprised: "assets/bill_cipher/scene.gltf",
    angry: "assets/angry/scene.gltf",
};

const gltfLoader = new GLTFLoader();
const modelCache = new Map();

let activeModelKey = "neutral";

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

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js
export function initRendering(canvas) {

    // create renderer and attach it to canvas
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1.0);
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

    if (!isTransitionActive() && desiredModelKey !== activeModelKey) {
        const transition = pickTransitionForToKey(desiredModelKey);
        beginTransition({
            scene,
            camera,
            fromKey: activeModelKey,
            toKey: desiredModelKey,
            outgoingRoot: currentEyeRig.root,
            loadModelRoot,
            baseYaw: clampedYaw,
            basePitch: clampedPitch,
            transition,
        });
    }

    if (isTransitionActive()) {
        const res = updateTransition(performance.now());
        const { outgoingRoot, incomingRoot } = getTransitionRoots();

        if (outgoingRoot && res.outgoingPose) {
            outgoingRoot.rotation.y = res.outgoingPose.yaw;
            outgoingRoot.rotation.x = res.outgoingPose.pitch;
        }

        if (incomingRoot && res.incomingPose) {
            incomingRoot.rotation.y = res.incomingPose.yaw;

            if (!res.lockIncomingRotX) {
                incomingRoot.rotation.x = res.incomingPose.pitch;
            }
        }

        if (res.done) {
            const result = completeTransition();
            if (result?.root) {
                eyeballRoot = result.root;
                currentEyeRig = {
                    root: result.root,
                    pupilMesh: null,
                    irisMesh: null,
                    scleraMesh: null,
                    config: { ...DEFAULT_EYE_CONFIG },
                };
                activeModelKey = result.toKey;
            }
        }
    } else {
        eyeball.rotation.y = clampedYaw;
        eyeball.rotation.x = clampedPitch;
    }

    // fake, placeholder behaviour until you get the actual model
    const BASE_SCALE = config.baseScale ?? 1.0;

    const safePupil = clamp(currentPupilScale, config.minPupilScale, config.maxPupilScale);
    const safeEyeOpen = clamp(currentEyeOpen, config.minEyeOpen, config.maxEyeOpen); 

    if (!isTransitionActive()) {
        applyEyeScale(currentEyeRig, BASE_SCALE, safePupil, safeEyeOpen);
    }

    renderer.render(scene, camera);
}   