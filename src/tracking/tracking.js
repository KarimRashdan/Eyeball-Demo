import {
    FaceDetector,
    FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

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
    return navigator.mediaDevices
        // just set to True 
        .getUserMedia({ video: { facingMode: "user" } })
        .then((stream) => {
            webcamVideo.srcObject = stream;
        })
        .catch((err) => {
            console.error("Error accessing webcam: ", err);
            webcamError = true;
            throw err;
        });
}

async function setupFaceDetector() {
    try {
        console.log("Setting up face detector...");
        // https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/web_js
        const vision = await FilesetResolver.forVisionTasks(
            // path/to/wasm/root
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        faceDetector = await FaceDetector.createFromOptions(
        vision,
        {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
        },
        runningMode: "VIDEO",
        });

        console.log("Face detector setup complete");
        trackingInit = true;

    } catch (error) {
        console.error("Error setting up face detector: ", error);
        webcamError = true;
    }
}

function startTrackingLoop() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
    async function processFrame(time) {
        // process the current video frame
        requestAnimationFrame(processFrame);
        // safety checks
        if (webcamError) {
            return;
        }
        // safety
        if (!trackingInit || !faceDetector || !webcamVideo) {
            currentFaces = [];
            return;
        }
        // safety
        if (webcamVideo.readyState < 2) {
            currentFaces = [];
            return;
        }

        // run face detection on current frame
        const detectionResult = await faceDetector.detectForVideo(webcamVideo, time);
        //console.log("XXXXX: ", detectionResult);

        // return an empty array if no faces detected
        if (!detectionResult || !detectionResult.detections || detectionResult.detections.length === 0) {
            currentFaces = [];
            return;
        }
        
        // convert detections to coordinates (normalize later)
        // autcompleted by IntelliSense
        const faces = detectionResult.detections.map((detection) => {
            const box = detection.boundingBox;
            return {
                x: box.originX,
                y: box.originY,
                width: box.width,
                height: box.height,
            };
        });

        currentFaces = faces;
        console.log("Detected faces: ", currentFaces);

    }
    requestAnimationFrame(processFrame);
}

// responsible for initializing everything needed for the tracking (i.e. enabling webcam, setting up mediapipe, etc.)
export function initTracking() {
    setupVideoElement();

    if (webcamError) {
        return;
    }

    startWebcamStream()
        .then(() => setupFaceDetector())
        .then(() => {
            startTrackingLoop();
            console.log("Tracking started");
        })      
        .catch((err) => {
            console.error("Error initializing tracking: ", err);
            webcamError = true;
        });

    console.log("Tracking initialized");
}

// responsible for returning the target for the eyeball to track
export function getTargets() {
    // returns an array of face targets, each target is an object with x and y properties (normalized coordinates between 0 and 1)
    // [{ x, y, width, height }]
    if (webcamError) {
        return [];
    }

    return currentFaces;
}