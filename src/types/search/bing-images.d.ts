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
