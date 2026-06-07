import { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, isSessionActive, touchSession, isIpBlocked } from "../routes/auth";

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    // Block blacklisted IPs on every request
    const fwd = request.headers["x-forwarded-for"];
    const realIp = request.headers["x-real-ip"];
    const requesterIp =
        (typeof fwd === "string" ? fwd.split(",")[0]?.trim() : null) ||
        (typeof realIp === "string" ? realIp : null) ||
        request.ip ||
        "unknown";

    if (isIpBlocked(requesterIp)) {
        return reply.status(403).send({ success: false, message: "Akses dari IP ini diblokir." });
    }

    const publicPaths = [
        "/login.html",
        "/group-admin.html",
        "/api/auth/login",
        "/api/auth/approval-status",
        "/api/auth/logout",
        "/api/group-auth/request-otp",
        "/api/group-auth/otp-status",
        "/api/health",
        "/api/changelog"
    ];

    const staticPaths = ["/js/", "/css/", "/images/", "/favicon.ico"];

    if (publicPaths.some(path => request.url === path || request.url.startsWith(path))) {
        return;
    }

    if (staticPaths.some(path => request.url.startsWith(path))) {
        return;
    }

    if (request.url === "/" || request.url === "/index.html" || !request.url.startsWith("/api/")) {
        return;
    }

    // For API endpoints, enforce token authentication
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.status(401).send({
            success: false,
            message: "Unauthorized - No token provided",
        });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
        return reply.status(401).send({
            success: false,
            message: "Unauthorized - Invalid token",
        });
    }

    if (!decoded?.sessionId || !isSessionActive(decoded.sessionId)) {
        return reply.status(401).send({
            success: false,
            message: "Session expired due to inactivity",
            sessionExpired: true,
        });
    }

    // Role-based scoping: group admins are confined to the group-admin API
    // surface. They must never reach owner/team endpoints (users, config,
    // security, full group control, …).
    if (decoded.role === "groupadmin") {
        const allowedForGroupAdmin =
            request.url.startsWith("/api/group-admin/") ||
            request.url.startsWith("/api/group-auth/") ||
            request.url === "/api/auth/logout" ||
            request.url.startsWith("/api/changelog");
        if (!allowedForGroupAdmin) {
            return reply.status(403).send({
                success: false,
                message: "Forbidden - group admins cannot access this resource.",
            });
        }
    }

    touchSession(decoded.sessionId);
    (request as any).admin = decoded;
}
