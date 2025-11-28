interface CacheItem<T> {
    value: T;
    expiry: number;
}

interface CacheConfig {
    ttl: number; 
    maxSize: number; 
}

class CacheService {
    private static instance: CacheService;
    private cache: Map<string, CacheItem<any>>;
    private config: CacheConfig;

    private constructor(config: Partial<CacheConfig> = {}) {
        this.cache = new Map();
        this.config = {
            ttl: config.ttl || 5 * 60 * 1000, // Default 5 minutes
            maxSize: config.maxSize || 1000, // Default 1000 items
        };

        setInterval(() => this.cleanupExpired(), 60 * 1000);
    }

    public static getInstance(config?: Partial<CacheConfig>): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService(config);
        }
        return CacheService.instance;
    }

    public set<T>(key: string, value: T, ttl?: number): void {
        // Check size limit
        if (this.cache.size >= this.config.maxSize) {
            // Remove oldest item (FIFO)
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        const expiry = Date.now() + (ttl || this.config.ttl);
        this.cache.set(key, { value, expiry });
    }

    public get<T>(key: string): T | null {
        const item = this.cache.get(key);

        if (!item) {
            return null;
        }

        // Check if expired
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value as T;
    }

    public has(key: string): boolean {
        const item = this.cache.get(key);

        if (!item) {
            return false;
        }

        // Check if expired
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    public delete(key: string): boolean {
        return this.cache.delete(key);
    }

    public clear(): void {
        this.cache.clear();
    }

    public size(): number {
        return this.cache.size;
    }

    private cleanupExpired(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach((key) => this.cache.delete(key));
    }

    public getStats(): { size: number; maxSize: number; ttl: number } {
        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            ttl: this.config.ttl,
        };
    }

    /**
     * Get or set pattern - useful for database queries
     */
    public async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        const cached = this.get<T>(key);

        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        this.set(key, value, ttl);
        return value;
    }
}

export const cacheService = CacheService.getInstance();
