import axios from "axios";
import * as cheerio from "cheerio";
import { BaseHTTPClient } from "../../core/base-http-client";

/**
 * Instagram Media Downloader Scraper
 * Downloads images and videos from Instagram using SnapVid API
 */
export class InstagramScraper extends BaseHTTPClient {
    private snapvidBase = "https://snapvid.net";

    constructor() {
        super({
            baseURL: "https://snapvid.net",
            timeout: 30000,
            maxRetries: 2,
        });
    }

    /**
     * Get user verification token
     */
    private async getUserVerifyToken(url: string): Promise<string> {
        try {
            const response = await axios.post(
                `${this.snapvidBase}/api/userverify`,
                new URLSearchParams({
                    url: url,
                }),
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
                    },
                }
            );

            if (response.data && response.data.success) {
                return response.data.token;
            } else {
                throw new Error("Failed to get user verify token");
            }
        } catch (error) {
            throw new Error(
                `User verify failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Parse HTML response to extract download links
     */
    private parseInstagramData(htmlContent: string): InstagramResult {
        const $ = cheerio.load(htmlContent);

        // Check if it's video or images by looking at the icon class
        const firstIcon = $(".download-items__thumb .format-icon i").first();
        const isVideo = firstIcon.hasClass("icon-dlvideo");

        if (isVideo) {
            // Parse video
            const videoUrl = $(".download-items__btn a").first().attr("href") || "";

            return {
                type: "video",
                video: {
                    url: videoUrl,
                },
            };
        } else {
            // Parse images (carousel/multiple images)
            const images: InstagramImageItem[] = [];

            $(".download-box li").each((i, elem) => {
                const defaultUrl = $(elem).find(".download-items__btn a").attr("href") || "";
                
                // Extract ID from the select element's onchange attribute
                const onchangeAttr = $(elem).find("select").attr("onchange") || "";
                const idMatch = onchangeAttr.match(/getPhotoLink\('(\d+)'/);
                const id = idMatch ? idMatch[1] : `image_${i}`;

                // Extract qualities from select options
                const qualities: InstagramImageQuality[] = [];
                $(elem).find("select option").each((j, option) => {
                    const quality = $(option).text().trim();
                    const url = $(option).attr("value") || "";
                    
                    if (quality && url) {
                        qualities.push({ quality, url });
                    }
                });

                images.push({
                    id,
                    qualities,
                    defaultUrl,
                });
            });

            return {
                type: "image",
                images,
            };
        }
    }

    /**
     * Download Instagram media
     * @param url Instagram post URL
     * @returns Media download information
     */
    async download(url: string): Promise<InstagramResult> {
        try {
            // Get user verification token
            const cftoken = await this.getUserVerifyToken(url);

            // Get media data
            const response = await axios.post(
                `${this.snapvidBase}/api/ajaxSearch`,
                new URLSearchParams({
                    q: url,
                    w: "",
                    v: "v2",
                    lang: "en",
                    cftoken: cftoken,
                }),
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
                    },
                }
            );

            if (response.data && response.data.status === "ok") {
                const result = this.parseInstagramData(response.data.data);
                
                if (result.type === "image" && (!result.images || result.images.length === 0)) {
                    throw new Error("No images found");
                }

                if (result.type === "video" && (!result.video || !result.video.url)) {
                    throw new Error("No video found");
                }

                return result;
            } else {
                throw new Error("Failed to fetch Instagram media");
            }
        } catch (error) {
            throw new Error(
                `Instagram download failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Get best quality image from an image item
     */
    getBestImageQuality(imageItem: InstagramImageItem): InstagramImageQuality | null {
        if (imageItem.qualities.length === 0) return null;

        // Sort by quality (1080 > 750 > 640)
        const sorted = [...imageItem.qualities].sort((a, b) => {
            const getSize = (q: string) => {
                const match = q.match(/(\\d+)/);
                return match ? parseInt(match[1]) : 0;
            };
            return getSize(b.quality) - getSize(a.quality);
        });

        return sorted[0];
    }
}
