import Axios from "axios";
import { load } from "cheerio";

/**
 * Parse image metadata from title
 * @param title - Format: "2147✕3310 10121kb png yurun ume Uploaded by PhoenixNight"
 */
function parseImageMetadata(title: string | null | undefined) {
    if (!title || typeof title !== "string") return null;

    // Extract dimensions (e.g., "2147✕3310" or "2147×3310")
    const dimensionMatch = title.match(/(\d+)[✕×](\d+)/);
    const width =
        dimensionMatch && dimensionMatch[1]
            ? parseInt(dimensionMatch[1])
            : null;
    const height =
        dimensionMatch && dimensionMatch[2]
            ? parseInt(dimensionMatch[2])
            : null;
    const ratio = width && height ? (width / height).toFixed(2) : null;

    // Extract size (e.g., "10121kb")
    const sizeMatch = title.match(/(\d+)(kb|mb|gb)/i);
    const size =
        sizeMatch && sizeMatch[1] && sizeMatch[2]
            ? `${sizeMatch[1]}${sizeMatch[2].toLowerCase()}`
            : null;
    const sizeKb =
        sizeMatch && sizeMatch[1] && sizeMatch[2]
            ? sizeMatch[2].toLowerCase() === "kb"
                ? parseInt(sizeMatch[1])
                : sizeMatch[2].toLowerCase() === "mb"
                ? parseInt(sizeMatch[1]) * 1024
                : sizeMatch[2].toLowerCase() === "gb"
                ? parseInt(sizeMatch[1]) * 1024 * 1024
                : parseInt(sizeMatch[1])
            : null;

    // Extract format (e.g., "png", "jpg", "gif")
    const formatMatch = title.match(/\b(png|jpg|jpeg|gif|webp)\b/i);
    const format =
        formatMatch && formatMatch[1] ? formatMatch[1].toLowerCase() : null;

    // Extract uploader (after "Uploaded by")
    const uploaderMatch = title.match(/Uploaded by (.+)$/);
    const uploader =
        uploaderMatch && uploaderMatch[1] ? uploaderMatch[1].trim() : null;

    return {
        width,
        height,
        ratio,
        size,
        sizeKb,
        format,
        uploader,
    };
}

/**
 * Get latest wallpapers from ZeroChan
 */
export const ZeroChanLatest = (page: number = 1): Promise<{ results: ZeroChan[], nextUrl?: string }> =>
    new Promise(async (resolve, reject) => {
        const url = page > 1 ? `https://www.zerochan.net/?p=${page}` : "https://www.zerochan.net/";
        Axios.get(url)
            .then(({ data }) => {
                const $ = load(data);
                const result: ZeroChan[] = [];
                $(".thumb")
                    .get()
                    .map((res) => {
                        const rawTitle = $(res)
                            .find("img")
                            .attr("title")
                            ?.split("\n")
                            .join(" ")
                            .trim();
                        const tag = $(res).find("img").attr("alt");
                        const href = $(res).attr("href");

                        if (!href || !tag) return;

                        const metadata = parseImageMetadata(rawTitle);
                        const imageId = href.split("/").pop();
                        const tagFormatted = tag.split(" ").join(".");
                        const imagePreview = $(res)
                            .find("img")
                            .attr("data-src");

                        const imageFull =
                            imageId && tagFormatted && metadata?.format
                                ? `https://static.zerochan.net/${tagFormatted}.full.${imageId}.${
                                      metadata.format === "gif"
                                          ? "gif"
                                          : metadata.format === "png"
                                          ? "png"
                                          : "jpg"
                                  }`
                                : "https://www.zerochan.net" + href;

                        result.push({
                            quality: rawTitle ? rawTitle.split(" ")[0] : "N/A",
                            size: metadata?.size || "N/A",
                            url: "https://www.zerochan.net" + href,
                            imagePreview: imagePreview,
                            imageFull: imageFull,
                            source: "https://www.zerochan.net" + href,
                            width: metadata?.width,
                            height: metadata?.height,
                            ratio: metadata?.ratio,
                            sizeKb: metadata?.sizeKb,
                            format: metadata?.format,
                            uploader: metadata?.uploader,
                            tag: tag,
                            title: rawTitle,
                        });
                    });
                if (result.length === 0) {
                    return resolve({ results: [], nextUrl: undefined });
                }
                resolve({ results: result, nextUrl: undefined });
            })
            .catch(reject);
    });

/**
 * Search wallpapers from ZeroChan by query
 */
export const ZeroChan = (query: string, page: number = 1): Promise<{ results: ZeroChan[], nextUrl?: string }> =>
    new Promise(async (resolve, reject) => {
        try {
            let baseSearchUrl = "";
            
            // First request: Get canonical URL from initial search
            const initialUrl = `https://www.zerochan.net/${query}`;
            const initialResponse = await Axios.get(initialUrl);
            const $initial = load(initialResponse.data);
            
            // Extract canonical URL for proper pagination
            const canonicalUrl = $initial('link[rel="canonical"]').attr('href');
            baseSearchUrl = canonicalUrl || initialUrl;
            
            // Second request: Get actual page data
            let finalUrl = baseSearchUrl;
            if (page > 1) {
                // Build paginated URL based on canonical URL
                finalUrl = baseSearchUrl.includes('?') 
                    ? `${baseSearchUrl}&p=${page}`
                    : `${baseSearchUrl}?p=${page}`;
            }
            
            const response = await Axios.get(finalUrl);
            const $ = load(response.data);
            
            const result: ZeroChan[] = [];
            $("ul#thumbs2 li")
                .get()
                .map((res) => {
                        const title = $(res).find("a > img").attr("title");
                        const href = $(res).find("a.thumb").attr("href");
                        const tag = $(res).find("a > img").attr("alt");

                        if (!href || !tag) return;

                        const url = "https://www.zerochan.net" + href;

                        const metadata = parseImageMetadata(title);
                        const imageId = $(res)
                            .find("a")
                            .attr("href")
                            ?.split("/")
                            .pop();

                        // Generate image URLs
                        const tagFormatted = tag.split(" ").join(".");
                        const imagePreview = $(res)
                            .find("img")
                            .attr("data-src");
                        const imageFull =
                            imageId && tagFormatted && metadata?.format
                                ? `https://static.zerochan.net/${tagFormatted}.full.${imageId}.${metadata.format}`
                                : url;

                        result.push({
                            quality: title ? title.split(" ")[0] : "N/A",
                            size:
                                metadata?.size ||
                                (title ? title.split(" ")[1] : "N/A"),
                            url,
                            imagePreview: imagePreview,
                            imageFull: imageFull,
                            source:
                                "https://www.zerochan.net" +
                                $(res).find("a").attr("href"),
                            width: metadata?.width,
                            height: metadata?.height,
                            ratio: metadata?.ratio,
                            sizeKb: metadata?.sizeKb,
                            format: metadata?.format,
                            uploader: metadata?.uploader,
                            tag: tag,
                            title: title,
                        });
                    });
            if (result.length === 0) {
                return resolve({ results: [], nextUrl: undefined });
            }
            
            // Generate next page URL
            const nextPage = page + 1;
            const nextUrl = baseSearchUrl.includes('?') 
                ? `${baseSearchUrl}&p=${nextPage}`
                : `${baseSearchUrl}?p=${nextPage}`;
            
            resolve({ results: result, nextUrl });
        } catch (error) {
            reject(error);
        }
    });
