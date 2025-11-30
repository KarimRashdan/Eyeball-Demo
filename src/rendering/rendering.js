import * as THREE from "https://unpkg.com/three@0.181.2/build/three.module.js";

let scene, camera, renderer, eyeball;

// https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js
export function initRendering(canvas) {

    // create renderer and attach it to canvas
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
}