const SEG_HOLD_CENTER = 0.20;
const SEG_TURN_LEFT = 0.16;
const SEG_HOLD_LEFT = 0.18;
const SEG_EXIT_LEFT = 0.22;
const SEG_ENTER_RIGHT = 0.24;

const LOOK_LEFT_YAW = -1.0;

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

export const neutralTransition = {
    type: "neutral",
    defaultDurationMs: 4000,

    onBegin(ctx) {},

    update(ctx, t) {
        const n0 = 0;
        const n1 = n0 + SEG_HOLD_CENTER;
        const n2 = n1 + SEG_TURN_LEFT;
        const n3 = n2 + SEG_HOLD_LEFT;
        const n4 = n3 + SEG_EXIT_LEFT;
        const n5 = n4 + SEG_ENTER_RIGHT;

        let outgoingYaw = ctx.baseYaw;
        const outgoingPitch = ctx.basePitch;

        if (t < n1) {
            outgoingYaw = ctx.baseYaw;
        } else if (t < n2) {
            const u = norm(t, n1, n2);
            outgoingYaw = lerp(ctx.baseYaw, ctx.baseYaw + LOOK_LEFT_YAW, u);
        } else {
            outgoingYaw = ctx.baseYaw + LOOK_LEFT_YAW;
        }

        if (ctx.outgoingRoot && ctx.outgoingStartPos) {
            if (t < n3) {
                ctx.outgoingRoot.position.x = ctx.outgoingStartPos.x;
            } else if (t < n4) {
                const u = norm(t, n3, n4);
                ctx.outgoingRoot.position.x = lerp(ctx.outgoingStartPos.x, ctx.exitX, u);
            } else {
                ctx.outgoingRoot.position.x = ctx.exitX;
            }
        }

        applyScaleMul(ctx.outgoingRoot, ctx.outgoingBaseScale, 1.0);

        let incomingYaw = null;
        const incomingPitch = ctx.basePitch;

        if (ctx.incomingRoot && ctx.outgoingStartPos) {
            if (t >= n4) {
                const enterFromRight = ctx.enterX;
                if (!ctx.incomingShown) {
                    ctx.incomingRoot.visible = true;
                    ctx.incomingShown = true;

                    ctx.incomingRoot.position.x = enterFromRight;
                    ctx.incomingRoot.position.y = ctx.outgoingStartPos.y;
                    ctx.incomingRoot.position.z = ctx.outgoingStartPos.z;
                }

                const u = norm(t, n4, n5);
                ctx.incomingRoot.position.x = lerp(enterFromRight, ctx.outgoingStartPos.x, u);

                const blendStart = 0.90;
                if (u < blendStart) {
                    incomingYaw = ctx.baseYaw + LOOK_LEFT_YAW;
                } else {
                    const v = (u - blendStart) / (1 - blendStart);
                    incomingYaw = lerp(ctx.baseYaw + LOOK_LEFT_YAW, ctx.baseYaw, clamp01(v));
                }

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