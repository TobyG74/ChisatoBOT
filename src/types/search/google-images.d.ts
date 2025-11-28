export interface GoogleImageResult {
    url: string;
    width: number;
    height: number;
}

export interface GoogleImagesSearchOptions {
    searchTerm: string;
    queryStringAddition?: string;
    filterOutDomains?: string[];
    userAgent?: string;
}
