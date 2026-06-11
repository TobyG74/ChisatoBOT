import axios from "axios";
import * as cheerio from "cheerio";

const API_BASE = "https://snapsave.app";
const USER_AGENT =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

export class InstagramScraper {
    /**
     * POST Instagram URL to snapsave, returns the encrypted response body
     */
    private async fetchFromSnapsave(url: string): Promise<string> {
        const params = new URLSearchParams({ url });
        const response = await axios.post(
            `${API_BASE}/id/action.php?lang=id`,
            params.toString(),
            {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Accept": "*/*",
                    "Origin": API_BASE,
                    "Referer": `${API_BASE}/id`,
                    "X-Requested-With": "XMLHttpRequest",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout: 30000,
            }
        );
        if (typeof response.data !== "string" || response.data.length === 0) {
            throw new Error("Empty response from snapsave API");
        }
        return response.data as string;
    }

    /**
     * Extract the 6 packed arguments from the response body.
     * The response contains: ...decodeURIComponent(escape(r))}("p","a","c","k","e","d"))
     */
    private getEncodedParams(data: string): string[] {
        const parts = data.split('decodeURIComponent(escape(r))}(');
        if (parts.length < 2) return [];
        const paramString = parts[1].split("))")[0];
        return paramString.split(",").map((s) => s.replace(/"/g, "").trim());
    }

    /**
     * Decode the packed string using snapsave's custom base-N algorithm.
     */
    private decodeSnapApp(args: string[]): string {
        if (args.length < 5) return "";

        const h = args[0];                  // encoded string
        const n = args[2];                  // key alphabet
        const tOffset = parseInt(args[3]);  // char-code offset
        const e = parseInt(args[4]);        // base

        const ALPHABET =
            "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";
        const baseChars = ALPHABET.substring(0, e).split("");
        const delimiter = n[e]; // e.g. n[3]="I" when e=3

        const result: string[] = [];
        let i = 0;
        while (i < h.length) {
            let s = "";
            while (i < h.length && h[i] !== delimiter) {
                s += h[i];
                i++;
            }
            i++; // skip delimiter

            // Replace every character of n with its positional index string
            for (let j = 0; j < n.length; j++) {
                s = s.split(n[j]).join(j.toString());
            }

            const decoded = this.decodeBase(s, e, baseChars);
            const charCode = decoded - tOffset;
            if (charCode > 0) {
                result.push(String.fromCharCode(charCode));
            }
        }
        return result.join("");
    }

    /** Convert a string to an integer in the given base using the supplied char table */
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

    /**
     * Extract the download-section innerHTML from the decoded JS string.
     */
    private stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    }

    private extractDownloadSection(data: string): string {
        const alertParts = data.split('document.querySelector("#alert").innerHTML = "');
        if (alertParts.length > 1) {
            const raw = alertParts[1].split('";')[0].trim();
            const errorMsg = this.stripHtml(raw);
            if (errorMsg) throw new Error(errorMsg);
        }

        const parts = data.split('getElementById("download-section").innerHTML = "');
        if (parts.length < 2) return "";

        return parts[1]
            .split('"; document.getElementById("inputData").remove();')[0]
            .replace(/\\/g, "");
    }

    /**
     * Full decryption pipeline: encrypted data -> download-section HTML
     */
    private decryptResponse(encryptedData: string): string {
        const params = this.getEncodedParams(encryptedData);
        if (params.length === 0) throw new Error("Could not parse encrypted params");

        const decoded = this.decodeSnapApp(params);
        if (!decoded) throw new Error("Decoding produced empty result");

        return this.extractDownloadSection(decoded);
    }

    /**
     * Decode a rapidcdn JWT token and extract the real media URL + required headers.
     * The JWT payload is not verified — we only need the payload fields.
     * Payload shape: { url: string, headers?: { "user-agent"?: string }, filename?: string }
     */
    private decodeRapidcdnToken(rapidcdnUrl: string): { url: string; headers: Record<string, string> } | null {
        try {
            const tokenParam = new URL(rapidcdnUrl).searchParams.get("token");
            if (!tokenParam) return null;
            const parts = tokenParam.split(".");
            if (parts.length < 2) return null;
            // JWT uses base64url — normalise to standard base64
            const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
            if (!payload.url) return null;
            const headers: Record<string, string> = {};
            if (payload.headers?.["user-agent"]) {
                headers["User-Agent"] = payload.headers["user-agent"];
            }
            return { url: payload.url, headers };
        } catch {
            return null;
        }
    }

    private parseTableLayout(
        $: cheerio.CheerioAPI
    ): { videoUrl: string; thumbnail: string } {
        const thumbnail = $("table.table img").first().attr("src") ?? "";
        const firstRow = $("table.table tbody tr").first();
        const cells = firstRow.find("td");

        if (cells.length < 3) throw new Error("Unexpected table layout");

        const button = cells.eq(2).find("button").first();
        let videoUrl = button.attr("onclick") ?? "";

        if (videoUrl.includes("get_progressApi")) {
            const m = videoUrl.match(/get_progressApi\('(.+?)'\)/);
            if (m) videoUrl = `${API_BASE}${m[1]}`;
        }
        if (!videoUrl) videoUrl = button.attr("href") ?? "";
        if (!videoUrl) videoUrl = cells.eq(2).find("a").first().attr("href") ?? "";
        if (!videoUrl) throw new Error("Could not find video URL in table layout");

        return { videoUrl, thumbnail };
    }

    private parseDownloadItemsLayout(
        $: cheerio.CheerioAPI
    ): { videoUrl?: string; thumbnail?: string; images?: Array<{ url: string; directUrl: string; headers: Record<string, string> }> } {
        const items = $("div.download-items");
        if (items.length === 0) throw new Error("No download-items found");

        const first = items.first();
        const videoEl = first.find("video").first();
        const btnWrap = first.find("div.download-items__btn").first();
        const spanText = btnWrap.find("span").first().text().trim().toLowerCase();
        const isVideo = videoEl.length > 0 || spanText.includes("video");

        if (isVideo) {
            const thumbnail =
                first.find("div.download-items__thumb > img").attr("src") ??
                videoEl.attr("poster") ??
                "";
            const videoUrl = btnWrap.find("a").first().attr("href") ?? "";
            if (!videoUrl) throw new Error("Could not find video URL in download-items layout");
            return { videoUrl, thumbnail };
        } else {
            const images: Array<{ url: string; directUrl: string; headers: Record<string, string> }> = [];
            items.each((_, item) => {
                const btnHref = $(item).find("div.download-items__btn a").first().attr("href") ?? "";
                if (!btnHref || btnHref.includes(".mp4")) return;

                if (btnHref.includes("d.rapidcdn.app")) {
                    const decoded = this.decodeRapidcdnToken(btnHref);
                    images.push({ url: btnHref, directUrl: decoded?.url ?? btnHref, headers: {} });
                    return;
                }

                images.push({ url: btnHref, directUrl: btnHref, headers: {} });
            });
            if (images.length === 0) throw new Error("No images found in download-items layout");
            return { images };
        }
    }

    private parseCardLayout(
        $: cheerio.CheerioAPI
    ): { videoUrl?: string; images?: string[] } {
        const firstCard = $("div.card").first();
        const link = firstCard.find("div.card-body a").first();
        const linkText = link.text().trim().toLowerCase();
        const url = link.attr("href") ?? "";
        if (!url) throw new Error("No URL found in card layout");

        if (linkText.includes("photo")) {
            return { images: [url] };
        }
        return { videoUrl: url };
    }

    private parseSingleLayout(
        $: cheerio.CheerioAPI
    ): { videoUrl?: string; images?: string[] } {
        const link = $("a").first();
        const button = $("button").first();
        const linkText = link.text().trim().toLowerCase();
        let url = link.attr("href") ?? "";

        if (!url) {
            const onclick = button.attr("onclick") ?? "";
            if (onclick.includes("get_progressApi")) {
                const m = onclick.match(/get_progressApi\('(.+?)'\)/);
                if (m) url = `${API_BASE}${m[1]}`;
            }
        }
        if (!url) throw new Error("No URL found");

        if (linkText.includes("photo") || linkText.includes("gambar")) {
            return { images: [url] };
        }
        return { videoUrl: url };
    }

    private parseInstagramData(htmlContent: string): InstagramResult {
        const $ = cheerio.load(htmlContent);

        let parsed: {
            videoUrl?: string;
            thumbnail?: string;
            images?: Array<{ url: string; directUrl?: string; headers: Record<string, string> } | string>;
        };

        if ($("table.table").length > 0) {
            const t = this.parseTableLayout($);
            parsed = { videoUrl: t.videoUrl, thumbnail: t.thumbnail };
        } else if ($("div.download-items").length > 0) {
            parsed = this.parseDownloadItemsLayout($);
        } else if ($("div.card").length > 0) {
            parsed = this.parseCardLayout($);
        } else {
            parsed = this.parseSingleLayout($);
        }

        if (parsed.videoUrl) {
            return {
                type: "video",
                video: { url: parsed.videoUrl },
            };
        }

        if (parsed.images && parsed.images.length > 0) {
            return {
                type: "image",
                images: parsed.images.map((item, i) => {
                    const url = typeof item === "string" ? item : item.url;
                    const directUrl = typeof item === "string" ? item : item.directUrl ?? item.url;
                    const headers = typeof item === "string" ? {} : item.headers;
                    return {
                        id: `img_${i}`,
                        defaultUrl: directUrl,
                        qualities: [{ quality: "Original", url, directUrl, headers }],
                    };
                }),
            };
        }

        throw new Error("No media found in parsed HTML");
    }

    async download(url: string): Promise<InstagramResult> {
        const encrypted = await this.fetchFromSnapsave(url);
        const html = this.decryptResponse(encrypted);
        if (!html) throw new Error("Failed to extract download section from response");
        return this.parseInstagramData(html);
    }

    /**
     * Returns the single best quality entry for an image item.
     * (snapsave provides one URL per image, always at "Original" quality)
     */
    getBestImageQuality(imageItem: InstagramImageItem): InstagramImageQuality | null {
        return imageItem.qualities[0] ?? null;
    }
}
