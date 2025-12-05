let webcamVideo = null;    // webcam video element
let webcamError = false;   // flag for webcam error (i.e. user denied access or webcam not available)

export function setupVideoElement() {
    // https://www.youtube.com/watch?v=k4QebSqA8zU
    // get webcam video element or return nothng if not found
    webcamVideo = document.getElementById("webcamVideo");
    if (!webcamVideo) {
        console.error("Webcam video element not found");
        webcamError = true;
        return;
    }
}

export async function startWebcam() {
    // prompts for permission to use webcam
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    try {
        const stream = await navigator.mediaDevices
            // just set to True 
            .getUserMedia({ video: { facingMode: "user" } });
        webcamVideo.srcObject = stream;
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        webcamError = true;
        throw err;
    }
}

export function getWebcamVideo() {
    return webcamVideo;
}

export function hasWebcamError() {
    return webcamError;
}

export function setWebcamError(value) {
    webcamError = value;
}