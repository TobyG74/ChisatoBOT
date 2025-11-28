import { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";

// Log file path
const LOG_FILE = path.join(process.cwd(), "temp", "dashboard-logs.json");
const MAX_LOGS = 1000; // Keep only last 1000 logs

// In-memory log storage
const logs: Array<{
    id: string;
    timestamp: Date;
    level: string;
    message: string;
    metadata?: any;
}> = [];

let logIdCounter = 1;

// Ensure temp directory exists
function ensureTempDir(): void {
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
}

// Load logs from file on startup
function loadLogs(): void {
    try {
        ensureTempDir();
        if (fs.existsSync(LOG_FILE)) {
            const data = fs.readFileSync(LOG_FILE, "utf-8");
            const savedLogs = JSON.parse(data);
            
            // Convert timestamp strings back to Date objects
            savedLogs.forEach((log: any) => {
                logs.push({
                    ...log,
                    timestamp: new Date(log.timestamp),
                });
            });
            
            // Set counter to continue from last ID
            if (logs.length > 0) {
                const lastId = logs[logs.length - 1].id;
                const match = lastId.match(/log-(\d+)/);
                if (match) {
                    logIdCounter = parseInt(match[1]) + 1;
                }
            }
            
            console.log(`[Dashboard] Loaded ${logs.length} logs from file`);
        }
    } catch (error) {
        console.error("[Dashboard] Failed to load logs:", error);
    }
}

// Save logs to file
function saveLogs(): void {
    try {
        ensureTempDir();
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), "utf-8");
    } catch (error) {
        console.error("[Dashboard] Failed to save logs:", error);
    }
}

// Debounced save function
let saveTimeout: NodeJS.Timeout | null = null;
function debouncedSave(): void {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
        saveLogs();
        saveTimeout = null;
    }, 1000); 
}

// Load logs on module initialization
loadLogs();

export function addLog(level: string, message: string, metadata?: any): void {
    logs.push({
        id: `log-${logIdCounter++}`,
        timestamp: new Date(),
        level,
        message,
        metadata,
    });

    // Keep only last 1000 logs in memory and file
    if (logs.length > MAX_LOGS) {
        logs.shift();
    }
    
    // Save to file 
    debouncedSave();
}

// Force save on process exit
process.on("exit", () => {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveLogs();
    console.log("[Dashboard] Logs saved on exit");
});

process.on("SIGINT", () => {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveLogs();
    console.log("[Dashboard] Logs saved on SIGINT");
    process.exit(0);
});

process.on("SIGTERM", () => {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveLogs();
    console.log("[Dashboard] Logs saved on SIGTERM");
    process.exit(0);
});

export async function logsRoutes(fastify: FastifyInstance) {
    // Get recent logs
    fastify.get("/", async (request, reply) => {
        try {
            const {
                page = 1,
                limit = 50,
                level,
            } = request.query as {
                page?: number;
                limit?: number;
                level?: string;
            };

            let filteredLogs = logs;
            if (level) {
                filteredLogs = logs.filter((log) => log.level === level);
            }

            const skip = (Number(page) - 1) * Number(limit);
            const paginatedLogs = filteredLogs
                .slice()
                .reverse()
                .slice(skip, skip + Number(limit));

            return {
                logs: paginatedLogs,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: filteredLogs.length,
                    totalPages: Math.ceil(filteredLogs.length / Number(limit)),
                },
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch logs" });
        }
    });

    // Get log statistics
    fastify.get("/stats", async (request, reply) => {
        try {
            const levelCounts: { [key: string]: number } = {};
            logs.forEach((log) => {
                levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
            });

            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentLogs = logs.filter(
                (log) => log.timestamp >= oneHourAgo
            );

            return {
                total: logs.length,
                byLevel: levelCounts,
                lastHour: recentLogs.length,
                oldestLog: logs[0] ? logs[0].timestamp.toISOString() : null,
                newestLog: logs[logs.length - 1]
                    ? logs[logs.length - 1].timestamp.toISOString()
                    : null,
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch log stats" });
        }
    });

    // Clear logs
    fastify.delete("/", async (request, reply) => {
        try {
            logs.length = 0;
            logIdCounter = 1;
            
            if (fs.existsSync(LOG_FILE)) {
                fs.unlinkSync(LOG_FILE);
            }
            
            return { message: "Logs cleared successfully" };
        } catch (error) {
            reply.status(500).send({ error: "Failed to clear logs" });
        }
    });
}
