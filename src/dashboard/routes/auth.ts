import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { getClientInstance } from "../../libs/client/instance";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import { configService } from "../../core/config/config.service";

const JWT_SECRET = process.env.JWT_SECRET || "chisato-dashboard-secret-key";
const JWT_EXPIRES_IN = "7d";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const LOGIN_APPROVAL_TTL_MS = 5 * 60 * 1000;
const APPROVAL_BUTTON_TTL_MS = 1 * 60 * 1000; // WA button expires after 1 minute

type AccessRole = "owner" | "team";
type ApprovalDecision = "approved" | "rejected";

type LoginActionButton = {
    id: string;
    label: string;
    description: string;
};

type DashboardTokenPayload = {
    sessionId: string;
    phoneNumber: string;
    role: AccessRole;
};

type PhoneAccessConfig = {
    ownerNumber: string[];
    teamNumber: string[];
};

type PendingLoginRequest = {
    id: string;
    sessionId: string;
    phoneNumber: string;
    role: AccessRole;
    requesterIp: string;
    status: "pending" | "approved" | "rejected";
    createdAt: number;
    decidedAt?: number;
    decidedBy?: string;
    token: string;
};

interface LoginBody {
    phoneNumber: string;
}

const SESSION_FILE = path.join(process.cwd(), "temp", "dashboard-sessions.json");
const RATE_LIMIT_FILE = path.join(process.cwd(), "temp", "dashboard-ratelimits.json");

// Progressive cooldown durations in milliseconds
const COOLDOWN_STEPS_MS = [
    2  * 60 * 1000,   // attempt 1 → 2 min
    10 * 60 * 1000,   // attempt 2 → 10 min
    30 * 60 * 1000,   // attempt 3 → 30 min
    60 * 60 * 1000,   // attempt 4 → 1 hour
    24 * 60 * 60 * 1000, // attempt 5+ → 1 day
];
// After this many idle minutes without a new request, reset the attempt counter
const RATE_LIMIT_RESET_AFTER_MS = 25 * 60 * 60 * 1000; // 25 hours

type IpRateState = {
    attempts: number;       // how many times this IP has been gated
    cooldownUntil: number;  // epoch ms when cooldown expires
    lastAttempt: number;    // epoch ms of last attempt (for auto-reset)
};

function loadRateLimitsFromFile(): Map<string, IpRateState> {
    try {
        if (fs.existsSync(RATE_LIMIT_FILE)) {
            const data = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, "utf-8")) as Record<string, IpRateState>;
            const now = Date.now();
            const map = new Map<string, IpRateState>();
            for (const [ip, state] of Object.entries(data)) {
                // Drop entries whose last attempt is older than reset window AND cooldown has expired
                if (now - state.lastAttempt < RATE_LIMIT_RESET_AFTER_MS || state.cooldownUntil > now) {
                    map.set(ip, state);
                }
            }
            return map;
        }
    } catch {}
    return new Map();
}

function saveRateLimitsToFile(map: Map<string, IpRateState>): void {
    try {
        const dir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(Object.fromEntries(map)), "utf-8");
    } catch {}
}

const ipRateLimits: Map<string, IpRateState> = loadRateLimitsFromFile();

/**
 * Check if an IP is currently rate-limited.
 * Returns null if allowed, or an object with retryAfterMs + attemptsCount if blocked.
 */
function checkRateLimit(ip: string): { retryAfterMs: number; attempts: number } | null {
    const now = Date.now();
    const state = ipRateLimits.get(ip);
    if (!state) return null;

    // Auto-reset if idle for longer than reset window
    if (now - state.lastAttempt > RATE_LIMIT_RESET_AFTER_MS && state.cooldownUntil <= now) {
        ipRateLimits.delete(ip);
        saveRateLimitsToFile(ipRateLimits);
        return null;
    }

    if (state.cooldownUntil > now) {
        return { retryAfterMs: state.cooldownUntil - now, attempts: state.attempts };
    }
    return null;
}

/**
 * Record a new login attempt from an IP and apply the next cooldown tier.
 * Call this AFTER sending the approval request (so the first legitimate attempt
 * still goes through but subsequent spam is blocked).
 */
