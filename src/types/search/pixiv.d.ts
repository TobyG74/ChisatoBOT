export type PixivSearchType = "artworks" | "slide" | "manga" | "novel";

export interface PixivSearchResult {
    id: string;
    title: string;
    userId: string;
    userName: string;
    type: PixivSearchType;
}

export interface PixivDownloadUrls {
    original: string[];
    sd: string[];
    low: string[];
}

export interface PixivDownloadResult {
    id: string;
    title: string;
    userId: string;
    userName: string;
    pageCount: number;
    url: PixivDownloadUrls;
}

export interface PixivNovelContent {
    id: string;
    title: string;
    likeCount: number;
    userName: string;
    viewCount: number;
    userId: string;
    content: string;
}
