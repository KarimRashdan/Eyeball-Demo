const SEG_LOOK_BEHIND = 0.18;
const SEG_HOLD_BEHIND = 0.10;
const SEG_BACK_CENTER = 0.14;
const SEG_PUSH_TO_CAM = 0.30;
const SEG_INCOMING = 0.28;

const BEHIND_YAW_ADD = Math.PI;

const PAST_CAMERA_MARGIN = 0.6;

const FAR_Z_OFFSET = 18.0;
const FAR_SCALE_MUL = 0.35;

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

export const surprisedTransition = {
    type: "surprised",
    defaultDurationMs: 4000,

    onBegin(ctx) {},

    update(ctx, t) {
        const s0 = 0;
        const s1 = s0 + SEG_LOOK_BEHIND;
        const s2 = s1 + SEG_HOLD_BEHIND;
        const s3 = s2 + SEG_BACK_CENTER;
        const s4 = s3 + SEG_PUSH_TO_CAM;
        const s5 = s4 + SEG_INCOMING;

        let outgoingYaw = ctx.baseYaw;
        const outgoingPitch = ctx.basePitch;

        if (t < s1) {
            const u = norm(t, s0, s1);
            outgoingYaw = lerp(ctx.baseYaw, ctx.baseYaw + BEHIND_YAW_ADD, u);
        } else if (t < s2) {
            outgoingYaw = ctx.baseYaw + BEHIND_YAW_ADD;
        } else if (t < s3) {
            const u = norm(t, s2, s3);
            outgoingYaw = lerp(ctx.baseYaw + BEHIND_YAW_ADD, ctx.baseYaw, u);
        } else {
            outgoingYaw = ctx.baseYaw;
        }

        if (ctx.outgoingRoot && ctx.outgoingStartPos && ctx.camera) {
            const camZ = ctx.camera.position.z;
            const startZ = ctx.outgoingStartPos.z;
            const endZ = camZ + PAST_CAMERA_MARGIN;

            if (t < s3) {
                ctx.outgoingRoot.position.z = startZ;
            } else if (t < s4) {
                const u = norm(t, s3, s4);
                ctx.outgoingRoot.position.z = lerp(startZ, endZ, u);
            } else {
                ctx.outgoingRoot.position.z = endZ;
                ctx.outgoingRoot.visible = false;
            }
        }

        applyScaleMul(ctx.outgoingRoot, ctx.outgoingBaseScale, 1.0);

        let incomingYaw = null;
        const incomingPitch = ctx.basePitch;

        if (ctx.incomingRoot && ctx.outgoingStartPos && ctx.camera) {
            const startZ = ctx.outgoingStartPos.z;
            const farZ = startZ - FAR_Z_OFFSET;

            if (t >= s4) {
                if (!ctx.incomingShown) {
                    ctx.incomingRoot.visible = true;
                    ctx.incomingShown = true;

                    ctx.incomingRoot.position.x = ctx.outgoingStartPos.x;
                    ctx.incomingRoot.position.y = ctx.outgoingStartPos.y;
                    ctx.incomingRoot.position.z = farZ;

                    applyScaleMul(ctx.incomingRoot, ctx.incomingBaseScale, FAR_SCALE_MUL);
                }

                const u = norm(t, s4, s5);

                ctx.incomingRoot.position.z = lerp(farZ, startZ, u);

                const scaleMul = lerp(FAR_SCALE_MUL, 1.0, u);
                applyScaleMul(ctx.incomingRoot, ctx.incomingBaseScale, scaleMul);

                incomingYaw = ctx.baseYaw;
            }
        }

        return {
            outgoingPose: ctx.outgoingRoot ? { yaw: outgoingYaw, pitch: outgoingPitch } : null,
            incomingPose: (ctx.incomingRoot && incomingYaw !== null) ? { yaw: incomingYaw, pitch: incomingPitch } : null,
            lockIncomingRotX: false,
        };
    },
};