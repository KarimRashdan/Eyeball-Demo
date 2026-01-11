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

        // create a fake second face for multi-target testing, just my face but shifted to the right
        /*
        let processedFaces = faces || [];
        if (processedFaces.length === 1) {
            const f = processedFaces[0];
            const fakeFace = { 
                ...f, 
                x: Math.min(1, f.x + f.width * 1.5),
             };
        processedFaces = [f, fakeFace];
        }

        currentFaces = processedFaces;
        */

        // get faces for current frame
        currentFaces = faces || [];
        // console.log("Detected faces: ", currentFaces);

    }
    requestAnimationFrame(processFrame);
}

// responsible for returning the target
export function getTargets() {
    // returns an array of face targets, each target is a bounding box
    // [{ x, y, width, height }]
    if (hasWebcamError()) return [];
    return currentFaces;
}