import {
    FaceDetector,
    FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let faceDetector = null;   // Mediapipe face detector

const MIN_FACING_SCORE = 0.2; // high is more strcit

function clamp01(t) {
    return Math.max(0, Math.min(1, t));
}

function facingScore(detection, vw) {
    const keypoints = detection.keypoints;
    if (!keypoints || keypoints.length < 3) return 0;

    const rightEye = keypoints[0];
    const leftEye = keypoints[1];
    const nose = keypoints[2];

    if (!rightEye || !leftEye || !nose) return 0;

    const leX = leftEye.x / vw;
    const reX = rightEye.x / vw;
    const nX = nose.x / vw;

    const dx = reX - leX;
    if (Math.abs(dx) < 1e-6) return 0;

    const ratio = (nX - leX) / dx;

    const facingScore = 1 - Math.min(1, Math.abs(ratio - 0.5) * 2);

    return clamp01(facingScore);
}


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
    const detectionResult = faceDetector.detectForVideo(videoElement, time);
    //console.log("XXXXX: ", detectionResult);

    // return an empty array if no faces detected
    if (!detectionResult || !detectionResult.detections || detectionResult.detections.length === 0) {
        return [];
    }

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (!videoWidth || !videoHeight) return [];

    const faces = []

    for (const detection of detectionResult.detections) {
        const box = detection.boundingBox;
        if (!box) continue;

        const score = facingScore(detection, videoWidth);
        if (score < MIN_FACING_SCORE) continue;

        const confidence = detection.categories?.[0]?.score ?? detection.score ?? detection.confidence ?? 0;;

        faces.push({
            x: box.originX / videoWidth,
            y: box.originY / videoHeight,
            width: box.width / videoWidth,
            height: box.height / videoHeight,
            confidence: confidence,
        });
    }

    return faces

}