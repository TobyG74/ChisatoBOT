/**
 * Cache entry with TTL (Time To Live)
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
    /** Default TTL in milliseconds (default: 5 minutes) */
    defaultTTL?: number;
    /** Maximum cache entries before cleanup (default: 1000) */
    maxEntries?: number;
    /** Enable cache logging (default: false) */
    enableLogging?: boolean;
}

/**
 * In-memory cache manager with TTL support
 * Use this for temporary storage of scraper results to reduce API calls
 */
export class CacheManager {
    private cache: Map<string, CacheEntry<any>>;
    private config: Required<CacheConfig>;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config: CacheConfig = {}) {
        this.cache = new Map();
        this.config = {
            defaultTTL: config.defaultTTL || 5 * 60 * 1000, // 5 minutes
            maxEntries: config.maxEntries || 1000,
            enableLogging: config.enableLogging || false,
        };

        // Start automatic cleanup every minute
        this.startCleanup();
    }

    /**
     * Set cache entry with optional TTL
     */
    set<T>(key: string, value: T, ttl?: number): void {
        if (this.cache.size >= this.config.maxEntries) {
            this.cleanup();
        }

        const entry: CacheEntry<T> = {
            data: value,
            timestamp: Date.now(),
            ttl: ttl || this.config.defaultTTL,
        };

        this.cache.set(key, entry);

        if (this.config.enableLogging) {
            console.log(`[Cache] Set: ${key} (TTL: ${entry.ttl}ms)`);
        }
    }

    /**
     * Get cache entry if not expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            if (this.config.enableLogging) {
                console.log(`[Cache] Miss: ${key}`);
            }
            return null;
        }

        const now = Date.now();
        const age = now - entry.timestamp;

        if (age > entry.ttl) {
            this.cache.delete(key);
            if (this.config.enableLogging) {
                console.log(`[Cache] Expired: ${key}`);
            }
            return null;
        }

        if (this.config.enableLogging) {
            console.log(`[Cache] Hit: ${key} (Age: ${age}ms)`);
        }

        return entry.data as T;
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Delete cache entry
     */
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted && this.config.enableLogging) {
            console.log(`[Cache] Deleted: ${key}`);
        }
        return deleted;
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        const size = this.cache.size;
        this.cache.clear();
        if (this.config.enableLogging) {
            console.log(`[Cache] Cleared ${size} entries`);
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxEntries: number;
        entries: Array<{ key: string; age: number; ttl: number }>;
    } {
        const now = Date.now();
        const entries = Array.from(this.cache.entries()).map(
            ([key, entry]) => ({
                key,
                age: now - entry.timestamp,
                ttl: entry.ttl,
            })
        );

        return {
            size: this.cache.size,
            maxEntries: this.config.maxEntries,
            entries,
        };
    }

    /**
     * Cleanup expired entries
     */
    cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp;
            if (age > entry.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0 && this.config.enableLogging) {
            console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
        }

        // If still over max entries, remove oldest
        if (this.cache.size >= this.config.maxEntries) {
            const entries = Array.from(this.cache.entries()).sort(
                (a, b) => a[1].timestamp - b[1].timestamp
            );
            const toRemove = Math.ceil(this.config.maxEntries * 0.1); // Remove 10%
            for (let i = 0; i < toRemove && i < entries.length; i++) {
                this.cache.delete(entries[i][0]);
            }
            if (this.config.enableLogging) {
                console.log(`[Cache] Removed ${toRemove} oldest entries`);
            }
        }
    }

    /**
     * Start automatic cleanup interval
     */
    private startCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
    }

    /**
     * Stop automatic cleanup
     */
    stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Get or set cache entry (fetch if not exists)
     */
    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const value = await fetchFn();
        this.set(key, value, ttl);
        return value;
    }
}

// Global cache instance for shared use
export const globalCache = new CacheManager({
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxEntries: 500,
    enableLogging: false,
});
