export interface DDGImageResult {
    url: string;
    thumbnail: string;
    width: number;
    height: number;
    title: string;
    source: string;
}

export interface DDGImagesSearchOptions {
    count?: number;
    safeSearch?: "off" | "moderate" | "strict";
}
