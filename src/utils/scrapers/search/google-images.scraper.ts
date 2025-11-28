import axios from "axios";
import * as cheerio from "cheerio";
export interface GoogleImageResult {
    url: string;
    width: number;
    height: number;
}

export interface GoogleImagesSearchOptions {
    searchTerm: string;
    queryStringAddition?: string;
    filterOutDomains?: string[];
    userAgent?: string;
}

export class GoogleImagesScraper {
    private baseURL = "https://images.google.com/search?";
    private imageFileExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"];
    private defaultUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0";

    async search(
        searchTerm: string,
        options: Partial<GoogleImagesSearchOptions> = {}
    ): Promise<GoogleImageResult[]> {
        const filterOutDomains = ["gstatic.com", ...(options.filterOutDomains || [])];
        const userAgent = options.userAgent || this.defaultUserAgent;

        // Build search URL
        let url = `${this.baseURL}tbm=isch&q=${encodeURIComponent(searchTerm)}`;

        // Add domain filters
        if (filterOutDomains.length > 0) {
            url += encodeURIComponent(
                " " + filterOutDomains.map((d) => `-site:${d}`).join(" ")
            );
        }

        // Add additional query string
        if (options.queryStringAddition) {
            url += options.queryStringAddition;
        }

        try {
            // Fetch page
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": userAgent,
                },
            });

            // Parse HTML
            const $ = cheerio.load(response.data);
            const scripts = $("script");
            const scriptContents: string[] = [];

            // Collect script contents that contain image references
            scripts.each((_, element) => {
                if ((element as any).children && (element as any).children.length > 0) {
                    const firstChild = (element as any).children[0];
                    if (firstChild.type === "text") {
                        const content = firstChild.data;
                        if (content && this.containsAnyImageFileExtension(content)) {
                            scriptContents.push(content);
                        }
                    }
                }
            });

            // Extract image references
            const imageRefs: GoogleImageResult[] = [];
            const regex = /\["(http.+?)",(\d+),(\d+)\]/g;

            for (const content of scriptContents) {
                let match;
                while ((match = regex.exec(content)) !== null) {
                    if (match.length > 3) {
                        const imageUrl = match[1];
                        if (this.domainIsOK(imageUrl, filterOutDomains)) {
                            imageRefs.push({
                                url: imageUrl,
                                width: parseInt(match[3]),
                                height: parseInt(match[2]),
                            });
                        }
                    }
                }
            }

            return imageRefs;
        } catch (error) {
            throw new Error(
                `Failed to search Google Images: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    private containsAnyImageFileExtension(str: string): boolean {
        const lowercase = str.toLowerCase();
        return this.imageFileExtensions.some((ext) => lowercase.includes(ext));
    }

    private domainIsOK(url: string, filterOutDomains: string[]): boolean {
        if (!filterOutDomains || filterOutDomains.length === 0) {
            return true;
        }
        return filterOutDomains.every((domain) => url.indexOf(domain) === -1);
    }
}
