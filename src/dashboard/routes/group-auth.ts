import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import { getClientInstance } from "../../libs/client/instance";
import { logger } from "../../core/logger";
import {
    normalizePhoneNumber,
    getRequesterIp,
    startSession,
    signSessionToken,
    isIpBlocked,
} from "./auth";
import { findAdminGroupsFromDb } from "../services/group-access.service";

const OTP_TTL_MS = 5 * 60 * 1000; // code valid for 5 minutes
const OTP_MAX_ATTEMPTS = 5; // wrong-code attempts before the code is burned
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // min gap between two OTP sends
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000; // sliding window for per-IP throttle
const OTP_RATE_MAX = 5; // max OTP requests per IP per window

type PendingOtp = {
    phoneNumber: string;
    code: string;
    createdAt: number;
    lastSentAt: number;
    attempts: number;
    groupCount: number;
    requesterIp: string;
};

// phoneNumber -> pending OTP. In-memory only; OTPs are short-lived by design.
const pendingOtps = new Map<string, PendingOtp>();
// ip -> recent request timestamps (sliding window).
const ipOtpRequests = new Map<string, number[]>();

function generateCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function cleanupExpiredOtps(): void {
    const now = Date.now();
    for (const [phone, otp] of pendingOtps.entries()) {
        if (now - otp.createdAt > OTP_TTL_MS) pendingOtps.delete(phone);
    }
}

function checkIpRate(ip: string): { limited: boolean; retryAfterMs: number } {
    const now = Date.now();
    const arr = (ipOtpRequests.get(ip) || []).filter(
        (t) => now - t < OTP_RATE_WINDOW_MS
    );
    ipOtpRequests.set(ip, arr);
    if (arr.length >= OTP_RATE_MAX) {
        const oldest = arr[0];
        return { limited: true, retryAfterMs: OTP_RATE_WINDOW_MS - (now - oldest) };
    }
    return { limited: false, retryAfterMs: 0 };
}

function recordIpRequest(ip: string): void {
    const arr = ipOtpRequests.get(ip) || [];
    arr.push(Date.now());
    ipOtpRequests.set(ip, arr);
}

interface OtpRequestBody {
    phoneNumber: string;
}
interface OtpVerifyBody {
    phoneNumber: string;
    code: string;
}

