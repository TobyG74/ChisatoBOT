export interface BingImageResult {
    url: string;
    width: number;
    height: number;
}

export interface BingImagesSearchOptions {
    searchTerm: string;
    queryStringAddition?: string;
    filterOutDomains?: string[];
    userAgent?: string;
}
