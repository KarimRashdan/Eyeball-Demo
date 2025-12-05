import {
    FaceLandmarker,
    FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let faceLandmarkerInstance = null;
let lastEmotion = null;

const EMOTION_MODEL_PATH = "/models/face_landmarker.task";

// check if ready
export function emotionDetectorReady() {
    return !!faceLandmarkerInstance;
}

// initialize emotion detector
export async function initEmotionDetector() {
    if (faceLandmarkerInstance) return; // already initialized

    // https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm",
    );

    // create landmarker instance
    faceLandmarkerInstance = await FaceLandmarker.createFromOptions(
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

// get the score for a given blendhspe name
function getCoeff(blendshapes, name) {
    const found = blendshapes.find((c) => c.categoryName === name);
    return found ? found.score : 0;
}

// map blendshapes to emotion labels
function classifyEmotion(blendshapes) {
    // https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
    const smileL = getCoeff(blendshapes, "mouthSmileLeft");
    const smileR = getCoeff(blendshapes, "mouthSmileRight");
    const cheekSquintL = getCoeff(blendshapes, "cheekSquintLeft");
    const cheekSquintR = getCoeff(blendshapes, "cheekSquintRight");
    const mouthOpen = getCoeff(blendshapes, "jawOpen");
    const eyeWideL = getCoeff(blendshapes, "eyeWideLeft");
    const eyeWideR = getCoeff(blendshapes, "eyeWideRight");
    const browDownL = getCoeff(blendshapes, "browDownLeft");
    const browDownR = getCoeff(blendshapes, "browDownRight");
    const browUpL = getCoeff(blendshapes, "browOuterUpLeft");
    const browUpR = getCoeff(blendshapes, "browOuterUpRight");
    const noseSneerL = getCoeff(blendshapes, "noseSneerLeft");
    const noseSneerR = getCoeff(blendshapes, "noseSneerRight");
    const frownL = getCoeff(blendshapes, "mouthFrownLeft");
    const frownR = getCoeff(blendshapes, "mouthFrownRight");

    // UPDATE THESE AND ADD NEW ONES LATER
    const happyScore = (smileL + smileR) * 0.6 + (cheekSquintL + cheekSquintR) * 0.4;
    const surprisedScore = (eyeWideL + eyeWideR) * 0.3 + mouthOpen * 0.5 + (browUpL + browUpR) * 0.2;
    const angryScore = (browDownL + browDownR) * 0.5 + (noseSneerL + noseSneerR) * 0.5;
    const sadScore = (frownL + frownR) * 0.6 + (browDownL + browDownR) * 0.4;

    const emotions = [
        { label: "happy", score: happyScore },
        { label: "surprised", score: surprisedScore },
        { label: "angry", score: angryScore },
        { label: "sad", score: sadScore },
    ];

    // pick best scoring emotion
    let best = { label: "neutral", score: 0 };
    for (const emotion of emotions) {
        if (emotion.score > best.score) best = emotion;
    }

    // ADJUST AFTER TESTING
    const THRESHOLD = 0.2;
    if (best.score < THRESHOLD) {
        return "neutral";
    }

    return best.label;

}


export function updateEmotion(videoElement, time) {
    if (!faceLandmarkerInstance || !videoElement) return null;

    if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        return lastEmotion;
    }

    // call landmarker on current video frame
    // https://www.youtube.com/watch?v=NiK5wHce03Y
    const result = faceLandmarkerInstance.detectForVideo(videoElement, time);

    if (!result || !result.faceBlendshapes || result.faceBlendshapes.length === 0) {
        // neutral emotion placeholder
        lastEmotion = {
            label: "neutral",
            blendshapes: [],
        };
        return lastEmotion;
    }

    // take first face's blendshapes
    const blendshapes = result.faceBlendshapes[0].categories || [];

    // raw blendshape values
    console.log("Blendshapes:", blendshapes);

    const label = classifyEmotion(blendshapes);

    lastEmotion = {
        label,
        blendshapes,
    };

    return lastEmotion;
}

export function getCurrentEmotion() {
    return lastEmotion;
}