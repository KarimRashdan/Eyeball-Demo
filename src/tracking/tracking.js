// code responsible for handline webcam, mediapipe, tracking state, finding faces

let webcamVideo = null;    // webcam video element
let faceDetector = null;   // Mediapipe face detector
let trackingInit = false;  // flag to check if tracking is initialized
let currentFaces = [];     // current detected faces
let webcamError = false;   // flag for webcam error (i.e. user denied access or webcam not available)

function setupVideoElement() {
    // https://www.youtube.com/watch?v=k4QebSqA8zU
    // get webcam video element or return nothng if not found
    webcamVideo = document.getElementById("webcamVideo");
    if (!webcamVideo) {
        console.error("Webcam video element not found");
        webcamError = true;
        return;
    }
}

function startWebcamStream() {
    // prompts for permission to use webcam
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    navigator.mediaDevices
        // just set to True 
        .getUserMedia({ video: { facingMode: "user" } })
        .then((stream) => {
            webcamVideo.srcObject = stream;
        })
        .catch((err) => {
            console.error("Error accessing webcam: ", err);
            webcamError = true;
        });
}

function setupFaceDetector() {

}

function startTrackingLoop() {

}

// responsible for initializing everything needed for the tracking (i.e. enabling webcam, setting up mediapipe, etc.)
export function initTracking() {
    setupVideoElement();
    startWebcamStream();
    console.log("Tracking initialized");
}

// responsible for returning the target for the eyeball to track
export function getTargets() {
    // returns an array of face targets, each target is an object with x and y properties (normalized coordinates between 0 and 1)
    // [{ x, y, width, height }]
    // if webcamError return []
    return [];
}