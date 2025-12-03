import { setupVideoElement, startWebcam, getWebcamVideo, hasWebcamError } from "./video.js";
import { initFaceDetector, detectFaces } from "./detector.js";

let trackingInit = false;  // flag to check if tracking is initialized
let currentFaces = [];     // current detected faces

// responsible for initializing everything needed for the tracking (i.e. enabling webcam, setting up mediapipe, etc.)
export async function initTracking() {
    if (trackingInit) return;

    try {
        setupVideoElement();
        await startWebcam();
        await initFaceDetector();

        trackingInit = true;
        startTrackingLoop();

        console.log("Tracking initialized");
    } catch (err) {
        console.error("Error initializing tracking: ", err);
    }   
}

function startTrackingLoop() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
    async function processFrame(time) {
        requestAnimationFrame(processFrame);

        // if permission denied
        if (hasWebcamError()) {
            currentFaces = [];
            return;
        }

        const video = getWebcamVideo();
        if (!video || video.readyState < 2) {
            currentFaces = [];
            return;
        }

        const faces = await detectFaces(video, time);

        // get faces for current frame
        currentFaces = faces || [];
        // console.log("Detected faces: ", currentFaces);

    }
    requestAnimationFrame(processFrame);
}

// responsible for returning the target for the eyeball to track
export function getTargets() {
    // returns an array of face targets, each target is an object with x and y properties (normalized coordinates between 0 and 1)
    // [{ x, y, width, height }]
    if (hasWebcamError()) return [];
    return currentFaces;
}