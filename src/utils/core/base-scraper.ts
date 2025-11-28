import { BaseHTTPClient, HTTPClientConfig } from "./base-http-client";
import { CacheManager } from "./cache-manager";

/**
 * Configuration for BaseScraper
 */
export interface ScraperConfig extends HTTPClientConfig {
    /** Enable caching (default: true) */
    enableCache?: boolean;
    /** Cache TTL in milliseconds (default: 5 minutes) */
    cacheTTL?: number;
    /** Rate limit: max requests per minute (default: 60) */
    rateLimit?: number;
    /** Scraper name for logging */
    name?: string;
}

/**
 * Base class for all scrapers with built-in features:
 * - HTTP client with retry logic
 * - Response caching
 * - Rate limiting
 * - Error handling
 * - Logging
 *
 * Example usage:
 * ```typescript
 * class MyScraper extends BaseScraper {
 *     constructor() {
 *         super({ name: 'MyScraper', cacheTTL: 10 * 60 * 1000 });
 *     }
 *
 *     async scrapeData(query: string) {
 *         return this.withCache(`data:${query}`, async () => {
 *             const response = await this.get(`/api/search?q=${query}`);
 *             return this.parseResponse(response.data);
 *         });
 *     }
 * }
 * ```
 */
export abstract class BaseScraper extends BaseHTTPClient {
    protected cache: CacheManager;
    protected scraperConfig: Required<ScraperConfig>;
    private requestTimes: number[] = [];

    constructor(config: ScraperConfig = {}) {
        super(config);

        this.scraperConfig = {
            ...this.config,
            enableCache: config.enableCache !== false,
            cacheTTL: config.cacheTTL || 5 * 60 * 1000,
            rateLimit: config.rateLimit || 60,
            name: config.name || this.constructor.name,
        };

        this.cache = new CacheManager({
            defaultTTL: this.scraperConfig.cacheTTL,
            enableLogging: this.scraperConfig.enableLogging,
        });
    }

    /**
     * Execute function with caching support
     */
    protected async withCache<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        if (!this.scraperConfig.enableCache) {
            return fetchFn();
        }

        return this.cache.getOrSet(key, fetchFn, ttl);
    }

    /**
     * Check rate limit before request
     */
    protected async checkRateLimit(): Promise<void> {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Remove old timestamps
        this.requestTimes = this.requestTimes.filter(
            (time) => time > oneMinuteAgo
        );

        if (this.requestTimes.length >= this.scraperConfig.rateLimit) {
            const oldestRequest = this.requestTimes[0];
            const waitTime = 60000 - (now - oldestRequest);

            if (this.scraperConfig.enableLogging) {
                console.warn(
                    `[${this.scraperConfig.name}] Rate limit reached, waiting ${waitTime}ms`
                );
            }

            await this.sleep(waitTime);
            return this.checkRateLimit();
        }

        this.requestTimes.push(now);
    }

    /**
     * Log message with scraper name
     */
    protected log(level: "info" | "warn" | "error", message: string): void {
        if (!this.scraperConfig.enableLogging) return;

        const prefix = `[${this.scraperConfig.name}]`;
        switch (level) {
            case "info":
                console.log(`${prefix} ${message}`);
                break;
            case "warn":
                console.warn(`${prefix} ${message}`);
                break;
            case "error":
                console.error(`${prefix} ${message}`);
                break;
        }
    }

    /**
     * Handle scraper errors consistently
     */
    protected handleError(error: any, context: string): never {
        const message = error instanceof Error ? error.message : String(error);
        const fullMessage = `${context}: ${message}`;

        this.log("error", fullMessage);
        throw new Error(`[${this.scraperConfig.name}] ${fullMessage}`);
    }

    /**
     * Validate required parameters
     */
    protected validateParams(params: Record<string, any>): void {
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === "") {
                throw new Error(
                    `[${this.scraperConfig.name}] Missing required parameter: ${key}`
                );
            }
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * Clear scraper cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.cache.stopCleanup();
        this.clearCache();
    }
}