function recordLoginAttempt(ip: string): void {
    const now = Date.now();
    const existing = ipRateLimits.get(ip);
    const attempts = existing ? existing.attempts + 1 : 1;
    const stepIndex = Math.min(attempts - 1, COOLDOWN_STEPS_MS.length - 1);
    const cooldownMs = COOLDOWN_STEPS_MS[stepIndex];

    ipRateLimits.set(ip, {
        attempts,
        cooldownUntil: now + cooldownMs,
        lastAttempt: now,
    });
    saveRateLimitsToFile(ipRateLimits);
}

function formatDuration(ms: number): string {
    if (ms >= 60 * 60 * 1000) {
        const h = Math.ceil(ms / (60 * 60 * 1000));
        return `${h} jam`;
    }
    if (ms >= 60 * 1000) {
        const m = Math.ceil(ms / (60 * 1000));
        return `${m} menit`;
    }
    return `${Math.ceil(ms / 1000)} detik`;
}

function loadSessionsFromFile(): Map<string, number> {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
            const now = Date.now();
            const map = new Map<string, number>();
            for (const [k, v] of Object.entries(data as Record<string, number>)) {
                if (now - v < SESSION_TIMEOUT_MS) map.set(k, v);
            }
            return map;
        }
    } catch {}
    return new Map();
}

function saveSessionsToFile(map: Map<string, number>): void {
    try {
        const dir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(map)), "utf-8");
    } catch {}
}

const sessionLastActivity: Map<string, number> = loadSessionsFromFile();
const pendingLoginRequests = new Map<string, PendingLoginRequest>();

function normalizePhoneNumber(raw: string): string {
    const clean = String(raw || "").replace(/[^0-9]/g, "");
    if (!clean) {
        return "";
    }
    if (clean.startsWith("0")) {
        return `62${clean.slice(1)}`;
    }
    return clean;
}

function readPhoneAccessConfig(): PhoneAccessConfig {
    try {
        const raw = fs.readFileSync("./config.json", "utf-8");
        const parsed = JSON.parse(raw) as Partial<PhoneAccessConfig>;
        return {
            ownerNumber: Array.isArray(parsed.ownerNumber)
                ? parsed.ownerNumber.map(normalizePhoneNumber)
                : [],
            teamNumber: Array.isArray(parsed.teamNumber)
                ? parsed.teamNumber.map(normalizePhoneNumber)
                : [],
        };
    } catch {
        return { ownerNumber: [], teamNumber: [] };
    }
}

function getAccessRole(phoneNumber: string): AccessRole | null {
    const config = readPhoneAccessConfig();

    if (config.ownerNumber.includes(phoneNumber)) {
        return "owner";
    }

    if (config.teamNumber.includes(phoneNumber)) {
        return "team";
    }

    return null;
}

function buildLoginButtons(role: AccessRole): LoginActionButton[] {
    if (role === "owner") {
        return [
            {
                id: "open-dashboard",
                label: "Masuk Dashboard",
                description: "Akses penuh owner untuk monitoring & kontrol",
            },
            {
                id: "owner-controls",
                label: "Owner Controls",
                description: "Kelola user, group, dan settings sistem",
            },
        ];
    }

    return [
        {
            id: "open-dashboard",
            label: "Masuk Dashboard",
            description: "Akses tim untuk monitoring operasional",
        },
        {
            id: "team-monitoring",
            label: "Team Monitoring",
            description: "Pantau statistik, log, dan status bot",
        },
    ];
}

function getRequesterIp(request: FastifyRequest): string {
    const fwd = request.headers["x-forwarded-for"];
    const realIp = request.headers["x-real-ip"];

    if (typeof fwd === "string" && fwd.length > 0) {
        return fwd.split(",")[0]?.trim() || "unknown";
    }

    if (typeof realIp === "string" && realIp.length > 0) {
        return realIp;
    }

    return request.ip || "unknown";
}

function cleanupPendingLoginRequests(): void {
    const now = Date.now();
    for (const [id, req] of pendingLoginRequests.entries()) {
        if (now - req.createdAt > LOGIN_APPROVAL_TTL_MS) {
            pendingLoginRequests.delete(id);
        }
    }
}

function setSessionActivity(sessionId: string): void {
    sessionLastActivity.set(sessionId, Date.now());
    saveSessionsToFile(sessionLastActivity);
}

