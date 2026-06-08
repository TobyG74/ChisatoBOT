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
import {
    findAdminGroupsFromDb,
    getBotPhoneNumber,
} from "../services/group-access.service";

/**
 * Reverse-OTP group-admin login.
 */

const OTP_TTL_MS = 5 * 60 * 1000; // code valid for 5 minutes
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000; // sliding window for per-IP throttle
const OTP_RATE_MAX = 6; // max OTP requests per IP per window

type PendingOtp = {
    requestId: string;
    phoneNumber: string; // bare number expected as the DM sender
    code: string;
    createdAt: number;
    status: "pending" | "verified";
    groupCount: number;
    requesterIp: string;
    token?: string;
    admin?: { phoneNumber: string; role: "groupadmin"; groupCount: number };
};

// requestId -> pending (the web polls this)
const pendingByRequest = new Map<string, PendingOtp>();
// phoneNumber -> set of requestIds (fast lookup when a DM arrives)
const phoneToRequests = new Map<string, Set<string>>();
// ip -> recent request timestamps (sliding window)
const ipOtpRequests = new Map<string, number[]>();

function generateCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function indexPhone(phone: string, requestId: string): void {
    let set = phoneToRequests.get(phone);
    if (!set) {
        set = new Set();
        phoneToRequests.set(phone, set);
    }
    set.add(requestId);
}

function unindexPhone(phone: string, requestId: string): void {
    const set = phoneToRequests.get(phone);
    if (!set) return;
    set.delete(requestId);
    if (!set.size) phoneToRequests.delete(phone);
}

function dropRequest(req: PendingOtp): void {
    pendingByRequest.delete(req.requestId);
    unindexPhone(req.phoneNumber, req.requestId);
}

function cleanupExpiredOtps(): void {
    const now = Date.now();
    for (const req of [...pendingByRequest.values()]) {
        if (now - req.createdAt > OTP_TTL_MS) dropRequest(req);
    }
}

function checkIpRate(ip: string): { limited: boolean; retryAfterMs: number } {
    const now = Date.now();
    const arr = (ipOtpRequests.get(ip) || []).filter(
        (t) => now - t < OTP_RATE_WINDOW_MS
    );
    ipOtpRequests.set(ip, arr);
    if (arr.length >= OTP_RATE_MAX) {
        return { limited: true, retryAfterMs: OTP_RATE_WINDOW_MS - (now - arr[0]) };
    }
    return { limited: false, retryAfterMs: 0 };
}

function recordIpRequest(ip: string): void {
    const arr = ipOtpRequests.get(ip) || [];
    arr.push(Date.now());
    ipOtpRequests.set(ip, arr);
}

export function tryConsumeLoginOtp(
    senderPhones: string | string[],
    text: string
): { matched: boolean } {
    const code = String(text || "").trim();
    if (!/^\d{4,8}$/.test(code)) return { matched: false };

    cleanupExpiredOtps();

    const candidates = (
        Array.isArray(senderPhones) ? senderPhones : [senderPhones]
    )
        .map((p) => String(p || "").split("@")[0].split(":")[0])
        .filter(Boolean);

    for (const phone of candidates) {
        const ids = phoneToRequests.get(phone);
        if (!ids || !ids.size) continue;

        for (const id of [...ids]) {
            const req = pendingByRequest.get(id);
            if (!req || req.status !== "pending") continue;
            if (Date.now() - req.createdAt > OTP_TTL_MS) {
                dropRequest(req);
                continue;
            }
            if (req.code !== code) continue;

            // Match for verification and mint the session/token.
            const sessionId = `ga:${req.phoneNumber}:${Date.now()}:${crypto
                .randomBytes(4)
                .toString("hex")}`;
            startSession(sessionId);
            const token = signSessionToken({
                sessionId,
                phoneNumber: req.phoneNumber,
                role: "groupadmin",
            });
            req.status = "verified";
            req.token = token;
            req.admin = {
                phoneNumber: req.phoneNumber,
                role: "groupadmin",
                groupCount: req.groupCount,
            };
            unindexPhone(req.phoneNumber, req.requestId);
            logger.info(
                `[group-otp] verified login for +${req.phoneNumber} (matched via ${phone})`
            );
            return { matched: true };
        }
    }

    logger.info(
        `[group-otp] no match for code from [${candidates.join(", ")}] — ` +
            `awaiting numbers: ${[...phoneToRequests.keys()].join(", ") || "none"}`
    );
    return { matched: false };
}

interface OtpRequestBody {
    phoneNumber: string;
}

export async function groupAuthRoutes(fastify: FastifyInstance) {
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

            const botNumber = getBotPhoneNumber(client);
            if (!botNumber) {
                return reply.status(503).send({
                    success: false,
                    message: "Bot number is unavailable. Please try again shortly.",
                });
            }

            let adminGroups: Awaited<ReturnType<typeof findAdminGroupsFromDb>>;
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
                recordIpRequest(requesterIp);
                return reply.status(403).send({
                    success: false,
                    message:
                        "This number is not an admin of any group the bot is in. Group-admin access is unavailable.",
                });
            }

            const requestId = crypto.randomBytes(16).toString("hex");
            const code = generateCode();

            const pending: PendingOtp = {
                requestId,
                phoneNumber,
                code,
                createdAt: Date.now(),
                status: "pending",
                groupCount: adminGroups.length,
                requesterIp,
            };
            pendingByRequest.set(requestId, pending);
            indexPhone(phoneNumber, requestId);
            recordIpRequest(requesterIp);

            return reply.send({
                success: true,
                requestId,
                code,
                botNumber,
                waLink: `https://wa.me/${botNumber}?text=${encodeURIComponent(code)}`,
                expiresInMs: OTP_TTL_MS,
                groupCount: adminGroups.length,
                message:
                    "Send this code from your own WhatsApp to the bot's chat to verify.",
            });
        }
    );

    fastify.get(
        "/otp-status/:requestId",
        async (
            request: FastifyRequest<{ Params: { requestId: string } }>,
            reply: FastifyReply
        ) => {
            cleanupExpiredOtps();
            const { requestId } = request.params;
            const req = pendingByRequest.get(requestId);

            if (!req) {
                return reply.status(404).send({
                    success: false,
                    status: "expired",
                    message: "Request not found or expired. Please start again.",
                });
            }

            if (Date.now() - req.createdAt > OTP_TTL_MS) {
                dropRequest(req);
                return reply.status(410).send({
                    success: false,
                    status: "expired",
                    message: "Code expired. Please generate a new one.",
                });
            }

            if (req.status === "verified") {
                const token = req.token!;
                const admin = req.admin!;
                dropRequest(req);
                return reply.send({ success: true, status: "verified", token, admin });
            }

            return reply.send({
                success: true,
                status: "pending",
                expiresInMs: Math.max(0, OTP_TTL_MS - (Date.now() - req.createdAt)),
            });
        }
    );
}
