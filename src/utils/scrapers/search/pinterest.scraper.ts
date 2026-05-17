import { fetch } from "undici";
import type {
    PinterestDownloadResponse,
    PinterestSearchResponse,
    PinterestSearchResult,
} from "../../../types/search/pinterest";

const API_BASE = (input: string) => `https://id.pinterest.com/pin/${input}`;
const PIN_URL_REGEX = new RegExp(
    "https?://(?:[^/]+.)?pinterest.(?:com|fr|de|ch|jp|cl|ca|it|co.uk|nz|ru|com.au|at|pt|co.kr|es|com.mx|dk|ph|th|com.uy|co|nl|info|kr|ie|vn|com.vn|ec|mx|in|pe|co.at|hu|co.in|co.nz|id|com.ec|com.py|tw|be|uk|com.bo|com.pe)"
);
const PIN_ID_REGEX = /\/?pin\/?([\d]+)/;

const headers = {
    search: {
        "X-Pinterest-PWS-Handler": "www/search/[scope].js",
    },
    download: {
        "X-Pinterest-PWS-Handler": "www/pin/[id].js",
    },
};

export class PinterestScraper {
    private getSafeHttpUrl(value: unknown): string {
        const normalized = String(value || "").trim();
        if (!/^https?:\/\//i.test(normalized)) {
            return "";
        }
        return normalized;
    }

    private getImageVariantsFromMap(
        images: Record<string, any> | undefined | null
    ): { url: string; width: number; height: number }[] {
        if (!images || typeof images !== "object") {
            return [] as { url: string; width: number; height: number }[];
        }

        const variants: { url: string; width: number; height: number }[] = [];

        for (const [key, value] of Object.entries(images)) {
            const url = this.getSafeHttpUrl(value?.url || value);
            if (!url) {
                continue;
            }

            const width = Number(value?.width || String(key).match(/(\d+)x/i)?.[1] || 0);
            const height = Number(value?.height || String(key).match(/x(\d+)/i)?.[1] || 0);

            variants.push({
                url,
                width: Number.isFinite(width) ? width : 0,
                height: Number.isFinite(height) ? height : 0,
            });
        }

        return variants;
    }

    private resolvePinImageUrls(payload: any) {
        const variants = this.getImageVariantsFromMap(payload?.images);
        const sortedByArea = [...variants].sort(
            (a, b) => b.width * b.height - a.width * a.height
        );

        const originalUrl =
            this.getSafeHttpUrl(payload?.original?.url) ||
            this.getSafeHttpUrl(payload?.url) ||
            this.getSafeHttpUrl(payload?.original) ||
            this.getSafeHttpUrl(payload?.image_url) ||
            this.getSafeHttpUrl(payload?.image) ||
            this.getSafeHttpUrl(payload?.images?.orig?.url) ||
            sortedByArea[0]?.url ||
            "";

        const previewUrl =
            this.getSafeHttpUrl(payload?.thumbnail?.url) ||
            this.getSafeHttpUrl(payload?.previewUrl) ||
            this.getSafeHttpUrl(payload?.thumbnail) ||
            this.getSafeHttpUrl(payload?.images?.["474x"]?.url) ||
            this.getSafeHttpUrl(payload?.images?.["236x"]?.url) ||
            sortedByArea[sortedByArea.length - 1]?.url ||
            originalUrl;

        return {
            originalUrl,
            previewUrl: previewUrl || originalUrl,
        };
    }

