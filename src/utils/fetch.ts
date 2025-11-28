import { BaseHTTPClient } from "./core/base-http-client";
import { AxiosRequestConfig } from "axios";

/**
 * HTTP Client instance for general use
 */
const httpClient = new BaseHTTPClient({
    timeout: 15000,
    maxRetries: 3,
    retryDelay: 1000,
});

/**
 * Fetch buffer data from URL (images, videos, etc.)
 * @param url - URL to fetch from
 * @param options - Optional Axios config
 * @returns Buffer data
 *
 * @deprecated Use BaseHTTPClient.getBuffer() or create custom scraper with BaseScraper
 */
export const getBuffer = async (
    url: string,
    options?: AxiosRequestConfig
): Promise<Buffer> => {
    try {
        return await httpClient["getBuffer"](url, options);
    } catch (error) {
        throw new Error(
            `Failed to fetch buffer: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
};
