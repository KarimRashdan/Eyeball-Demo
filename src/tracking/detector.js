import {
    FaceDetector,
    FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let faceDetector = null;   // Mediapipe face detector

export async function initFaceDetector() {
    console.log("Setting up face detector...");
    // https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/web_js
    const vision = await FilesetResolver.forVisionTasks(
        // path/to/wasm/root
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    faceDetector = await FaceDetector.createFromOptions( vision, {
    baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        delegate: "GPU",
    },
    runningMode: "VIDEO",
    });

    console.log("Face detector setup complete");

}

// run face detection on current frame
export async function detectFaces(videoElement, time) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
    if (!faceDetector || !videoElement) return [];

    // run face detection on current frame
    const detectionResult = faceDetector.detectForVideo(webcamVideo, time);
    //console.log("XXXXX: ", detectionResult);

    // return an empty array if no faces detected
    if (!detectionResult || !detectionResult.detections || detectionResult.detections.length === 0) {
        return [];
    }

    const videoWidth = webcamVideo.videoWidth;
    const videoHeight = webcamVideo.videoHeight;

    if (!videoWidth || !videoHeight) {
        return [];
    }
    
    // convert detections to coordinates (normalized)
    // autcompleted by IntelliSense
    const faces = detectionResult.detections.map((detection) => {
        const box = detection.boundingBox;
        return {
            x: box.originX / videoWidth,
            y: box.originY / videoHeight,
            width: box.width / videoWidth,
            height: box.height / videoHeight,
        };
    });

    return faces

}