import axios from "axios";
import * as cheerio from "cheerio";

const API_BASE = "https://snapsave.app";
const USER_AGENT =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

export class FacebookScraper {
    /**
     * POST Facebook URL to snapsave, returns the encrypted response body
     */
    private async fetchFromSnapsave(url: string): Promise<string> {
        const params = new URLSearchParams({ url });
        const response = await axios.post(
            `${API_BASE}/action.php?lang=en`,
            params.toString(),
            {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Accept": "*/*",
                    "Origin": API_BASE,
                    "Referer": `${API_BASE}/id/facebook-reels-download`,
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

    // Decoding logic based on SnapSave's client-side obfuscation, adapted for server-side use

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
            const decoded = this.decodeBase(s, e, baseChars);
            const charCode = decoded - tOffset;
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

    private decryptResponse(encryptedData: string): string {
        const params = this.getEncodedParams(encryptedData);
        if (params.length === 0) throw new Error("Could not parse encrypted params");

        const decoded = this.decodeSnapApp(params);
        if (!decoded) throw new Error("Decoding produced empty result");

        return this.extractDownloadSection(decoded);
    }

    // Render link polling logic for entries that require server-side rendering (e.g. Facebook Reels)
    private async pollRenderLink(
        progressUrl: string,
        maxAttempts = 20,
        intervalMs = 3000
    ): Promise<string> {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise((r) => setTimeout(r, intervalMs));
            try {
                const resp = await axios.get(progressUrl, {
                    headers: { "User-Agent": USER_AGENT },
                    timeout: 10000,
                });
                if (resp.data?.progress === "100" && resp.data?.url) {
                    return resp.data.url as string;
                }
            } catch {
                // ignore transient errors, keep polling
            }
        }
        throw new Error("Render timed out after polling");
    }

    /**
     * Table layout 
     */
    private async parseTableLayout(
        $: cheerio.CheerioAPI
    ): Promise<Array<{ quality: string; url: string }>> {
        const rows = $("table.table tbody tr");
        const pending: Array<Promise<{ quality: string; url: string } | null>> = [];

        rows.each((index, row) => {
            const cells = $(row).find("td");
            if (cells.length < 3) return;

            const quality = cells.eq(0).text().trim() || `Video ${index + 1}`;
            const button = cells.eq(2).find("button").first();
            const anchor = cells.eq(2).find("a").first();
            const onclick = button.attr("onclick") ?? "";

            if (onclick.includes("get_progressApi")) {
                const m = onclick.match(/get_progressApi\('(.+?)'\)/);
                if (m) {
                    const progressUrl = `${API_BASE}${m[1]}`;
                    pending.push(
                        this.pollRenderLink(progressUrl)
                            .then((url) => ({ quality, url }))
                            .catch(() => null)
                    );
                }
            } else {
                const url = button.attr("href") ?? anchor.attr("href") ?? "";
                if (url) pending.push(Promise.resolve({ quality, url }));
            }
        });

        const results = await Promise.all(pending);
        return results.filter((v): v is { quality: string; url: string } => v !== null);
    }

    private parseDownloadItemsLayout(
        $: cheerio.CheerioAPI
    ): { thumbnail: string; url: string } {
        const firstItem = $("div.download-items").first();
        if (!firstItem.length) throw new Error("No download-items div found");

        const thumbnail =
            firstItem.find("div.download-items__thumb > img").attr("src") ?? "";
        const url =
            firstItem.find("div.download-items__btn a").first().attr("href") ?? "";

        if (!url) throw new Error("Video URL not found in download-items layout");
        return { thumbnail, url };
    }

    private parseCardLayout($: cheerio.CheerioAPI): string {
        const url =
            $("div.card").first().find("div.card-body a").first().attr("href") ?? "";
        if (!url) throw new Error("No URL found in card layout");
        return url;
    }

    private parseSingleLayout($: cheerio.CheerioAPI): string {
        const link = $("a").first();
        const button = $("button").first();
        let url = link.attr("href") ?? "";

        if (!url) {
            const onclick = button.attr("onclick") ?? "";
            if (onclick.includes("get_progressApi")) {
                const m = onclick.match(/get_progressApi\('(.+?)'\)/);
                if (m) url = `${API_BASE}${m[1]}`;
            }
        }
        if (!url) throw new Error("No URL found in single layout");
        return url;
    }

    private async parseFacebookData(htmlContent: string): Promise<FacebookResult> {
        const $ = cheerio.load(htmlContent);
        const thumbnail = $("img").first().attr("src") ?? "";

        if ($("table.table").length > 0) {
            const videos = await this.parseTableLayout($);
            if (videos.length === 0) throw new Error("No video qualities found in table");
            return { thumbnail, videos };
        }

        if ($("div.download-items").length > 0) {
            const { thumbnail: thumb, url } = this.parseDownloadItemsLayout($);
            return {
                thumbnail: thumb || thumbnail,
                videos: [{ quality: "HD", url }],
            };
        }

        if ($("div.card").length > 0) {
            const url = this.parseCardLayout($);
            return { thumbnail, videos: [{ quality: "HD", url }] };
        }

        const url = this.parseSingleLayout($);
        return { thumbnail, videos: [{ quality: "HD", url }] };
    }

    /**
     * Resolve Facebook share/short links to their canonical video URL.
     * e.g. facebook.com/share/XXXX → facebook.com/watch/?v=XXXX
     */
    private async resolveUrl(url: string): Promise<string> {
        try {
            const resp = await axios.head(url, {
                headers: { "User-Agent": USER_AGENT },
                maxRedirects: 5,
                timeout: 10000,
                validateStatus: (s) => s < 400,
            });
            // axios follows redirects and exposes the final URL via resp.request.res.responseUrl
            const finalUrl: string =
                (resp.request as any)?.res?.responseUrl ??
                (resp.request as any)?.responseURL ??
                url;
            return finalUrl || url;
        } catch {
            return url;
        }
    }

    async download(url: string): Promise<FacebookResult> {
        // Resolve share/short links to canonical URLs that snapsave can handle
        const resolved = /facebook\.com\/share\//i.test(url) || /fb\.watch\//i.test(url)
            ? await this.resolveUrl(url)
            : url;

        const encrypted = await this.fetchFromSnapsave(resolved);
        const html = this.decryptResponse(encrypted);
        if (!html) throw new Error("Failed to extract download section from response");
        return this.parseFacebookData(html);
    }

    /**
     * Returns the best available video (HD preferred over SD).
     */
    getBestQuality(result: FacebookResult): FacebookResult["videos"][0] | null {
        if (!result.videos.length) return null;
        const sorted = [...result.videos].sort((a, b) => {
            const rank = (q: string) => {
                const l = q.toLowerCase();
                if (l.includes("1080")) return 4;
                if (l.includes("hd") || l.includes("720")) return 3;
                if (l.includes("sd") || l.includes("360")) return 2;
                return 1;
            };
            return rank(b.quality) - rank(a.quality);
        });
        return sorted[0];
    }
}