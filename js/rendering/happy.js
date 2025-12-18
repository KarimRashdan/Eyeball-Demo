const LOOK_LEFT_YAW = -1.0;

const H_SEG_GROW = 0.14;
const H_SEG_SHRINK = 0.12;
const H_SEG_LOOK_LEFT = 0.10
const H_SEG_EXIT = 0.20;
const H_SEG_ENTER = 0.44;

const OUTGOING_SPIN = 0.3;
const INCOMING_SPIN = 2.0;

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

export const happyTransition = {
    type: "happy",
    defaultDurationMs: 4000,

    onBegin(ctx) {},

    update(ctx, t) {
        const b0 = 0;
        const b1 = b0 + H_SEG_GROW;
        const b2 = b1 + H_SEG_SHRINK;
        const b3 = b2 + H_SEG_LOOK_LEFT;
        const b4 = b3 + H_SEG_EXIT;
        const b5 = b4 + H_SEG_ENTER;

        const startSpin = 0;
        const peakSpin = -Math.PI * 2 * OUTGOING_SPIN;

        let outgoingYaw = ctx.baseYaw;
        let outgoingPitch = ctx.basePitch;
    
        if (t < b1) {
            const u = norm(t, b0, b1);
            outgoingPitch = ctx.basePitch + lerp(startSpin, peakSpin, u);
        } else if (t < b2) {
            const u = norm(t, b1, b2);
            outgoingPitch = ctx.basePitch + lerp(peakSpin, startSpin, u);
        } else {
            outgoingPitch = ctx.basePitch;
        }
        

        //applyScaleMul(ctx.outgoingRoot, ctx.outgoingBaseScale, outScaleMul);


        if (t < b2) {
            outgoingYaw = ctx.baseYaw;
        } else if (t < b3) {
            const u = norm(t, b2, b3);
            outgoingYaw = lerp(ctx.baseYaw, ctx.baseYaw + LOOK_LEFT_YAW, u);
        } else {
            outgoingYaw = ctx.baseYaw + LOOK_LEFT_YAW;
        }

        if (ctx.outgoingRoot && ctx.outgoingStartPos) {
            if (t < b3) {
                ctx.outgoingRoot.position.x = ctx.outgoingStartPos.x;
            } else if (t < b4) {
                const u = norm(t, b3, b4);
                ctx.outgoingRoot.position.x = lerp(ctx.outgoingStartPos.x, ctx.exitX, u);
            } else {
                ctx.outgoingRoot.position.x = ctx.exitX;
            }
        }

        let incomingYaw = null;
        const incomingPitch = ctx.basePitch;

        if (ctx.incomingRoot && ctx.outgoingStartPos) {
            if (t >= b4) {
                const enterFromLeftX = ctx.exitX;
                if (!ctx.incomingShown) {
                    ctx.incomingRoot.visible = true;
                    ctx.incomingShown = true
                    ctx.incomingRoot.position.x = enterFromLeftX;

                    const startSpin = -Math.PI * 2 * INCOMING_SPIN;
                    ctx.incomingRoot.rotation.x = startSpin;
                }

                const u = norm(t, b4, b5);

                ctx.incomingRoot.position.x = lerp(enterFromLeftX, ctx.outgoingStartPos.x, u);

                const startSpin = -Math.PI * 2 * INCOMING_SPIN;
                ctx.incomingRoot.rotation.x = lerp(startSpin, 0, u);

                const blendStart = 0.85;
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
            incomingPose: ctx.incomingRoot && incomingYaw !== null ? { yaw: incomingYaw, pitch: incomingPitch } : null,
            lockIncomingRotX: true,
        };
    },
};