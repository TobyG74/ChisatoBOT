import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Database } from "../../infrastructure/database";

const JWT_SECRET = process.env.JWT_SECRET || "chisato-dashboard-secret-key";
const JWT_EXPIRES_IN = "7d";
// Session expires after 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

interface LoginBody {
    username: string;
    password: string;
}

export async function authRoutes(fastify: FastifyInstance) {
    // Login endpoint
    fastify.post("/login", async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
        const { username, password } = request.body;

        if (!username || !password) {
            return reply.status(400).send({
                success: false,
                message: "Username and password are required",
            });
        }

        try {
            const admin = await Database.admin.findUnique({
                where: { username },
            });

            if (!admin) {
                return reply.status(401).send({
                    success: false,
                    message: "Invalid username or password",
                });
            }

            const isValidPassword = await bcrypt.compare(password, admin.password);

            if (!isValidPassword) {
                return reply.status(401).send({
                    success: false,
                    message: "Invalid username or password",
                });
            }

            // Update last activity timestamp
            await Database.admin.update({
                where: { id: admin.id },
                data: { lastActivity: new Date() },
            });

            const token = jwt.sign(
                {
                    id: admin.id,
                    username: admin.username,
                    phoneNumber: admin.phoneNumber,
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            return reply.send({
                success: true,
                message: "Login successful",
                token,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    phoneNumber: admin.phoneNumber,
                },
            });
        } catch (error) {
            console.error("Login error:", error);
            return reply.status(500).send({
                success: false,
                message: "Internal server error",
            });
        }
    });

    // Verify token endpoint
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
            const decoded = jwt.verify(token, JWT_SECRET) as {
                id: string;
                username: string;
                phoneNumber: string;
            };

            // Check session expiry based on lastActivity
            const admin = await Database.admin.findUnique({
                where: { id: decoded.id },
            });

            if (!admin) {
                return reply.status(401).send({
                    success: false,
                    message: "User not found",
                });
            }

            const timeSinceLastActivity = Date.now() - admin.lastActivity.getTime();

            if (timeSinceLastActivity > SESSION_TIMEOUT_MS) {
                return reply.status(401).send({
                    success: false,
                    message: "Session expired due to inactivity",
                    sessionExpired: true,
                });
            }

            // Update last activity
            await Database.admin.update({
                where: { id: admin.id },
                data: { lastActivity: new Date() },
            });

            return reply.send({
                success: true,
                admin: decoded,
            });
        } catch (error) {
            return reply.status(401).send({
                success: false,
                message: "Invalid or expired token",
            });
        }
    });

    // Logout endpoint
    fastify.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({
            success: true,
            message: "Logout successful",
        });
    });
}

// Export JWT verification function for middleware
export function verifyToken(token: string): any {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}
