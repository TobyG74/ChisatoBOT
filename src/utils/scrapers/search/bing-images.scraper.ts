import axios from "axios";
import type {
    BingImageResult,
    BingImagesSearchOptions,
} from "../../../types/search/bing-images";

const BING_SEARCH_PAGE_URL = "https://www.bing.com/images/search";
const BING_IMAGE_SEARCH_URL = "https://www.bing.com/images/async";
const BING_IMAGE_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export class BingImagesScraper {
    private buildParams(query: string, count: number) {
        return {
            q: query,
            first: 1,
            count,
            mkt: "en-US",
            adlt: "Off",
            qft: "",
        };
    }

    private buildHeaders(query: string) {
        return {
            "User-Agent": BING_IMAGE_UA,
            "Referer": `${BING_SEARCH_PAGE_URL}?q=` + encodeURIComponent(query),
            "Accept-Language": "en-US,en;q=0.9",
        };
    }

    async search(
        searchTerm: string,
        options: BingImagesSearchOptions = {}
    ): Promise<BingImageResult[]> {
        const count = options.perPage ?? 60;

        const response = await axios.get(BING_IMAGE_SEARCH_URL, {
            params: this.buildParams(searchTerm, count),
            headers: this.buildHeaders(searchTerm),
            timeout: 15000,
            decompress: true,
        });

        const decoded: string = (response.data as string)
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&");

        const results: BingImageResult[] = [];
        const re =
            /"murl":"(https?:[^"]+)","turl":"(https?:[^"]+)","md5":"[^"]*","shkey":"[^"]*","t":"([^"]*)"/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(decoded)) !== null) {
            results.push({
                url: m[1],
                thumbnail: m[2],
                title: m[3],
                width: 0,
                height: 0,
                source: "",
            });
        }

        if (results.length === 0) {
            throw new Error(
                "No images found for the search query. Try different keywords."
            );
        }

        return results;
    }
}
