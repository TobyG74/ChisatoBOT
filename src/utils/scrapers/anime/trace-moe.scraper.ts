import FormData from "form-data";
import { BaseHTTPClient } from "../../core/base-http-client";
import type { TraceMoeResult, TraceMoeAnilistInfo } from "../../../types/anime/trace-moe";

/**
 * TraceMoe API Client
 * Search anime by image using trace.moe API
 */
export class TraceMoeScraper extends BaseHTTPClient {
    private baseUrl = "https://api.trace.moe";

    constructor() {
        super({
            baseURL: "https://api.trace.moe",
            timeout: 30000,
            maxRetries: 2,
        });
    }

    /**
     * Search anime from image buffer
     * @param imageBuffer Image buffer to search
     * @param cutBorders Whether to cut black borders (default: true)
     * @returns TraceMoe search results
     */
    async searchByImage(
        imageBuffer: Buffer,
        cutBorders: boolean = true
    ): Promise<TraceMoeResult> {
        try {
            const form = new FormData();
            form.append("image", imageBuffer, {
                filename: "image.jpg",
                contentType: "image/jpeg",
            });

            const params = new URLSearchParams();
            if (cutBorders) {
                params.append("cutBorders", "1");
            }

            const url = `${this.baseUrl}/search?${params.toString()}`;

            const response = await this.client.post(url, form, {
                headers: {
                    ...form.getHeaders(),
                },
            });

            return response.data as TraceMoeResult;
        } catch (error) {
            throw new Error(
                `TraceMoe search failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Search anime from image URL
     * @param imageUrl Image URL to search
     * @param cutBorders Whether to cut black borders (default: true)
     * @returns TraceMoe search results
     */
    async searchByUrl(
        imageUrl: string,
        cutBorders: boolean = true
    ): Promise<TraceMoeResult> {
        try {
            const params = new URLSearchParams();
            params.append("url", imageUrl);
            if (cutBorders) {
                params.append("cutBorders", "1");
            }

            const url = `${this.baseUrl}/search?${params.toString()}`;

            const response = await this.client.get(url);

            return response.data as TraceMoeResult;
        } catch (error) {
            throw new Error(
                `TraceMoe search failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Get Anilist info for anime
     * @param anilistId Anilist ID
     * @returns Anilist info
     */
    async getAnilistInfo(anilistId: number): Promise<TraceMoeAnilistInfo> {
        try {
            const query = `
                query ($id: Int) {
                    Media(id: $id, type: ANIME) {
                        id
                        idMal
                        title {
                            romaji
                            english
                            native
                        }
                        synonyms
                        isAdult
                    }
                }
            `;

            const response = await this.client.post(
                "https://graphql.anilist.co",
                {
                    query,
                    variables: { id: anilistId },
                }
            );

            return response.data.data.Media as TraceMoeAnilistInfo;
        } catch (error) {
            throw new Error(
                `Failed to get Anilist info: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Format time in seconds to MM:SS
     * @param seconds Time in seconds
     * @returns Formatted time string
     */
    formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    }

    /**
     * Format similarity percentage
     * @param similarity Similarity value (0-1)
     * @returns Formatted percentage string
     */
    formatSimilarity(similarity: number): string {
        return `${(similarity * 100).toFixed(2)}%`;
    }
}
