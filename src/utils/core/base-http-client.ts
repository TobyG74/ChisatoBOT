import Axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

/**
 * Configuration options for BaseHTTPClient
 */
export interface HTTPClientConfig {
    /** Base URL for all requests */
    baseURL?: string;
    /** Request timeout in milliseconds (default: 10000) */
    timeout?: number;
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Delay between retries in milliseconds (default: 1000) */
    retryDelay?: number;
    /** Custom headers to include in all requests */
    headers?: Record<string, string>;
    /** Enable request logging (default: false) */
    enableLogging?: boolean;
}

/**
 * Base HTTP Client with built-in retry logic, error handling, and logging
 * Use this class as a foundation for all HTTP-based scrapers and downloaders
 */
export class BaseHTTPClient {
    protected client: AxiosInstance;
    protected config: Required<HTTPClientConfig>;

    constructor(config: HTTPClientConfig = {}) {
        this.config = {
            baseURL: config.baseURL || "",
            timeout: config.timeout || 10000,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            headers: config.headers || {},
            enableLogging: config.enableLogging || false,
        };

        this.client = Axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                DNT: "1",
                "Upgrade-Insecure-Request": "1",
                ...this.config.headers,
            },
        });
    }

    /**
     * Perform GET request with retry logic
     */
    protected async get<T = any>(
        url: string,
        config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
        return this.executeWithRetry(() => this.client.get<T>(url, config));
    }

    /**
     * Perform POST request with retry logic
     */
    protected async post<T = any>(
        url: string,
        data?: any,
        config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
        return this.executeWithRetry(() =>
            this.client.post<T>(url, data, config)
        );
    }

    /**
     * Get buffer data from URL (useful for images, videos, etc.)
     */
    protected async getBuffer(
        url: string,
        config?: AxiosRequestConfig
    ): Promise<Buffer> {
        try {
            const response = await this.get<ArrayBuffer>(url, {
                ...config,
                responseType: "arraybuffer",
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(
                `Failed to fetch buffer from ${url}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Execute request with automatic retry logic
     */
    private async executeWithRetry<T>(
        requestFn: () => Promise<T>,
        attempt: number = 1
    ): Promise<T> {
        try {
            if (this.config.enableLogging) {
                console.log(
                    `[HTTP] Attempt ${attempt}/${this.config.maxRetries}`
                );
            }

            const result = await requestFn();

            if (this.config.enableLogging) {
                console.log(`[HTTP] Request successful on attempt ${attempt}`);
            }

            return result;
        } catch (error) {
            if (attempt >= this.config.maxRetries) {
                if (this.config.enableLogging) {
                    console.error(
                        `[HTTP] Request failed after ${this.config.maxRetries} attempts`
                    );
                }
                throw error;
            }

            if (this.config.enableLogging) {
                console.warn(
                    `[HTTP] Attempt ${attempt} failed, retrying in ${this.config.retryDelay}ms...`
                );
            }

            await this.sleep(this.config.retryDelay * attempt);
            return this.executeWithRetry(requestFn, attempt + 1);
        }
    }

    /**
     * Sleep utility for retry delays
     */
    protected sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Validate URL format
     */
    protected isValidURL(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === "http:" || urlObj.protocol === "https:";
        } catch {
            return false;
        }
    }

    /**
     * Extract file extension from URL
     */
    protected getFileExtension(url: string): string {
        const parts = url.split("/");
        const filename = parts[parts.length - 1];
        const extension = filename.split(".").pop();
        return extension || "";
    }
}