    async search(
        query: string,
        options: { bookmarks?: string[]; pageSize?: number } = {}
    ): Promise<PinterestSearchResponse> {
        const bookmarks = Array.isArray(options.bookmarks) ? options.bookmarks : [];
        const pageSize = Number.isFinite(options.pageSize) ? options.pageSize : undefined;

        const context = {
            source_url: `/search/pins/q=${query}`,
            data: JSON.stringify({
                options: {
                    isPrefetch: false,
                    query,
                    scope: "pins",
                    no_fetch_context_on_resource: false,
                    context: {},
                    bookmarks,
                    ...(pageSize ? { page_size: pageSize } : {}),
                },
            }),
            _: String(Date.now()),
        };

        const path = new URLSearchParams({
            source_url: context.source_url,
            data: context.data,
            _: context._,
        });
        const response = await fetch(`https://pinterest.com/resource/BaseSearchResource/get/?${path.toString()}`, {
            headers: headers.search,
        });

        const json: any = await response.json();
        const resourceResponse = json?.resource_response;
        const data = resourceResponse?.data?.results || [];

        const results: PinterestSearchResult[] = data
            .map((result: any) => {
                const videoList = result?.videos?.video_list || {};
                const videos = Object.entries(videoList) as Array<
                    [string, { url?: string }]
                >;
                const isVideos = videos.length > 0;
                let mediaUrl: string | null = null;

                if (isVideos) {
                    mediaUrl = videos.find(([, value]) =>
                        Boolean(value?.url?.endsWith(".mp4"))
                    )?.[1]?.url;

                    if (!mediaUrl) {
                        return null;
                    }
                }

                if (!mediaUrl) {
                    mediaUrl = this.resolvePinImageUrls(result).originalUrl;
                }

                if (!mediaUrl) {
                    return null;
                }

                return {
                    authorUsername: result.pinner.username,
                    authorFullname: result.pinner.full_name,
                    follower: result.pinner.follower_count,
                    caption: result.grid_title || "No caption",
                    type: isVideos ? "video" : mediaUrl.endsWith(".gif") ? "gif" : "image",
                    url: mediaUrl,
                    pinSource: API_BASE(result.id),
                } as PinterestSearchResult;
            })
            .filter(Boolean);

        return {
            results,
            bookmarks: resourceResponse?.bookmarks || json?.resource?.options?.bookmarks || [],
        };
    }

    async download(url: string): Promise<PinterestDownloadResponse> {
        const pinId = await this.resolvePinId(url);

        const context = {
            source_url: `/pin/${pinId}/`,
            data: JSON.stringify({
                options: {
                    field_set_key: "detailed",
                    ptrf: null,
                    fetch_visual_search_objects: true,
                    id: pinId,
                    context: {},
                },
            }),
            module_path: "Pin(show_pinner=true,+show_board=true,+is_original_pin_in_related_pins_grid=true)",
            _: String(Date.now()),
        };

        const path = new URLSearchParams({
            source_url: context.source_url,
            data: context.data,
            module_path: context.module_path,
            _: context._,
        });
        const response = await fetch(`https://www.pinterest.com/resource/PinResource/get/?${path.toString()}`, {
            headers: headers.download,
        });

        const json: any = await response.json();
        const resourceResponse = json?.resource_response;
        if (resourceResponse?.status !== "success") {
            throw new Error("Could not process pinterest media.");
        }

        const data = resourceResponse.data;
        const videoList = data?.videos?.video_list || {};
        const videos = Object.entries(videoList) as Array<
            [string, { url?: string }]
        >;
        const isVideos = videos.length > 0;
        let mediaUrl: string | null = null;

        if (isVideos) {
            mediaUrl = videos.find(([, value]) =>
                Boolean(value?.url?.endsWith(".mp4"))
            )?.[1]?.url || null;
        }

        if (!mediaUrl) {
            mediaUrl = this.resolvePinImageUrls(data).originalUrl;
        }

        if (!mediaUrl) {
            throw new Error("Could not process pinterest media.");
        }

        return {
            authorUsername: data.pinner.username,
            authorFullname: data.pinner.full_name,
            follower: data.pinner.follower_count,
            caption: data.grid_title || "No caption",
            type: isVideos ? "video" : mediaUrl.endsWith(".gif") ? "gif" : "image",
            url: mediaUrl,
            pinSource: API_BASE(data.id),
        };
    }

    private async resolvePinId(url: string): Promise<string> {
        if (PIN_URL_REGEX.test(url)) {
            return PIN_ID_REGEX.exec(url)?.[1] || "";
        }

        const response = await fetch(url, { method: "HEAD" });
        return PIN_ID_REGEX.exec(response.url)?.[1] || "";
    }
}
