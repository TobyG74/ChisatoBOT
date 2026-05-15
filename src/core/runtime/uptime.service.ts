import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

/**
 * Persisted uptime tracking.
 */
const STATE_PATH = resolve(process.cwd(), "temp/.bot-uptime.json");
const HEARTBEAT_INTERVAL_MS = 30_000;
// If the previous heartbeat is older than this, the prior process is
// considered dead-and-buried, not a recent restart, so uptime resets.
const STALE_THRESHOLD_MS = 5 * 60_000;

interface UptimeState {
    startedAt: number;
    heartbeatAt: number;
}

let logicalStart: number = Date.now();
let heartbeatTimer: NodeJS.Timeout | null = null;

function readState(): UptimeState | null {
    if (!existsSync(STATE_PATH)) return null;
    try {
        const j = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
        if (typeof j?.startedAt === "number" && typeof j?.heartbeatAt === "number") {
            return j as UptimeState;
        }
    } catch { /* corrupt file → start fresh */ }
    return null;
}

function writeState(state: UptimeState): void {
    try {
        mkdirSync(dirname(STATE_PATH), { recursive: true });
        writeFileSync(STATE_PATH, JSON.stringify(state), "utf-8");
    } catch { /* best-effort */ }
}

/** Initialise uptime tracking. Call once at the very top of bot startup. */
export function initUptime(): void {
    const prior = readState();
    const now = Date.now();

    if (prior && now - prior.heartbeatAt <= STALE_THRESHOLD_MS) {
        logicalStart = prior.startedAt;
    } else {
        logicalStart = now;
    }

    // Touch the file immediately so a crash within the first 30 s still
    // records this process as recently alive.
    writeState({ startedAt: logicalStart, heartbeatAt: now });

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        writeState({ startedAt: logicalStart, heartbeatAt: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref?.();   // don't keep the process alive solely for the timer
}

/** Logical first-boot timestamp (ms epoch), preserved across auto-restarts. */
export function getLogicalStart(): number {
    return logicalStart;
}

/** Logical uptime in seconds — drop-in replacement for `process.uptime()`. */
export function getLogicalUptimeSeconds(): number {
    return Math.max(0, (Date.now() - logicalStart) / 1000);
}

/** Force a heartbeat write (used right before an intentional restart). */
export function persistHeartbeat(): void {
    writeState({ startedAt: logicalStart, heartbeatAt: Date.now() });
}