export async function groupAuthRoutes(fastify: FastifyInstance) {
    // Step 1: request an OTP. Only sent if the number is an admin somewhere.
    fastify.post(
        "/request-otp",
        async (request: FastifyRequest<{ Body: OtpRequestBody }>, reply: FastifyReply) => {
            cleanupExpiredOtps();

            const requesterIp = getRequesterIp(request);
            if (isIpBlocked(requesterIp)) {
                return reply.status(403).send({
                    success: false,
                    message: "Access from this IP is blocked.",
                });
            }

            const phoneNumber = normalizePhoneNumber(request.body?.phoneNumber || "");
            if (!phoneNumber) {
                return reply.status(400).send({
                    success: false,
                    message: "A valid phone number is required.",
                });
            }

            const rate = checkIpRate(requesterIp);
            if (rate.limited) {
                return reply.status(429).send({
                    success: false,
                    rateLimited: true,
                    retryAfterMs: rate.retryAfterMs,
                    message: "Too many OTP requests from this IP. Please try again later.",
                });
            }

            const client = getClientInstance();
            if (!client) {
                return reply.status(503).send({
                    success: false,
                    message: "Bot is not connected. Please try again shortly.",
                });
            }

            // Resend cooldown — reuse the existing code if still fresh.
            const existing = pendingOtps.get(phoneNumber);
            const now = Date.now();
            if (existing && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
                return reply.status(429).send({
                    success: false,
                    rateLimited: true,
                    retryAfterMs: OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt),
                    message: "An OTP was just sent. Please wait before requesting another.",
                });
            }

            let adminGroups;
            try {
                adminGroups = await findAdminGroupsFromDb(phoneNumber, client);
            } catch (err) {
                logger.error("group-auth: failed to look up admin groups:", err);
                return reply.status(500).send({
                    success: false,
                    message: "Failed to verify group membership.",
                });
            }

            if (!adminGroups.length) {
                // Count this as a request to deter enumeration.
                recordIpRequest(requesterIp);
                return reply.status(403).send({
                    success: false,
                    message:
                        "This number is not an admin of any group the bot is in. Group-admin access is unavailable.",
                });
            }

            const code = existing && now - existing.createdAt < OTP_TTL_MS
                ? existing.code
                : generateCode();

            pendingOtps.set(phoneNumber, {
                phoneNumber,
                code,
                createdAt: existing && now - existing.createdAt < OTP_TTL_MS ? existing.createdAt : now,
                lastSentAt: now,
                attempts: existing?.attempts ?? 0,
                groupCount: adminGroups.length,
                requesterIp,
            });

            const message =
                `🔐 *ChisatoBOT Group Dashboard*\n\n` +
                `Your one-time login code is:\n\n*${code}*\n\n` +
                `You are an admin of *${adminGroups.length}* group${adminGroups.length === 1 ? "" : "s"}.\n` +
                `This code is valid for 5 minutes. Do not share it with anyone.\n\n` +
                `🌐 IP: ${requesterIp}\n` +
                `_If you didn't request this, ignore this message._`;

            try {
                await (client as any).sendText(`${phoneNumber}@s.whatsapp.net`, message);
            } catch (err) {
                logger.error("group-auth: failed to send OTP:", err);
                return reply.status(500).send({
                    success: false,
                    message: "Failed to send the OTP via WhatsApp.",
                });
            }

            recordIpRequest(requesterIp);

            return reply.send({
                success: true,
                message: "OTP sent to your WhatsApp.",
                expiresInMs: OTP_TTL_MS,
                resendCooldownMs: OTP_RESEND_COOLDOWN_MS,
                groupCount: adminGroups.length,
            });
        }
    );

    // Step 2: verify the OTP and issue a group-admin session token.
    fastify.post(
        "/verify-otp",
        async (request: FastifyRequest<{ Body: OtpVerifyBody }>, reply: FastifyReply) => {
            cleanupExpiredOtps();

            const requesterIp = getRequesterIp(request);
            if (isIpBlocked(requesterIp)) {
                return reply.status(403).send({
                    success: false,
                    message: "Access from this IP is blocked.",
                });
            }

            const phoneNumber = normalizePhoneNumber(request.body?.phoneNumber || "");
            const code = String(request.body?.code || "").replace(/[^0-9]/g, "");

            const pending = pendingOtps.get(phoneNumber);
            if (!pending) {
                return reply.status(400).send({
                    success: false,
                    message: "No active OTP. Please request a new code.",
                });
            }

            if (Date.now() - pending.createdAt > OTP_TTL_MS) {
                pendingOtps.delete(phoneNumber);
                return reply.status(400).send({
                    success: false,
                    expired: true,
                    message: "OTP has expired. Please request a new code.",
                });
            }

            pending.attempts += 1;
            if (pending.attempts > OTP_MAX_ATTEMPTS) {
                pendingOtps.delete(phoneNumber);
                return reply.status(429).send({
                    success: false,
                    message: "Too many incorrect attempts. Please request a new code.",
                });
            }

            if (!code || code !== pending.code) {
                const remaining = OTP_MAX_ATTEMPTS - pending.attempts + 1;
                return reply.status(401).send({
                    success: false,
                    message: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
                    attemptsRemaining: Math.max(0, remaining),
                });
            }

            // Success — burn the OTP, open a session, issue a token.
            pendingOtps.delete(phoneNumber);

            const sessionId = `ga:${phoneNumber}:${Date.now()}:${crypto
                .randomBytes(4)
                .toString("hex")}`;
            startSession(sessionId);

            const token = signSessionToken({
                sessionId,
                phoneNumber,
                role: "groupadmin",
            });

            return reply.send({
                success: true,
                message: "Login successful.",
                token,
                admin: {
                    phoneNumber,
                    role: "groupadmin",
                    groupCount: pending.groupCount,
                },
            });
        }
    );
}
