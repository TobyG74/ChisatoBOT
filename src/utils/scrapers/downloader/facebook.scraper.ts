import axios from "axios";
import * as cheerio from "cheerio";
import { BaseHTTPClient } from "../../core/base-http-client";

/**
 * Facebook Video Downloader Scraper
 * Downloads videos from Facebook using SnapVid API
 */
export class FacebookScraper extends BaseHTTPClient {
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
    private parseVideoData(htmlContent: string): FacebookVideoResult {
        const $ = cheerio.load(htmlContent);

        const result: FacebookVideoResult = {
            title: "Facebook Video",
            duration: "",
            thumbnail: "",
            mp4: [],
        };

        // Extract title and duration
        result.title = $(".content h3").text().trim() || "Facebook Video";
        result.duration = $(".content p").text().trim();

        // Extract thumbnail
        result.thumbnail = $(".image-fb img").attr("src") || "";

        // Extract MP4 videos (first tab content)
        const mp4Table = $(".tab__content").first();
        mp4Table.find("tbody tr").each((i, elem) => {
            const quality = $(elem).find(".video-quality").text().trim();
            const render = $(elem).find("td").eq(1).text().trim();
            const downloadBtn = $(elem).find("a.download-link-fb");
            const renderBtn = $(elem).find("button[data-videourl]");

            if (downloadBtn.length > 0) {
                // Direct download link (no render needed)
                result.mp4.push({
                    quality: quality,
                    render: render === "Yes",
                    type: "direct",
                    url: downloadBtn.attr("href"),
                });
            } else if (renderBtn.length > 0) {
                // Needs rendering
                result.mp4.push({
                    quality: quality,
                    render: render === "Yes",
                    type: "render",
                    videoUrl: renderBtn.attr("data-videourl"),
                    videoCodec: renderBtn.attr("data-videocodec"),
                    videoType: renderBtn.attr("data-videotype"),
                });
            }
        });

        return result;
    }

    /**
     * Download Facebook video
     * @param url Facebook video URL
     * @returns Video download information
     */
    async download(url: string): Promise<FacebookVideoResult> {
        try {
            // Get user verification token
            const cftoken = await this.getUserVerifyToken(url);

            // Get video data
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
                const result = this.parseVideoData(response.data.data);
                
                if (result.mp4.length === 0) {
                    throw new Error("No video found");
                }

                return result;
            } else {
                throw new Error("Failed to fetch video data");
            }
        } catch (error) {
            throw new Error(
                `Facebook download failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Get best quality video (non-render)
     */
    getBestQuality(result: FacebookVideoResult): typeof result.mp4[0] | null {
        // Filter only direct download links
        const directLinks = result.mp4.filter((v) => v.type === "direct");
        
        if (directLinks.length === 0) return null;

        // Sort by quality (HD > SD)
        const sorted = directLinks.sort((a, b) => {
            const qualityOrder = { "1080p": 3, "720p": 2, "360p": 1 };
            const getQuality = (q: string) => {
                if (q.includes("1080")) return qualityOrder["1080p"];
                if (q.includes("720")) return qualityOrder["720p"];
                if (q.includes("360")) return qualityOrder["360p"];
                return 0;
            };
            return getQuality(b.quality) - getQuality(a.quality);
        });

        return sorted[0];
    }
}