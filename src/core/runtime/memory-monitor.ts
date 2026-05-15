import { logger } from "../logger";
import { persistHeartbeat } from "./uptime.service";

export interface MemoryMonitorOptions {
    /** Threshold in bytes (default 1 GB). Restart when `process.memoryUsage().rss` exceeds this. */
    threshold?: number;
    /** How often to sample memory usage, in ms (default 30 s). */
    interval?: number;
    /**
     * How many consecutive samples must exceed the threshold before we
     * actually restart. Avoids tripping on a single transient spike
     * (e.g. while encoding several large PNGs in parallel).
     */
    sustainedSamples?: number;
    /** Optional async cleanup before exiting (e.g. close DB, flush logs). */
    onBeforeRestart?: () => Promise<void> | void;
}

/**
 * Periodically check RSS memory and trigger a process exit when it stays
 * above `threshold` for `sustainedSamples` consecutive checks. The process
 * supervisor (PM2 / systemd / Docker restart-policy) is responsible for
 * actually starting a new process — Node alone can't relaunch itself
 * portably without spawning a wrapper.
 *
 * When using `npm run pm2:start` this Just Works: PM2 restarts on exit(1).
 *
 * The persisted uptime state (see uptime.service.ts) ensures the new
 * process reports the same boot time, so users see uninterrupted runtime.
 */
export function startMemoryMonitor(opts: MemoryMonitorOptions = {}): NodeJS.Timeout {
    const threshold = opts.threshold ?? 1024 * 1024 * 1024;   // 1 GB
    const interval = opts.interval ?? 30_000;
    const sustainedSamples = Math.max(1, opts.sustainedSamples ?? 2);

    let aboveCount = 0;
    let triggered = false;

    const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

    const timer = setInterval(async () => {
        if (triggered) return;
        const rss = process.memoryUsage().rss;

        if (rss < threshold) {
            if (aboveCount > 0) aboveCount = 0;     // reset on dip below threshold
            return;
        }

        aboveCount++;
        logger.warn(
            `Memory usage ${fmtMB(rss)} ≥ ${fmtMB(threshold)} ` +
            `(${aboveCount}/${sustainedSamples} consecutive samples)`
        );

        if (aboveCount < sustainedSamples) return;

        triggered = true;
        logger.warn(
            `Memory threshold sustained — restarting process. ` +
            `Logical uptime will be preserved.`
        );

        // Make sure the next process recognises us as a recent restart so it
        // keeps the same logical start time.
        persistHeartbeat();

        try {
            await opts.onBeforeRestart?.();
        } catch (err) {
            logger.error(
                `onBeforeRestart hook failed: ${err instanceof Error ? err.message : String(err)}`
            );
        }

        // Non-zero exit so PM2 / systemd treats this as a restart-worthy fault.
        process.exit(1);
    }, interval);

    timer.unref?.();
    return timer;
}
