import { fetch } from "undici";
import type {
    PixivDownloadResult,
    PixivNovelContent,
    PixivSearchResult,
} from "../../../types/search/pixiv";

const URL_API_DOWNLOAD_MANGA = (input: string) =>
    `https://www.pixiv.net/ajax/illust/${input}/pages?lang=en`;
const URL_API_DOWNLOAD_MANGA_DETAIL = (input: string) =>
    `https://www.pixiv.net/ajax/illust/${input}`;
const URL_API_DOWNLOAD_ARTWORKS = (input: string) =>
    `https://www.pixiv.net/ajax/illust/${input}`;
const URL_API_CONTENT_NOVEL = (input: string) =>
    `https://www.pixiv.net/ajax/novel/${input}`;
const URL_API_SEARCH_MANGA = (keyword: string, page: number) =>
    `https://www.pixiv.net/ajax/search/manga/${encodeURIComponent(keyword)}?word=${encodeURIComponent(
        keyword
    )}&order=date_d&mode=safe&p=${page}&s_mode=s_tag&type=manga&work_lang=en&lang=en`;
const URL_API_SEARCH_NOVEL = (keyword: string, page: number) =>
    `https://www.pixiv.net/ajax/search/novels/${encodeURIComponent(keyword)}?word=${encodeURIComponent(
        keyword
    )}&order=date_d&mode=all&p=${page}&s_mode=s_tag&gs=0&lang=en`;
const URL_API_SEARCH_ARTWORKS = (keyword: string, page: number) =>
    `https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(keyword)}?word=${encodeURIComponent(
        keyword
    )}&order=date_d&mode=all&p=${page}&s_mode=s_tag&type=all&lang=en`;

const DEFAULT_HEADERS = {
    "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    referer: "https://www.pixiv.net/",
};

export class PixivScraper {
    private async fetchJSON<T = any>(url: string): Promise<T> {
        const response = await fetch(url, { headers: DEFAULT_HEADERS });
        return response.json() as Promise<T>;
    }

    async searchArtwork(keyword: string, page = 1): Promise<PixivSearchResult[]> {
        const { body } = await this.fetchJSON<any>(
            URL_API_SEARCH_ARTWORKS(keyword, page)
        );

        if (!body?.illustManga?.data?.length) {
            throw new Error("No art found with this keyword.");
        }

        return body.illustManga.data.map(
            ({ id, title, userId, userName, pageCount }: any) => ({
                id: String(id),
                title,
                userId: String(userId),
                userName,
                type: pageCount > 1 ? "slide" : "artworks",
            })
        );
    }

    async searchManga(keyword: string, page = 1): Promise<PixivSearchResult[]> {
        const { body } = await this.fetchJSON<any>(
            URL_API_SEARCH_MANGA(keyword, page)
        );

        if (!body?.manga?.data?.length) {
            throw new Error("No manga found with this keyword.");
        }

        return body.manga.data.map(({ id, title, userId, userName }: any) => ({
            id: String(id),
            title,
            userId: String(userId),
            userName,
            type: "manga",
        }));
    }

    async searchNovel(keyword: string, page = 1): Promise<PixivSearchResult[]> {
        const { body } = await this.fetchJSON<any>(
            URL_API_SEARCH_NOVEL(keyword, page)
        );

        if (!body?.novel?.data?.length) {
            throw new Error("No novel found with this keyword.");
        }

        return body.novel.data.map(({ id, title, userId, userName }: any) => ({
            id: String(id),
            title,
            userId: String(userId),
            userName,
            type: "novel",
        }));
    }

    async getNovelContent(input: string): Promise<PixivNovelContent> {
        const { body, error } = await this.fetchJSON<any>(URL_API_CONTENT_NOVEL(input));

        if (error || !body) {
            throw new Error("No novel content found with this keyword.");
        }

        const { title, likeCount, userName, viewCount, userId, content, id } = body;
        return {
            id: String(id),
            title,
            likeCount: Number(likeCount) || 0,
            userName,
            viewCount: Number(viewCount) || 0,
            userId: String(userId),
            content: content ?? "",
        };
    }

    async downloadManga(input: string): Promise<PixivDownloadResult> {
        const detail = await this.fetchJSON<any>(URL_API_DOWNLOAD_MANGA_DETAIL(input));
        const { id, title, userId, userName, pageCount } = detail.body;
        const { body } = await this.fetchJSON<any>(URL_API_DOWNLOAD_MANGA(input));

        return {
            id: String(id),
            title,
            userId: String(userId),
            userName,
            pageCount: Number(pageCount) || 0,
            url: {
                original: body.map((v: any) => v.urls.original),
                sd: body.map((v: any) => v.urls.regular),
                low: body.map((v: any) => v.urls.thumb_mini),
            },
        };
    }

    async downloadArtworks(input: string): Promise<PixivDownloadResult> {
        const { body, error } = await this.fetchJSON<any>(URL_API_DOWNLOAD_ARTWORKS(input));

        if (error || !body) {
            throw new Error("No downloadable media found with this keyword.");
        }

        const { id, title, userId, userName, pageCount } = body;

        return {
            id: String(id),
            title,
            userId: String(userId),
            userName,
            pageCount: Number(pageCount) || 0,
            url:
                pageCount !== 1
                    ? (await this.downloadManga(input)).url
                    : {
                          original: [body.urls.original],
                          sd: [body.urls.regular],
                          low: [body.urls.thumb],
                      },
        };
    }
}
