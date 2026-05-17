import axios from "axios";
import type {
    DDGImageResult,
    DDGImagesSearchOptions,
} from "../../../types/search/duckduckgo-images";

const DDG_SEARCH_PAGE_URL = "https://duckduckgo.com/";
const DDG_IMAGE_API_URL = "https://duckduckgo.com/i.js";
const DDG_IMAGE_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * DuckDuckGo Images scraper.
 * Returns real image URLs with actual width/height metadata.
 */
export class DuckDuckGoImagesScraper {
    private buildSearchParams(query: string) {
        return {
            q: query,
            ia: "images",
            iax: "images",
        };
    }

    private buildSearchHeaders() {
        return {
            "User-Agent": DDG_IMAGE_UA,
            "Accept-Language": "en-US,en;q=0.9",
        };
    }

    private buildImageParams(query: string, vqd: string, safeSearch: string) {
        return {
            q: query,
            vqd,
            o: "json",
            p: safeSearch,
            s: 0,
            u: "bing",
            f: ",,,,",
            l: "us-en",
        };
    }

    private buildImageHeaders(query: string) {
        return {
            "User-Agent": DDG_IMAGE_UA,
            "Referer": `${DDG_SEARCH_PAGE_URL}?q=${encodeURIComponent(query)}&ia=images&iax=images`,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9",
            "X-Requested-With": "XMLHttpRequest",
        };
    }

    private safeSearchParam(level: DDGImagesSearchOptions["safeSearch"]): string {
        switch (level) {
            case "strict":   return "1";
            case "moderate": return "-1";
            case "off":
            default:         return "-2";
        }
    }

    private async getVqd(query: string): Promise<string> {
        const response = await axios.get(DDG_SEARCH_PAGE_URL, {
            params: this.buildSearchParams(query),
            headers: this.buildSearchHeaders(),
            timeout: 15000,
        });

        // vqd is embedded in the HTML as: vqd='4-...' or vqd="4-..."
        const match = (response.data as string).match(/vqd=['"]([^'"]+)['"]/);
        if (!match) {
            throw new Error("DuckDuckGo: could not extract vqd token from search page.");
        }
        return match[1];
    }

    async search(
        searchTerm: string,
        options: DDGImagesSearchOptions = {}
    ): Promise<DDGImageResult[]> {
        const { count = 60, safeSearch = "off" } = options;

        const vqd = await this.getVqd(searchTerm);

        const response = await axios.get(DDG_IMAGE_API_URL, {
            params: this.buildImageParams(
                searchTerm,
                vqd,
                this.safeSearchParam(safeSearch)
            ),
            headers: this.buildImageHeaders(searchTerm),
            timeout: 15000,
        });

        const items: any[] = response.data?.results ?? [];
        return items.slice(0, count).map((item: any) => ({
            url:       item.image  ?? "",
            thumbnail: item.thumbnail ?? item.image ?? "",
            width:     item.width  ?? 0,
            height:    item.height ?? 0,
            title:     item.title  ?? "",
            source:    item.url    ?? "",
        }));
    }
}
