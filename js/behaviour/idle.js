// frames until new IDLE target, mess around with this when more progress
export const IDLE_TARGET_CHANGE_FRAMES = 60; // 60 = 1 second ar 60 fps

// generate random gaze direction
export function getRandomIdleTarget() {
    const rangeX = 2.5;
    const rangeY = 2.5;

    return {
        x: (Math.random() * 2 - 1) * rangeX, // -rangeX to +rangeX
        y: (Math.random() * 2 - 1) * rangeY, // -rangeY to +rangeY
    };
}

// update idle behaviour
export function updateIdleBehaviour(behaviourState) {
    behaviourState.idleTimerFrames += 1;

    // choose new point to wander towards
    if (
        behaviourState.idleTimerFrames === 1 ||
        behaviourState.idleTimerFrames > IDLE_TARGET_CHANGE_FRAMES
    ) {
        behaviourState.idleTarget = getRandomIdleTarget();
        behaviourState.idleTimerFrames = 1;
    }

    behaviourState.targetCoords = behaviourState.idleTarget;

    return behaviourState;
}