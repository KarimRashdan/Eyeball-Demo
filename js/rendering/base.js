const LOOK_RIGHT_YAW = +1.3;
const LOOK_LEFT_YAW = -1.3;

const SEG_TURN_RIGHT = 0.20;
const SEG_HOLD_RIGHT = 0.10;
const SEG_TURN_CENTER = 0.05;
const SEG_HOLD_CENTER = 0.15;
const SEG_EXIT_LEFT = 0.15;
const SEG_ENTER_RIGHT = 0.25;

const ANGRY_FAR_Z_OFFSET = 0.0;

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function clamp01(t) {
    return Math.max(0, Math.min(1, t));
}

function norm(t, a, b) {
    return clamp01((t - a) / Math.max(1e-6, b - a));
}

export const baseTransition = {
    type: "base",
    defaultDurationMs: 4000,

    onBegin(ctx) {},

    update(ctx, t) {
        const a0 = 0;
        const a1 = a0 + SEG_TURN_RIGHT;
        const a2 = a1 + SEG_HOLD_RIGHT;
        const a3 = a2 + SEG_TURN_CENTER;
        const a4 = a3 + SEG_HOLD_CENTER;
        const a5 = a4 + SEG_EXIT_LEFT;
        const a6 = a5 + SEG_ENTER_RIGHT;

        let outgoingYaw = ctx.baseYaw;
        const outgoingPitch = ctx.basePitch;

        if (t < a1) {
            const u = norm(t, a0, a1);
            outgoingYaw = lerp(ctx.baseYaw, ctx.baseYaw + LOOK_RIGHT_YAW, u);
        } else if (t < a2) {
            outgoingYaw = ctx.baseYaw + LOOK_RIGHT_YAW;
        } else if (t < a3) {
            const u = norm(t, a2, a3);
            outgoingYaw = lerp(ctx.baseYaw + LOOK_RIGHT_YAW, ctx.baseYaw, u);
        } else if (t < a4) {
            outgoingYaw = ctx.baseYaw;
        } else if (t < a5) {
            const u = norm(t, a4, a5);
            outgoingYaw = lerp(ctx.baseYaw, ctx.baseYaw + LOOK_LEFT_YAW, u);
        } else {
            outgoingYaw = ctx.baseYaw + LOOK_LEFT_YAW;
        }

        if (ctx.outgoingRoot && ctx.outgoingStartPos) {
            if (t < a4) {
                ctx.outgoingRoot.position.x = ctx.outgoingStartPos.x;
            } else if (t < a5) {
                const u = norm(t, a4, a5);
                ctx.outgoingRoot.position.x = lerp(ctx.outgoingStartPos.x, ctx.exitX, u);
            } else {
                ctx.outgoingRoot.position.x = ctx.exitX;
            }
        }

        let incomingYaw = null;
        let incomingPitch = ctx.basePitch;

        if (ctx.incomingRoot && ctx.outgoingStartPos) {
            if (t >= a5) {
                const startZ = ctx.outgoingStartPos.z;
                const farZ = (ctx.toKey === "angry") ? (startZ - ANGRY_FAR_Z_OFFSET) : startZ;
                if (!ctx.incomingShown) {
                    ctx.incomingRoot.visible = true;
                    ctx.incomingShown = true
                    ctx.incomingRoot.position.x = ctx.enterX;
                    ctx.incomingRoot.position.y = ctx.outgoingStartPos.y;

                    ctx.incomingRoot.position.z = farZ;
                }

                const u = norm(t, a5, a6);

                ctx.incomingRoot.position.x = lerp(ctx.enterX, ctx.outgoingStartPos.x, u);
                ctx.incomingRoot.position.z = lerp(farZ, startZ, u);

                const blendStart = 0.85;
                if (u < blendStart) {
                    incomingYaw = ctx.baseYaw + LOOK_LEFT_YAW;
                } else {
                    const v = (u - blendStart) / (1 - blendStart);
                    incomingYaw = lerp(ctx.baseYaw + LOOK_LEFT_YAW, ctx.baseYaw, clamp01(v));
                }

                incomingPitch = ctx.basePitch;

            }
        }

        return { 
            outgoingPose: ctx.outgoingRoot ? { yaw: outgoingYaw, pitch: outgoingPitch } : null,
            incomingPose: ctx.incomingRoot && incomingYaw !== null ? { yaw: incomingYaw, pitch: incomingPitch } : null,
            lockIncomingRotX: true,
        };
    }
}