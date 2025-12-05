import {
    faceLandmarker,
    FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let faceLandmarker = null;
let lastEmotion = null;
const vision = null;

const EMOTION_MODEL_PATH = "/models/face_landmarker.task";

// check if ready
export function emotionDetectorReady() {
    return !!faceLandmarker;
}

// initialize emotion detector
export async function initEmotionDetector() {
    if (faceLandmarker) return; // already initialized

    // https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm",
    );

    // create landmarker instance
    faceLandmarker = await faceLandmarker.createFromOptions(
        vision, 
        {
            baseOptions: {
                modelAssetPath: EMOTION_MODEL_PATH,
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            // blendshapes for emotions
            outputFaceBlendshapes: true,
            numFaces: 1,
        },
    );

    console.log("Emotion detector initialized");

}

export function updateEmotion(videoElement, time) {
    if (!faceLandmarker) return null;

    // call landmarker on current video frame
    // https://www.youtube.com/watch?v=NiK5wHce03Y
    const result = faceLandmarker.detectForVideo(videoElement, time);

    if (!result || !result.faceBlendshapes || result.faceBlendshapes.length === 0) {
        // neutral emotion placeholder
        lastEmotion = {
            emotion: "neutral",
            blendshapes: [],
        };
        return lastEmotion;
    }

    // take first face's blendshapes
    const blendshapes = result.faceBlendshapes[0].categories || [];

    // raw blendshape values
    console.log("Blendshapes:", blendshapes);

    lastEmotion = {
        label: "neutral",
        blendshapes,
    };

    return lastEmotion;
}
export function getCurrentEmotion() {
    return lastEmotion;
}