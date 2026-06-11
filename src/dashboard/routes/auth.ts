import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { getClientInstance } from "../../libs/client/instance";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import { configService } from "../../core/config/config.service";
import { ipSecurityService, type IpRole } from "../services/ip-security.service";

const JWT_SECRET = process.env.JWT_SECRET || "chisato-dashboard-secret-key";
/**
 * Absolute session lifetime — a login stays valid for 30 days from approval,
 * so reopening the browser/domain doesn't force a re-login.
 */
const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Idle (sliding) timeout — also 30 days, effectively "remember me". */
const SESSION_IDLE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;
/** JWT lifetime mirrors the absolute session lifetime so a stolen token can't outlive the session. */
const JWT_EXPIRES_IN = "30d";
const LOGIN_APPROVAL_TTL_MS = 5 * 60 * 1000;
export const APPROVAL_BUTTON_TTL_MS = 1 * 60 * 1000; // WA button expires after 1 minute

type AccessRole = "owner" | "team";
type ApprovalDecision = "approved" | "rejected";
type ApprovalAction = "whitelist" | "block";

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

type SessionRecord = {
    createdAt: number;
    lastActivity: number;
};

function isSessionStillValid(record: SessionRecord, now: number = Date.now()): boolean {
    if (now - record.createdAt > SESSION_ABSOLUTE_TTL_MS) return false;
    if (now - record.lastActivity > SESSION_IDLE_TIMEOUT_MS) return false;
    return true;
}

function loadSessionsFromFile(): Map<string, SessionRecord> {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
            const now = Date.now();
            const map = new Map<string, SessionRecord>();
            for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
                let record: SessionRecord | null = null;
                if (typeof v === "number") {
                    // Legacy format: only the last activity timestamp was stored.
                    record = { createdAt: v, lastActivity: v };
                } else if (
                    v &&
                    typeof v === "object" &&
                    typeof (v as any).createdAt === "number" &&
                    typeof (v as any).lastActivity === "number"
                ) {
                    record = {
                        createdAt: (v as any).createdAt,
                        lastActivity: (v as any).lastActivity,
                    };
                }
                if (record && isSessionStillValid(record, now)) {
                    map.set(k, record);
                }
            }
            return map;
        }
    } catch {}
    return new Map();
}

function saveSessionsToFile(map: Map<string, SessionRecord>): void {
    try {
        const dir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(map)), "utf-8");
    } catch {}
}

const sessionStore: Map<string, SessionRecord> = loadSessionsFromFile();
const pendingLoginRequests = new Map<string, PendingLoginRequest>();

