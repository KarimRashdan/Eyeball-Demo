import {
    FaceLandmarker,
    FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let faceLandmarkerInstance = null;
let lastEmotion = null;

const EMOTION_MODEL_PATH = "/models/face_landmarker.task";

const BASELINE_FRAMES = 45;
const BASELINE_MAX_VALUE = 1.0;

const EMA_ALPHA = 0.22;

const MIN_SCORE = 0.14;
const MIN_GAP = 0.05;

const SWITCH_GAP = 0.06;

const CLAMP_SCORES_TO_ZERO = true;

let baselineLocked = false;
let baselineCount = 0;
const baselineMean = new Map();
const ema = new Map();

let lastDecision = { label: "neutral", score: 0};

function clamp01(t) {
    return Math.max(0, Math.min(1, t));
}

function safeNowMs(time) {
    if (typeof time === "function") return time();
    if (typeof time === "number") return time;
    return performance.now();
}

function categoriesToRawMap(blendshapes) {
    const m = new Map();
    for (const c of blendshapes) {
        m.set(c.categoryName, clamp01(c.score ?? 0, 0, BASELINE_MAX_VALUE));
    }
    return m;
}

function updateBaseline(rawMap) {
    baselineCount++;
    for (const [name, value] of rawMap.entries()) {
        const prevMean = baselineMean.get(name) ?? 0;
        const newMean = prevMean + (value - prevMean) / baselineCount;
        baselineMean.set(name, newMean);
    }

    if (baselineCount >= BASELINE_FRAMES) {
        baselineLocked = true;
    }
}

function getBaseline(name) {
    if (!baselineLocked) return 0;
    return baselineMean.get(name) ?? 0;
}

function updateEMA(name, value) {
    const prevEma = ema.get(name);
    if (prevEma === undefined) {
        ema.set(name, value);
        return value;
    }
    const newEma = EMA_ALPHA * value + (1 - EMA_ALPHA) * prevEma;
    ema.set(name, newEma);
    return newEma;
}

function getSmoothedCoeff(map, name) {
    const rawValue = map.get(name) ?? 0;
    const baseline = getBaseline(name);
    const calibratedValue = clamp01(rawValue - baseline, 0, 1);
    return updateEMA(name, calibratedValue);
}

function classifyEmotionSmoothed(get) {
    // https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
    const smileL = get("mouthSmileLeft");
    const smileR = get("mouthSmileRight");
    const cheekSquintL = get("cheekSquintLeft");
    const cheekSquintR = get("cheekSquintRight");
    const mouthOpen = get("jawOpen");
    const eyeWideL = get("eyeWideLeft");
    const eyeWideR = get("eyeWideRight");
    const browDownL = get("browDownLeft");
    const browDownR = get("browDownRight");
    const browUpL = get("browOuterUpLeft");
    const browUpR = get("browOuterUpRight");
    const noseSneerL = get("noseSneerLeft");
    const noseSneerR = get("noseSneerRight");
    const frownL = get("mouthFrownLeft");
    const frownR = get("mouthFrownRight");
    const eyeSquintL = get("eyeSquintLeft");
    const eyeSquintR = get("eyeSquintRight");
    const browInnerUp = get("browInnerUp");
    const mouthPucker = get("mouthPucker");

    const avg = (a, b) => (a + b) / 2;
    const smile = avg(smileL, smileR);
    const frown = avg(frownL, frownR);
    const browDown = avg(browDownL, browDownR);
    const browOuterUp = avg(browUpL, browUpR);
    const eyeWide = avg(eyeWideL, eyeWideR);
    const eyeSquint = avg(eyeSquintL, eyeSquintR);
    const cheekSquint = avg(cheekSquintL, cheekSquintR);
    const noseSneer = avg(noseSneerL, noseSneerR);

    const sadGate2 = (0.25 + 0.75 * Math.max(frown, mouthPucker));
    const gateScale = (g) => (0.35 + 0.65 * g);
    const gateHappy = smile;
    const gateSurprised = Math.max(eyeWide, mouthOpen);
    const gateAngry = browDown;
    const gateSad = Math.max(browInnerUp, frown);

    let happyScore = gateScale(gateHappy) * (1.40*smile + 0.55*cheekSquint + 0.25*eyeSquint - 0.80*frown - 0.20*eyeWide);
    let surprisedScore = gateScale(gateSurprised) * ( 1.25*mouthOpen + 0.95*eyeWide + 0.40*browOuterUp - 0.20*browInnerUp - 0.35*smile - 0.55*eyeSquint - 0.35*frown);
    let angryScore = gateScale(gateAngry) * (1.30*browDown + 0.55*eyeSquint + 0.35*noseSneer + 0.20*frown - 0.50*smile - 0.60*browOuterUp);
    let sadScore = sadGate2 * gateScale(gateSad) * 1.3 * (1.10*frown + 0.7*browInnerUp + 0.25*mouthPucker - 0.80*smile - 0.2*eyeWide - 0.55*mouthOpen);

    if (CLAMP_SCORES_TO_ZERO) {
        happyScore = Math.max(0, happyScore);
        surprisedScore = Math.max(0, surprisedScore);
        angryScore = Math.max(0, angryScore);
        sadScore = Math.max(0, sadScore);
    }

    const emotions = [
        { label: "happy", score: happyScore },
        { label: "surprised", score: surprisedScore },
        { label: "angry", score: angryScore },
        { label: "sad", score: sadScore },
    ];

    emotions.sort((a, b) => b.score - a.score);

    const best = emotions[0];
    const secondBest = emotions[1];

    const gap = best.score - (secondBest?.score ?? 0);
    if (best.score < MIN_SCORE || gap < MIN_GAP) {
        return {
            label: "neutral",
            score: 0,
            best,
            secondBest,
            gap,
            emotions,
        };
    }

    if (lastDecision.label !== "neutral" && best.label !== lastDecision.label) {
        if (best.score < lastDecision.score + SWITCH_GAP) {
            return {
                label: lastDecision.label,
                score: lastDecision.score,
                best,
                secondBest,
                gap,
                emotions,
                keptPrevious: true,
            };
        }
    }

    return {
        label: best.label,
        score: best.score,
        best,
        secondBest,
        gap,
        emotions,
    };
}


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
    faceLandmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: EMOTION_MODEL_PATH,
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            // blendshapes for emotions
            outputFaceBlendshapes: true,
            numFaces: 1,
    });

    resetEmotionState();

    console.log("Emotion detector initialized");

}

