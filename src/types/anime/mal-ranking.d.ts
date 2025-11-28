declare type MalAnimeData  = {
    mal_id: number;
    title: string;
    title_english?: string;
    title_japanese?: string;
    score: number;
    scored_by: number;
    rank: number;
    popularity: number;
    members: number;
    favorites: number;
    synopsis: string;
    url: string;
    images: {
        jpg: {
            image_url: string;
            large_image_url: string;
        };
        webp: {
            image_url: string;
            large_image_url: string;
        };
    };
    episodes?: number;
    status: string;
    aired: {
        from: string;
        to?: string;
        string: string;
    };
    type: string;
    genres: Array<{ mal_id: number; name: string }>;
    studios?: {
        edges: Array<{ node: { name: string } }>;
    };
    source?: string;
    duration?: string;
    rating?: string;
}

declare type MalMangaData = {
    mal_id: number;
    title: string;
    title_english?: string;
    title_japanese?: string;
    score: number;
    scored_by: number;
    rank: number;
    popularity: number;
    members: number;
    favorites: number;
    synopsis: string;
    url: string;
    images: {
        jpg: {
            image_url: string;
            large_image_url: string;
        };
        webp: {
            image_url: string;
            large_image_url: string;
        };
    };
    chapters?: number;
    volumes?: number;
    status: string;
    published: {
        from: string;
        to?: string;
        string: string;
    };
    type: string;
    genres: Array<{ mal_id: number; name: string }>;
    authors?: Array<{ mal_id: number; name: string }>;
}

declare type MalApiResponse = {
    data: MalAnimeData[];
    pagination: {
        last_visible_page: number;
        has_next_page: boolean;
        current_page: number;
        items: {
            count: number;
            total: number;
            per_page: number;
        };
    };
}

declare type MalMangaApiResponse = {
    data: MalMangaData[];
    pagination: {
        last_visible_page: number;
        has_next_page: boolean;
        current_page: number;
        items: {
            count: number;
            total: number;
            per_page: number;
        };
    };
}

declare type AnimeType =
    | "tv"
    | "movie"
    | "ova"
    | "special"
    | "ona"
    | "music"
    | "cm"
    | "pv"
    | "tv_special";
    
declare type MangaType =
    | "manga"
    | "novel"
    | "lightnovel"
    | "oneshot"
    | "doujin"
    | "manhwa"
    | "manhua";