export function normalizePhoneNumber(raw: string): string {
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

export function isIpBlocked(ip: string): boolean {
    return ipSecurityService.isBlocked(ip);
}

export function isIpWhitelisted(ip: string): boolean {
    return ipSecurityService.isWhitelisted(ip);
}

function buildLoginButtons(role: AccessRole): LoginActionButton[] {
    if (role === "owner") {
        return [
            {
                id: "open-dashboard",
                label: "Open Dashboard",
                description: "Full access for owner to monitor & control",
            },
            {
                id: "owner-controls",
                label: "Owner Controls",
                description: "Manage users, groups, and system settings",
            },
        ];
    }

    return [
        {
            id: "open-dashboard",
            label: "Open Dashboard",
            description: "Access the dashboard with team member privileges",
        },
        {
            id: "team-monitoring",
            label: "Team Monitoring",
            description: "Monitor statistics, logs, and bot status",
        },
    ];
}

export function getRequesterIp(request: FastifyRequest): string {
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

export function startSession(sessionId: string): void {
    const now = Date.now();
    sessionStore.set(sessionId, { createdAt: now, lastActivity: now });
    saveSessionsToFile(sessionStore);
}

/**
 * Sign a dashboard session JWT. Shared by the owner/team login flow and the
 * group-admin OTP flow so every token is verifiable by the same middleware.
 */
export function signSessionToken(payload: Record<string, unknown>): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** Remove a session (used on explicit logout from any flow). */
export function endSession(sessionId: string): void {
    sessionStore.delete(sessionId);
    saveSessionsToFile(sessionStore);
}

function touchSessionActivity(sessionId: string): void {
    const record = sessionStore.get(sessionId);
    if (!record) return;
    record.lastActivity = Date.now();
    saveSessionsToFile(sessionStore);
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

async function sendApprovalRequest(
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

    const prefix = configService.getConfig().prefix || ".";
    const time = new Date().toLocaleString("id-ID", {
        timeZone: configService.getConfig().timeZone || "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    // Buttons + decision messages always go to the owner numbers — both for
    // owner self-logins and for team logins. For team logins the owner sees a
    // single combined message that says "team is logging in" plus the
    // Allow/Block buttons.
    const approvalTargets = [...config.ownerNumber];

    const approvalBody =
        role === "team"
            ? `🔔 *Team Login — Action Required*\n\n` +
              `A *team* member is signing in to the ChisatoBOT Dashboard. ` +
              `Only you (owner) can approve or block this login.\n\n` +
              `📱 *Team Number:* +${loginPhone}\n` +
              `🌐 *IP Address:* ${requesterIp}\n` +
              `🕐 *Time:* ${time}\n\n` +
              `Tap *Allow & Whitelist* to approve and remember this IP as a team IP.\n` +
              `Tap *Block IP* to reject and add the IP to the team blocklist.\n\n` +
              `_This button is valid for 1 minute._`
            : `🔐 *Did You Login From a New Device or Location?*\n\n` +
              `I noticed a new login attempt to your ChisatoBOT Dashboard.\n\n` +
              `📱 *Account:* +${loginPhone}\n` +
              `👤 *Role:* Owner\n` +
              `🌐 *IP Address:* ${requesterIp}\n` +
              `🕐 *Time:* ${time}\n\n` +
              `If this was *you*, tap *Allow & Whitelist* to grant access — the IP will be remembered for next time.\n` +
              `If you *don't recognize* this, tap *Block IP* to deny it and add the IP to the blocklist.\n\n` +
              `_This button is valid for 1 minute._`;

    for (const targetNumber of approvalTargets) {
        const targetJid = `${targetNumber}@s.whatsapp.net`;
        try {
            const builder = new TemplateBuilder.Native(client as any);
            const msg = await builder
                .mainBody(approvalBody)
                .mainFooter("ChisatoBOT Dashboard Security")
                .buttons(
                    builder.button.reply({
                        display: "✅ Allow & Whitelist",
                        id: `${prefix}dashboardapprove ${approvalId}`,
                    }),
                    builder.button.reply({
                        display: "🚫 Block IP",
                        id: `${prefix}dashboardreject ${approvalId}`,
                    })
                )
                .render();

            await (client as any).relayMessage(targetJid, msg.message, {
                messageId: msg.key.id,
            });
        } catch (error) {
            // Fallback to simple text when native interactive is unsupported
            try {
                await (client as any).sendText(
                    targetJid,
                    `${approvalBody}\n\n✅ Allow & Whitelist: ${prefix}dashboardapprove ${approvalId}\n🚫 Block IP: ${prefix}dashboardreject ${approvalId}`
                );
            } catch (fallbackErr) {
                console.error(`Failed to send approval to ${targetJid}:`, fallbackErr);
            }
            console.error(`Failed to send native approval to ${targetJid}:`, error);
        }
    }
}

async function notifyTeamMemberOfDecision(
    loginPhone: string,
    requesterIp: string,
    action: ApprovalAction
): Promise<void> {
    const client = getClientInstance();
    if (!client) return;
    const teamJid = `${loginPhone}@s.whatsapp.net`;
    const body =
        action === "whitelist"
            ? `✅ Your dashboard login from IP \`${requesterIp}\` has been approved by the owner. You can now continue on the login page.`
            : `🚫 Your dashboard login from IP \`${requesterIp}\` has been rejected by the owner. The IP has been added to the team blocklist.`;
    try {
        await (client as any).sendText(teamJid, body);
    } catch (err) {
        console.error(`Failed to notify team member ${teamJid}:`, err);
    }
}

export type LoginApprovalResult = {
    ok: boolean;
    message: string;
    loginPhone?: string;
    ip?: string;
    role?: AccessRole;
    action?: ApprovalAction;
    /** When true, the team member needs an out-of-band notification of the decision. */
    notifyTeamMember?: boolean;
};

export function getPendingLoginRequest(approvalId: string):
    | { phoneNumber: string; role: AccessRole; status: PendingLoginRequest["status"]; createdAt: number }
    | null {
    const req = pendingLoginRequests.get(approvalId);
    if (!req) return null;
    return {
        phoneNumber: req.phoneNumber,
        role: req.role,
        status: req.status,
        createdAt: req.createdAt,
    };
}

export async function handleLoginApproval(
    approvalId: string,
    action: ApprovalAction,
    actorPhone: string
): Promise<LoginApprovalResult> {
    cleanupPendingLoginRequests();
    const req = pendingLoginRequests.get(approvalId);

    if (!req) {
        return { ok: false, message: "Request approval tidak ditemukan atau sudah expired." };
    }

    // Only owner numbers may approve/reject — team members no longer
    // self-approve. The decision message is also routed to owner only.
    const config = readPhoneAccessConfig();
    if (!config.ownerNumber.includes(actorPhone)) {
        return {
            ok: false,
            message: "Only the owner can approve or reject dashboard login requests.",
            loginPhone: req.phoneNumber,
            ip: req.requesterIp,
            role: req.role,
        };
    }

    if (req.status !== "pending") {
        return {
            ok: false,
            message: `This request has already been ${req.status === "approved" ? "approved" : "rejected"}.`,
            loginPhone: req.phoneNumber,
            ip: req.requesterIp,
            role: req.role,
        };
    }

    if (Date.now() - req.createdAt > APPROVAL_BUTTON_TTL_MS) {
        pendingLoginRequests.delete(approvalId);
        return {
            ok: false,
            message: `Approval session has expired. The button is only valid for 1 minute after the request is sent.`,
            loginPhone: req.phoneNumber,
            ip: req.requesterIp,
            role: req.role,
        };
    }

    const decision: ApprovalDecision = action === "whitelist" ? "approved" : "rejected";
    req.status = decision;
    req.decidedAt = Date.now();
    req.decidedBy = actorPhone;

    if (decision === "approved") {
        startSession(req.sessionId);
    }

    // Persist IP decision tagged with the requester's role.
    const ipRole: IpRole = req.role; // owner | team
    try {
        if (action === "whitelist") {
            await ipSecurityService.addToWhitelist(req.requesterIp, ipRole);
        } else {
            await ipSecurityService.addToBlacklist(req.requesterIp, ipRole);
        }
    } catch (err) {
        console.error("Failed to update IP list after approval:", err);
    }

    return {
        ok: true,
        message:
            action === "whitelist"
                ? `Login +${req.phoneNumber} from IP ${req.requesterIp} approved and whitelisted (${req.role}).`
                : `Login +${req.phoneNumber} from IP ${req.requesterIp} rejected and IP added to blocklist (${req.role}).`,
        loginPhone: req.phoneNumber,
        ip: req.requesterIp,
        role: req.role,
        action,
        // The dashboard polling already drives the team member's UI, so an
        // out-of-band WhatsApp notice is just a friendly extra signal.
        notifyTeamMember: req.role === "team",
    };
}

export async function notifyTeamApprovalDecision(
    result: LoginApprovalResult
): Promise<void> {
    if (!result.ok || !result.notifyTeamMember || !result.loginPhone || !result.ip || !result.action) {
        return;
    }
    await notifyTeamMemberOfDecision(result.loginPhone, result.ip, result.action);
}

export async function authRoutes(fastify: FastifyInstance) {
    fastify.post("/login", async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
        cleanupPendingLoginRequests();

        const { phoneNumber } = request.body;
        const normalizedPhone = normalizePhoneNumber(phoneNumber);

        if (!normalizedPhone) {
            return reply.status(400).send({
                success: false,
                message: "Phone number is required and must contain only digits, optionally starting with 0 or country code.",
            });
        }

        const requesterIp = getRequesterIp(request);

        // IP blacklist check — block before anything else
        if (isIpBlocked(requesterIp)) {
            return reply.status(403).send({
                success: false,
                message: "Access from this IP is blocked.",
            });
        }

        // Config readiness check - if no owner/team numbers are configured, block login attempts and inform about config issue 
        const accessConfig = readPhoneAccessConfig();
        if (accessConfig.ownerNumber.length === 0 && accessConfig.teamNumber.length === 0) {
            return reply.status(503).send({
                success: false,
                configNotReady: true,
                message: "Login feature is not available yet, please check the config file. No owner or team numbers are configured.",
            });
        }

        // IP rate-limit check 
        const rateLimited = checkRateLimit(requesterIp);
        if (rateLimited) {
            return reply.status(429).send({
                success: false,
                rateLimited: true,
                retryAfterMs: rateLimited.retryAfterMs,
                message: `Too many login attempts from this IP. Try again in ${formatDuration(rateLimited.retryAfterMs)}.`,
            });
        }

        try {
            const role = getAccessRole(normalizedPhone);

            if (!role) {
                // Still count attempts for unrecognised numbers to deter enumeration
                recordLoginAttempt(requesterIp);
                return reply.status(403).send({
                    success: false,
                    message: "This number is not an owner/team member and does not have dashboard access.",
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

            // IP whitelist — only auto-approve when the whitelist role matches
            // the login role. Legacy "unknown" entries are accepted for any
            // role to avoid locking out previously whitelisted IPs.
            const whitelistRole = ipSecurityService.getRole(requesterIp, "whitelist");
            if (whitelistRole !== null) {
                const isRoleMatch =
                    whitelistRole === "unknown" || whitelistRole === role;
                if (!isRoleMatch) {
                    // Cross-role attempt — record the rejection as a rate-limit
                    // hit so repeated probing is throttled.
                    recordLoginAttempt(requesterIp);
                    return reply.status(403).send({
                        success: false,
                        roleMismatch: true,
                        ipRole: whitelistRole,
                        loginRole: role,
                        message: `This IP is whitelisted for the "${whitelistRole}" role, but the number you entered is registered as "${role}". Login rejected.`,
                    });
                }

                startSession(sessionId);
                // Clear any previous rate limit record for this IP
                ipRateLimits.delete(requesterIp);
                saveRateLimitsToFile(ipRateLimits);
                return reply.send({
                    success: true,
                    approvalRequired: false,
                    whitelisted: true,
                    token,
                    message: "Login automatically approved (IP whitelisted).",
                    admin: { phoneNumber: normalizedPhone, role },
                });
            }

            // Approval requires an owner to respond — if none are configured, reject early
            const approvalConfig = readPhoneAccessConfig();
            if (!approvalConfig.ownerNumber.length) {
                return reply.status(503).send({
                    success: false,
                    configNotReady: true,
                    message: "Login approval cannot be sent because no owner number has been configured. Please set the owner number first.",
                });
            }

            const pending = createPendingLoginRequest(
                normalizedPhone,
                role,
                requesterIp,
                token,
                sessionId
            );

            await sendApprovalRequest(normalizedPhone, role, pending.id, requesterIp);

            // Record this attempt = next request from the same IP will face a cooldown
            recordLoginAttempt(requesterIp);

            return reply.send({
                success: true,
                approvalRequired: true,
                approvalId: pending.id,
                approvalExpiresInMs: APPROVAL_BUTTON_TTL_MS,
                message: "Login request sent for approval.",
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
                    message: "Approval request not found or has expired.",
                });
            }

            if (pending.status === "pending") {
                // If the 1-minute button window has elapsed without a decision,
                // treat the request as expired and clean it up.
                if (Date.now() - pending.createdAt > APPROVAL_BUTTON_TTL_MS) {
                    pendingLoginRequests.delete(approvalId);
                    return reply.status(410).send({
                        success: false,
                        status: "expired",
                        message:
                            "Approval window has expired (1 minute). Please request approval again.",
                    });
                }
                return reply.send({
                    success: true,
                    status: "pending",
                    message: "Waiting for approval...",
                    expiresInMs: Math.max(
                        0,
                        APPROVAL_BUTTON_TTL_MS - (Date.now() - pending.createdAt)
                    ),
                });
            }

            if (pending.status === "rejected") {
                pendingLoginRequests.delete(approvalId);
                return reply.status(403).send({
                    success: false,
                    status: "rejected",
                    message: "Login was rejected and the IP has been added to the blocklist.",
                });
            }

            pendingLoginRequests.delete(approvalId);
            // Clear rate limit on successful login so the user isn't locked out
            if (pending.requesterIp) {
                ipRateLimits.delete(pending.requesterIp);
                saveRateLimitsToFile(ipRateLimits);
            }
            return reply.send({
                success: true,
                status: "approved",
                message: "Login approved by owner.",
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
                    message: "Session expired. Please sign in again.",
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
                sessionStore.delete(decoded.sessionId);
                saveSessionsToFile(sessionStore);
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
    const record = sessionStore.get(sessionId);

    if (!record) {
        return false;
    }

    if (!isSessionStillValid(record)) {
        sessionStore.delete(sessionId);
        saveSessionsToFile(sessionStore);
        return false;
    }

    return true;
}

export function touchSession(sessionId: string): void {
    if (isSessionActive(sessionId)) {
        touchSessionActivity(sessionId);
    }
}