function createPendingLoginRequest(
    phoneNumber: string,
    role: AccessRole,
    requesterIp: string,
    token: string,
    sessionId: string
): PendingLoginRequest {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const req: PendingLoginRequest = {
        id,
        sessionId,
        phoneNumber,
        role,
        requesterIp,
        status: "pending",
        createdAt: Date.now(),
        token,
    };

    pendingLoginRequests.set(id, req);
    return req;
}

async function sendOwnerApprovalButtons(
    loginPhone: string,
    role: AccessRole,
    approvalId: string,
    requesterIp: string
): Promise<void> {
    const client = getClientInstance();
    if (!client) {
        return;
    }

    const config = readPhoneAccessConfig();
    if (!config.ownerNumber.length) {
        return;
    }

    const roleLabel = role === "owner" ? "OWNER" : "TEAM";
    const prefix = configService.getConfig().prefix || ".";

    const body =
        `Notifikasi Login Dashboard\n\n` +
        `Nomor: +${loginPhone}\n` +
        `Role: ${roleLabel}\n` +
        `IP: ${requesterIp}\n\n` +
        `Apakah kamu sedang melakukan login?`;

    for (const ownerNumber of config.ownerNumber) {
        const ownerJid = `${ownerNumber}@s.whatsapp.net`;
        try {
            const builder = new TemplateBuilder.Native(client as any);
            const msg = await builder
                .mainBody(body)
                .mainFooter("Dashboard Approval Required")
                .buttons(
                    builder.button.reply({
                        display: "Accept",
                        id: `${prefix}dashboardapprove ${approvalId}`,
                    }),
                    builder.button.reply({
                        display: "Reject",
                        id: `${prefix}dashboardreject ${approvalId}`,
                    })
                )
                .render();

            await (client as any).relayMessage(ownerJid, msg.message, {
                messageId: msg.key.id,
            });
        } catch (error) {
            // Fallback to simple text when native interactive is unsupported
            try {
                await (client as any).sendText(
                    ownerJid,
                    `${body}\n\nAccept: ${prefix}dashboardapprove ${approvalId}\nReject: ${prefix}dashboardreject ${approvalId}`
                );
            } catch (fallbackErr) {
                console.error(`Failed to send approval to ${ownerJid}:`, fallbackErr);
            }
            console.error(`Failed to send native approval to ${ownerJid}:`, error);
        }
    }
}

export function handleLoginApproval(
    approvalId: string,
    decision: ApprovalDecision,
    ownerNumber: string
): { ok: boolean; message: string; loginPhone?: string; ip?: string } {
    cleanupPendingLoginRequests();
    const req = pendingLoginRequests.get(approvalId);

    if (!req) {
        return { ok: false, message: "Request approval tidak ditemukan atau sudah expired." };
    }

    if (req.status !== "pending") {
        return {
            ok: false,
            message: `Request ini sudah ${req.status === "approved" ? "di-approve" : "ditolak"}.`,
            loginPhone: req.phoneNumber,
            ip: req.requesterIp,
        };
    }

    // Check 1-minute button expiry for WhatsApp approval action
    if (Date.now() - req.createdAt > APPROVAL_BUTTON_TTL_MS) {
        pendingLoginRequests.delete(approvalId);
        return {
            ok: false,
            message: `Sesi approval sudah expired. Tombol hanya berlaku 1 menit sejak permintaan dikirim.`,
            loginPhone: req.phoneNumber,
            ip: req.requesterIp,
        };
    }

    req.status = decision;
    req.decidedAt = Date.now();
    req.decidedBy = ownerNumber;

    if (decision === "approved") {
        setSessionActivity(req.sessionId);
    }

    return {
        ok: true,
        message:
            decision === "approved"
                ? `Login +${req.phoneNumber} dari IP ${req.requesterIp} berhasil di-approve.`
                : `Login +${req.phoneNumber} dari IP ${req.requesterIp} ditolak.`,
        loginPhone: req.phoneNumber,
        ip: req.requesterIp,
    };
}

