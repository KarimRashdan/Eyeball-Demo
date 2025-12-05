import {
    faceLandmarker,
    FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let faceLandmarker = null;
let lastEmotion = null;
let vision = null;

const EMOTION_MODEL_PATH = "/models/face_landmarker.task";