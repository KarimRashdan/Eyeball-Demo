import * as THREE from "https://unpkg.com/three@0.181.2/build/three.module.js";

let scene, camera, renderer, eyeball;
let currentGazeX = 0;
let currentGazeY = 0;


// smoothed emotion parameters
let currentPupilScale = 1.0;
let currentEyeOpen = 1.0;
let currentJitterStrength = 0.0;
let jitterTime = 0; // twitchy ahh emotion

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('https://threejs.org/examples/textures/uv_grid_opengl.jpg');
    const material = new THREE.MeshStandardMaterial({ map: texture });

    eyeball = new THREE.Mesh(geometry, material);
    scene.add(eyeball);

    // lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 5, 5).normalize();
    scene.add(light);

    // handle window resize
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

export function updateRendering(deltaTime, behaviourState) {
    // safety check if something is not initialized
    if (!renderer || !scene || !camera || !eyeball) return;

    // more safety, just render without changing rotation
    if (!behaviourState || !behaviourState.targetCoords) {
        renderer.render(scene, camera);
        return;
    }

    const { x, y } = behaviourState.targetCoords;

    // https://lisyarus.github.io/blog/posts/exponential-smoothing.html
    // convert deltaTime from ms to seconds
    const deltaSeconds = deltaTime / 1000;

    // how quickly the eye catches up to the target (per second)
    const SMOOTHING_SPEED = 10.0;

    // smoothing factor
    const alpha = 1 - Math.exp(-SMOOTHING_SPEED * deltaSeconds);

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
    const MAX_YAW = 0.5;
    const MAX_PITCH = 0.5;

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

    // apply gaze rotation w/ jitter
    eyeball.rotation.y = yaw;   // yaw (left/right)
    eyeball.rotation.x = pitch; // pitch (up/down)

    // fake, placeholder behaviour until you get the actual model
    const BASE_SCALE = 1.0;

    const safePupil = clamp(currentPupilScale, 0.7, 1.5);
    const safeEyeOpen = clamp(currentEyeOpen, 0.7, 1.4); 

    const scaleX = BASE_SCALE * safePupil;
    const scaleY = BASE_SCALE * safePupil * safeEyeOpen;
    const scaleZ = BASE_SCALE * safePupil;
    eyeball.scale.set(scaleX, scaleY, scaleZ);

    renderer.render(scene, camera);
}