export async function authRoutes(fastify: FastifyInstance) {
    fastify.post("/login", async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
        cleanupPendingLoginRequests();

        const { phoneNumber } = request.body;
        const normalizedPhone = normalizePhoneNumber(phoneNumber);

        if (!normalizedPhone) {
            return reply.status(400).send({
                success: false,
                message: "Nomor HP wajib diisi",
            });
        }

        const requesterIp = getRequesterIp(request);

        // ── IP rate-limit check ───────────────────────────────────────────────
        const rateLimited = checkRateLimit(requesterIp);
        if (rateLimited) {
            return reply.status(429).send({
                success: false,
                rateLimited: true,
                retryAfterMs: rateLimited.retryAfterMs,
                message: `Terlalu banyak percobaan login dari IP ini. Coba lagi dalam ${formatDuration(rateLimited.retryAfterMs)}.`,
            });
        }

        try {
            const role = getAccessRole(normalizedPhone);

            if (!role) {
                // Still count attempts for unrecognised numbers to deter enumeration
                recordLoginAttempt(requesterIp);
                return reply.status(403).send({
                    success: false,
                    message: "Nomor ini bukan owner/team dan tidak memiliki akses dashboard",
                });
            }

            const sessionId = `${normalizedPhone}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
            const token = jwt.sign(
                {
                    sessionId,
                    phoneNumber: normalizedPhone,
                    role,
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            const pending = createPendingLoginRequest(
                normalizedPhone,
                role,
                requesterIp,
                token,
                sessionId
            );

            await sendOwnerApprovalButtons(normalizedPhone, role, pending.id, requesterIp);

            // Record this attempt — next request from the same IP will face a cooldown
            recordLoginAttempt(requesterIp);

            return reply.send({
                success: true,
                approvalRequired: true,
                approvalId: pending.id,
                message: "Permintaan login dikirim ke owner untuk approval.",
                admin: { phoneNumber: normalizedPhone, role },
                buttons: buildLoginButtons(role),
            });
        } catch (error) {
            console.error("Login error:", error);
            return reply.status(500).send({
                success: false,
                message: "Internal server error",
            });
        }
    });

    fastify.get(
        "/approval-status/:approvalId",
        async (
            request: FastifyRequest<{ Params: { approvalId: string } }>,
            reply: FastifyReply
        ) => {
            cleanupPendingLoginRequests();
            const approvalId = request.params.approvalId;
            const pending = pendingLoginRequests.get(approvalId);

            if (!pending) {
                return reply.status(404).send({
                    success: false,
                    status: "expired",
                    message: "Request approval tidak ditemukan atau sudah expired.",
                });
            }

            if (pending.status === "pending") {
                return reply.send({
                    success: true,
                    status: "pending",
                    message: "Menunggu approval owner...",
                });
            }

            if (pending.status === "rejected") {
                pendingLoginRequests.delete(approvalId);
                return reply.status(403).send({
                    success: false,
                    status: "rejected",
                    message: "Login ditolak oleh owner.",
                });
            }

            pendingLoginRequests.delete(approvalId);
            return reply.send({
                success: true,
                status: "approved",
                message: "Login disetujui owner.",
                token: pending.token,
                admin: {
                    phoneNumber: pending.phoneNumber,
                    role: pending.role,
                },
            });
        }
    );

    fastify.get("/verify", async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.status(401).send({
                success: false,
                message: "No token provided",
            });
        }

        const token = authHeader.substring(7);

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as DashboardTokenPayload;

            if (!decoded?.sessionId || !isSessionActive(decoded.sessionId)) {
                return reply.status(401).send({
                    success: false,
                    message: "Session expired due to inactivity",
                    sessionExpired: true,
                });
            }

            touchSession(decoded.sessionId);

            return reply.send({
                success: true,
                admin: {
                    phoneNumber: decoded.phoneNumber,
                    role: decoded.role,
                },
            });
        } catch {
            return reply.status(401).send({
                success: false,
                message: "Invalid or expired token",
            });
        }
    });

    fastify.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token) as DashboardTokenPayload | null;
            if (decoded?.sessionId) {
                sessionLastActivity.delete(decoded.sessionId);
            }
        }

        return reply.send({
            success: true,
            message: "Logout successful",
        });
    });
}

export function verifyToken(token: string): any {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

export function isSessionActive(sessionId: string): boolean {
    const lastActivity = sessionLastActivity.get(sessionId);

    if (!lastActivity) {
        return false;
    }

    if (Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
        sessionLastActivity.delete(sessionId);
        return false;
    }

    return true;
}

export function touchSession(sessionId: string): void {
    if (isSessionActive(sessionId)) {
        setSessionActivity(sessionId);
    }
}