export function resetEmotionState() {
    lastEmotion = {label: "neutral", blendshapes: [], debug: null};

    baselineLocked = false;
    baselineCount = 0;
    baselineMean.clear();

    ema.clear();

    lastDecision = { label: "neutral", score: 0};
}

export function updateEmotion(videoElement, time) {
    if (!faceLandmarkerInstance || !videoElement) return null;

    if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        return lastEmotion;
    }

    const timestampMs = safeNowMs(time);

    // call landmarker on current video frame
    // https://www.youtube.com/watch?v=NiK5wHce03Y
    const result = faceLandmarkerInstance.detectForVideo(videoElement, timestampMs);

    if (!result || !result.faceBlendshapes || result.faceBlendshapes.length === 0) {
        // neutral emotion placeholder
        lastDecision = { label: "neutral", score: 0};
        lastEmotion = { label: "neutral", blendshapes: [], debug: { reason: "no_face" }};
        return lastEmotion;
    }

    // take first face's blendshapes
    const blendshapes = result.faceBlendshapes[0].categories || [];
    const rawMap = categoriesToRawMap(blendshapes);

    if (!baselineLocked) {
        updateBaseline(rawMap);
        lastDecision = { label: "neutral", score: 0};
        lastEmotion = { label: "neutral", blendshapes, debug: { baselineLocked, baselineCount }};
        return lastEmotion;
    }

    const get = (name) => getSmoothedCoeff(rawMap, name);

    const decision = classifyEmotionSmoothed(get);

    lastDecision = { label: decision.label, score: decision.score };

    lastEmotion = {
        label: decision.label,
        blendshapes,
        debug: {
            baselineLocked,
            baselineCount,
            best: decision.best,
            secondBest: decision.secondBest,
            gap: decision.gap,
            keptPrevious: decision.keptPrevious ?? false,
        },
    };

    return lastEmotion;
}

export function getCurrentEmotion() {
    return lastEmotion;
}