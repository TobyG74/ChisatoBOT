import axios from "axios";

export interface BingImageResult {
    url: string;
    thumbnail: string;
    width: number;
    height: number;
    title: string;
    source: string;
}

export interface BingImagesSearchOptions {
    perPage?: number;
}

export class BingImagesScraper {
    private readonly UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    async search(
        searchTerm: string,
        options: BingImagesSearchOptions = {}
    ): Promise<BingImageResult[]> {
        const count = options.perPage ?? 60;

        const response = await axios.get("https://www.bing.com/images/async", {
            params: {
                q: searchTerm,
                first: 1,
                count,
                mkt: "en-US",
                adlt: "Off",
                qft: "",
            },
            headers: {
                "User-Agent": this.UA,
                "Referer":
                    "https://www.bing.com/images/search?q=" +
                    encodeURIComponent(searchTerm),
                "Accept-Language": "en-US,en;q=0.9",
            },
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
