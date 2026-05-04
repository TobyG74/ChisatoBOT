import { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, isSessionActive, touchSession } from "../routes/auth";

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const publicPaths = [
        "/login.html", 
        "/api/auth/login", 
        "/api/auth/approval-status",
        "/api/auth/logout",
        "/api/health"
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

    touchSession(decoded.sessionId);
    (request as any).admin = decoded;
}
