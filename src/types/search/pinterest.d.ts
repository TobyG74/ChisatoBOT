export interface PinterestSearchResult {
    authorUsername: string;
    authorFullname: string;
    follower: number;
    caption: string;
    type: "image" | "video" | "gif";
    url: string;
    pinSource: string;
}

export interface PinterestSearchResponse {
    results: PinterestSearchResult[];
    bookmarks: string[];
}

export interface PinterestDownloadResponse {
    authorUsername: string;
    authorFullname: string;
    follower: number;
    caption: string;
    type: "image" | "video" | "gif";
    url: string;
    pinSource: string;
}
