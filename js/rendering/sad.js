const SEG_TILT_DOWN = 0.22;
const SEG_HOLD_DOWN = 0.12;
const SEG_LOOK_RIGHT = 0.18;
const SEG_HOLD_RIGHT = 0.10;
const SEG_EXIT_RIGHT = 0.15;
const SEG_ENTER_RIGHT = 0.23;

const SAD_PITCH_DOWN = 0.4;
const LOOK_RIGHT_YAW = +1.05;
const INCOMING_LOOK_LEFT_YAW = -1.0;


function lerp(a, b, t) {
    return a + (b - a) * t;
}

function clamp01(t) {
    return Math.max(0, Math.min(1, t));
}

function norm(t, a, b) {
    return clamp01((t - a) / Math.max(1e-6, b - a));
}
function applyScaleMul(root, baseScale, mul) {
    if (!root || !baseScale) return;
    root.scale.set(baseScale.x * mul, baseScale.y * mul, baseScale.z * mul);
}

export const sadTransition = {
    type: "sad",
    defaultDurationMs: 4000,

    onBegin(ctx) {},

    update(ctx, t) {
        const d0 = 0;
        const d1 = d0 + SEG_TILT_DOWN;
        const d2 = d1 + SEG_HOLD_DOWN;
        const d3 = d2 + SEG_LOOK_RIGHT;
        const d4 = d3 + SEG_HOLD_RIGHT;
        const d5 = d4 + SEG_EXIT_RIGHT;
        const d6 = d5 + SEG_ENTER_RIGHT;

        let outgoingPitch = ctx.basePitch;
        if (t < d1) {
            const u = norm(t, d0, d1);
            outgoingPitch = lerp(ctx.basePitch, ctx.basePitch + SAD_PITCH_DOWN, u);
        } else {
            outgoingPitch = ctx.basePitch + SAD_PITCH_DOWN;
        }

        let outgoingYaw = ctx.baseYaw;
        if (t < d2) {
            outgoingYaw = ctx.baseYaw;
        } else if (t < d3) {
            const u = norm(t, d2, d3);
            outgoingYaw = lerp(ctx.baseYaw, ctx.baseYaw + LOOK_RIGHT_YAW, u);
        } else {
            outgoingYaw = ctx.baseYaw + LOOK_RIGHT_YAW;
        }

        if (ctx.outgoingRoot && ctx.outgoingStartPos) {
            if (t < d4) {
                ctx.outgoingRoot.position.x = ctx.outgoingStartPos.x;
            } else if (t < d5) {
                const u = norm(t, d4, d5);
                ctx.outgoingRoot.position.x = lerp(ctx.outgoingStartPos.x, ctx.enterX, u);
            } else {
                ctx.outgoingRoot.position.x = ctx.enterX;
            }
        }

        applyScaleMul(ctx.outgoingRoot, ctx.outgoingBaseScale, 1.0);

        let incomingYaw = null;
        let incomingPitch = ctx.basePitch;

        if (ctx.incomingRoot && ctx.outgoingStartPos) {
            if (t >= d5) {
                if (!ctx.incomingShown) {
                    ctx.incomingRoot.visible = true;
                    ctx.incomingShown = true;

                    ctx.incomingRoot.position.x = ctx.enterX;
                    ctx.incomingRoot.position.y = ctx.outgoingStartPos.y;
                    ctx.incomingRoot.position.z = ctx.outgoingStartPos.z;
                }

                const u = norm(t, d5, d6);
                ctx.incomingRoot.position.x = lerp(ctx.enterX, ctx.outgoingStartPos.x, u);

                const blendStart = 0.90;
                if (u < blendStart) {
                    incomingYaw = ctx.baseYaw + INCOMING_LOOK_LEFT_YAW;
                } else {
                    const v = (u - blendStart) / (1 - blendStart);
                    incomingYaw = lerp(ctx.baseYaw + INCOMING_LOOK_LEFT_YAW, ctx.baseYaw, clamp01(v));
                }

                incomingPitch = ctx.basePitch;

                applyScaleMul(ctx.incomingRoot, ctx.incomingBaseScale, 1.0);
            }
        }

        return {
            outgoingPose: ctx.outgoingRoot ? { yaw: outgoingYaw, pitch: outgoingPitch } : null,
            incomingPose: (ctx.incomingRoot && incomingYaw !== null) ? { yaw: incomingYaw, pitch: incomingPitch } : null,
            lockIncomingRotX: false,
        };
    },
};