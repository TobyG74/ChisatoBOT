import axios from "axios";
import * as cheerio from "cheerio";

const API_BASE = "https://threads.snapsave.app";
const USER_AGENT =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

export class ThreadsScraper {
    // Fetch 
    private async fetchFromSnapsave(url: string): Promise<string> {
        const response = await axios.get(
            `${API_BASE}/api/action?url=${encodeURIComponent(url)}`,
            {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json, text/html, */*",
                    "Origin": API_BASE,
                    "Referer": `${API_BASE}/`,
                },
                timeout: 30000,
            }
        );
        if (typeof response.data !== "string" && typeof response.data !== "object") {
            throw new Error("Unexpected response type from snapsave API");
        }
        // axios may auto-parse JSON — return raw string or re-stringify
        if (typeof response.data === "object") {
            return JSON.stringify(response.data);
        }
        if ((response.data as string).length === 0) {
            throw new Error("Empty response from snapsave API");
        }
        return response.data as string;
    }

    // Decryption (same algorithm as SnapSave Facebook/Instagram)
    private getEncodedParams(data: string): string[] {
        const parts = data.split("decodeURIComponent(escape(r))}(");
        if (parts.length < 2) return [];
        const paramString = parts[1].split("))")[0];
        return paramString.split(",").map((s) => s.replace(/"/g, "").trim());
    }

    private decodeSnapApp(args: string[]): string {
        if (args.length < 5) return "";

        const h = args[0];
        const n = args[2];
        const tOffset = parseInt(args[3]);
        const e = parseInt(args[4]);

        const ALPHABET =
            "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";
        const baseChars = ALPHABET.substring(0, e).split("");
        const delimiter = n[e];

        const result: string[] = [];
        let i = 0;
        while (i < h.length) {
            let s = "";
            while (i < h.length && h[i] !== delimiter) {
                s += h[i];
                i++;
            }
            i++;
            for (let j = 0; j < n.length; j++) {
                s = s.split(n[j]).join(j.toString());
            }
            const charCode = this.decodeBase(s, e, baseChars) - tOffset;
            if (charCode > 0) {
                result.push(String.fromCharCode(charCode));
            }
        }
        return result.join("");
    }

    private decodeBase(value: string, base: number, baseChars: string[]): number {
        const reversed = value.split("").reverse();
        let output = 0;
        for (let index = 0; index < reversed.length; index++) {
            const digit = baseChars.indexOf(reversed[index]);
            if (digit !== -1) {
                output += digit * Math.pow(base, index);
            }
        }
        return output;
    }

    private extractDownloadSection(data: string): string {
        const parts = data.split('getElementById("download-section").innerHTML = "');
        if (parts.length < 2) return "";
        return parts[1]
            .split('"; document.getElementById("inputData").remove();')[0]
            .replace(/\\/g, "");
    }

    private decryptResponse(encryptedData: string): string {
        const params = this.getEncodedParams(encryptedData);
        if (params.length === 0) return "";
        const decoded = this.decodeSnapApp(params);
        if (!decoded) return "";
        return this.extractDownloadSection(decoded);
    }

    // Response format handlers

    /**
     * New JSON format: { "items": [...], "status_code": 200 }
     */
    private tryParseJsonFormat(raw: string): ThreadsResult | null {
        try {
            const json = JSON.parse(raw);
            if (!json.items || !Array.isArray(json.items) || json.items.length === 0) return null;

            let thumbnail = "";
            const items: ThreadsMediaItem[] = [];

            json.items.forEach((item: any, i: number) => {
                const type: ThreadsMediaType = (item.type ?? "").toLowerCase() === "image" ? "image" : "video";
                const url: string =
                    item.downloadUrl ||
                    item.videoUrl ||
                    item.imageUrl ||
                    "";
                if (!url) return;
                if (!thumbnail && item.thumbnail) thumbnail = item.thumbnail;
                items.push({
                    type,
                    quality: type === "video" ? "HD" : "",
                    url,
                    mimeType: type === "video" ? "video/mp4" : "image/jpeg",
                });
            });

            if (items.length === 0) return null;
            return { thumbnail, items };
        } catch {
            return null;
        }
    }

    /**
     * Old JSON wrapper: { "data": "<html>..." }
     */
    private tryExtractDataField(raw: string): string | null {
        try {
            const json = JSON.parse(raw);
            const data = json?.data;
            return typeof data === "string" && data.length > 0 ? data : null;
        } catch {
            return null;
        }
    }

    // HTML layout parsers

    /**
     * #download-block layout (threads.snapsave.app primary layout)
     */
    private parseDownloadBlock($: cheerio.CheerioAPI): ThreadsMediaItem[] {
        const block = $("#download-block");
        if (!block.length) return [];

        const url = block.find(".abuttons > a").first().attr("href") ?? "";
        if (!url) return [];

        const buttonText = block.find(".abuttons > a > span > span").first().text().trim().toLowerCase();
        const isVideo = !buttonText.includes("photo");

        return [{
            type: isVideo ? "video" : "image",
            quality: isVideo ? "HD" : "",
            url,
            mimeType: isVideo ? "video/mp4" : "image/jpeg",
        }];
    }

    /**
     * table.table layout
     */
    private parseTableLayout($: cheerio.CheerioAPI): ThreadsMediaItem[] {
        const rows = $("table.table tbody tr");
        if (!rows.length) return [];

        const items: ThreadsMediaItem[] = [];
        rows.each((_, row) => {
            const cells = $(row).find("td");
            if (cells.length < 3) return;

            const button = cells.eq(2).find("button").first();
            const anchor = cells.eq(2).find("a").first();
            let url = button.attr("href") ?? anchor.attr("href") ?? "";

            const onclick = button.attr("onclick") ?? "";
            if (!url && onclick.includes("get_progressApi")) {
                const m = onclick.match(/get_progressApi\('(.+?)'\)/);
                if (m) url = `${API_BASE}${m[1]}`;
            }
            if (!url) return;

            items.push({ type: "video", quality: "HD", url, mimeType: "video/mp4" });
        });
        return items;
    }

    /**
     * div.download-items layout — handles both video and multiple photos
     */
    private parseDownloadItemsLayout($: cheerio.CheerioAPI): { thumbnail: string; items: ThreadsMediaItem[] } {
        const allItems = $("div.download-items");
        if (!allItems.length) return { thumbnail: "", items: [] };

        const first = allItems.first();
        const hasVideo = first.find("video").length > 0;
        const btnWrap = first.find("div.download-items__btn");
        const spanText = btnWrap.find("span").first().text().trim().toLowerCase();
        const isVideo = hasVideo || spanText.includes("video");

        if (isVideo) {
            const thumbnail =
                first.find("div.download-items__thumb > img").attr("src") ??
                first.find("video").attr("poster") ??
                "";
            const url = btnWrap.find("a").first().attr("href") ?? "";
            if (!url) return { thumbnail, items: [] };
            return {
                thumbnail,
                items: [{ type: "video", quality: "HD", url, mimeType: "video/mp4" }],
            };
        }

        // Multiple photos
        const images: ThreadsMediaItem[] = [];
        allItems.each((i, el) => {
            const url =
                $(el).find("div.download-items__thumb > img").attr("src") ??
                $(el).find("div.download-items__btn a").attr("href") ??
                "";
            if (url) {
                images.push({ type: "image", quality: "", url, mimeType: "image/jpeg" });
            }
        });
        return { thumbnail: "", items: images };
    }

    /**
     * Fallback single link layout
     */
    private parseSingleLayout($: cheerio.CheerioAPI): ThreadsMediaItem[] {
        const link = $("a").first();
        const url = link.attr("href") ?? "";
        if (!url) return [];

        const isImage = link.text().trim().toLowerCase().includes("photo");
        return [{
            type: isImage ? "image" : "video",
            quality: isImage ? "" : "HD",
            url,
            mimeType: isImage ? "image/jpeg" : "video/mp4",
        }];
    }

    private parseThreadsHtml(htmlContent: string): ThreadsResult {
        const $ = cheerio.load(htmlContent);
        const thumbnail =
            $(".videotikmate-left > img").attr("src") ??
            $("article.media > figure img").attr("src") ??
            $("img").first().attr("src") ??
            "";

        // #download-block — primary threads.snapsave.app layout
        if ($("#download-block").length) {
            const items = this.parseDownloadBlock($);
            if (items.length) return { thumbnail, items };
        }

        // table.table layout
        if ($("table.table").length) {
            const items = this.parseTableLayout($);
            if (items.length) return { thumbnail, items };
        }

        // div.download-items layout
        if ($("div.download-items").length) {
            const { thumbnail: t, items } = this.parseDownloadItemsLayout($);
            if (items.length) return { thumbnail: t || thumbnail, items };
        }

        // Fallback
        const items = this.parseSingleLayout($);
        if (items.length) return { thumbnail, items };

        throw new Error("Could not parse Threads download page — no known layout matched");
    }

    // Public API
    async download(url: string): Promise<ThreadsResult> {
        const raw = await this.fetchFromSnapsave(url);

        const jsonResult = this.tryParseJsonFormat(raw);
        if (jsonResult) return jsonResult;

        const dataHtml = this.tryExtractDataField(raw);
        if (dataHtml) return this.parseThreadsHtml(dataHtml);

        const html = this.decryptResponse(raw);
        if (!html) throw new Error("Failed to parse Threads response — all strategies exhausted");

        return this.parseThreadsHtml(html);
    }

    /**
     * Returns the first video, or first image if post is photo-only.
     */
    getBestMedia(result: ThreadsResult): ThreadsMediaItem | null {
        if (!result.items.length) return null;
        return result.items.find((i) => i.type === "video") ?? result.items[0];
    }

    /**
     * Returns all videos from a multi-video post.
     */
    getVideos(result: ThreadsResult): ThreadsMediaItem[] {
        return result.items.filter((i) => i.type === "video");
    }

    /**
     * Returns all images from a photo post / carousel.
     */
    getImages(result: ThreadsResult): ThreadsMediaItem[] {
        return result.items.filter((i) => i.type === "image");
    }
}
