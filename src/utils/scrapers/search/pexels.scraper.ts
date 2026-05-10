import axios from "axios";

export interface PexelsImageResult {
    url: string;
    thumbnail: string;
    width: number;
    height: number;
    title: string;
    source: string;
}

export class PexelsScraper {
    async search(searchTerm: string, perPage = 60): Promise<PexelsImageResult[]> {
        const response = await axios.get("https://api.pexels.com/v1/search", {
            params: { query: searchTerm, per_page: perPage, page: 1 },
            timeout: 15000,
        });

        const photos: any[] = response.data?.photos ?? [];

        if (photos.length === 0) {
            throw new Error("No images found for the search query. Try different keywords.");
        }

        return photos.map((photo) => ({
            url: photo.src?.large ?? photo.src?.original ?? "",
            thumbnail: photo.src?.medium ?? "",
            width: photo.width ?? 0,
            height: photo.height ?? 0,
            title: photo.alt || searchTerm,
            source: photo.url ?? "",
        }));
    }
}
