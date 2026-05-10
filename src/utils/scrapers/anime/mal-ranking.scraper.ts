import axios from "axios";

// Cache with 30-minute TTL
const rankingCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

const getCached = <T>(key: string): T | null => {
    const entry = rankingCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        rankingCache.delete(key);
        return null;
    }
    return entry.data as T;
};

const setCache = (key: string, data: any): void => {
    rankingCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
};

const withRetry = async <T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 1500
): Promise<T> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            const status = error.response?.status;
            // Don't retry on client errors except 429
            if (status && status !== 429 && status < 500) throw error;
            if (attempt === retries) throw error;
            await new Promise((r) => setTimeout(r, delayMs * attempt));
        }
    }
    throw new Error("Unreachable");
};

export const VALID_ANIME_TYPES: AnimeType[] = [
    "tv",
    "movie",
    "ova",
    "special",
    "ona",
    "music",
    "cm",
    "pv",
    "tv_special",
];

export const VALID_MANGA_TYPES: MangaType[] = [
    "manga",
    "novel",
    "lightnovel",
    "oneshot",
    "doujin",
    "manhwa",
    "manhua",
];

/**
 * Helper function to format numbers with commas
 */
export const numberWithCommas = (x: number): string => {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Format anime information for display
 */
export const formatAnimeInfo = (anime: MalAnimeData): string => {
    const genres = anime.genres?.map((g) => g.name).join(", ") || "n/a";
    const synopsis = anime.synopsis || "No synopsis available";

    return (
        `📺 *${anime.title}*\n\n` +
        `🆔 *MAL ID:* ${anime.mal_id}\n` +
        `🌐 *English:* ${anime.title_english || "n/a"}\n` +
        `🇯🇵 *Japanese:* ${anime.title_japanese || "n/a"}\n\n` +
        `🏆 *Rank:* #${anime.rank}\n` +
        `⭐ *Score:* ${anime.score}/10\n` +
        `🌟 *Popularity:* #${anime.popularity}\n` +
        `📊 *Type:* ${anime.type}\n` +
        `📝 *Status:* ${anime.status}\n` +
        `👥 *Listed Users:* ${numberWithCommas(anime.members)}\n` +
        `🗳️ *Scored By:* ${numberWithCommas(anime.scored_by)}\n` +
        `🎬 *Episodes:* ${anime.episodes || "n/a"}\n` +
        `📅 *Aired:* ${anime.aired?.string || "n/a"}\n` +
        `🎭 *Genres:* ${genres}\n\n` +
        `📖 *Synopsis:*\n${synopsis}`
    );
};

/**
 * Format manga information for display
 */
export const formatMangaInfo = (manga: MalMangaData): string => {
    const genres = manga.genres?.map((g) => g.name).join(", ") || "n/a";
    const authors = manga.authors?.map((a) => a.name).join(", ") || "n/a";
    const synopsis = manga.synopsis || "No synopsis available";

    return (
        `📚 *${manga.title}*\n\n` +
        `🆔 *MAL ID:* ${manga.mal_id}\n` +
        `🌐 *English:* ${manga.title_english || "n/a"}\n` +
        `🇯🇵 *Japanese:* ${manga.title_japanese || "n/a"}\n\n` +
        `🏆 *Rank:* #${manga.rank}\n` +
        `⭐ *Score:* ${manga.score}/10\n` +
        `🌟 *Popularity:* #${manga.popularity}\n` +
        `📊 *Type:* ${manga.type}\n` +
        `📝 *Status:* ${manga.status}\n` +
        `👥 *Listed Users:* ${numberWithCommas(manga.members)}\n` +
        `🗳️ *Scored By:* ${numberWithCommas(manga.scored_by)}\n` +
        `📖 *Chapters:* ${numberWithCommas(manga.chapters || 0) || "n/a"}\n` +
        `📕 *Volumes:* ${numberWithCommas(manga.volumes || 0) || "n/a"}\n` +
        `📅 *Published:* ${manga.published?.string || "n/a"}\n` +
        `✍️ *Authors:* ${authors}\n` +
        `🎭 *Genres:* ${genres}\n\n` +
        `📖 *Synopsis:*\n${synopsis}`
    );
};

/**
 * Fetch anime ranking from MyAnimeList
 */
export const fetchAnimeRanking = async (
    type: AnimeType = "tv",
    limit: number = 25
): Promise<MalApiResponse> => {
    if (!VALID_ANIME_TYPES.includes(type)) {
        throw new Error(
            `Invalid anime type. Valid types are: ${VALID_ANIME_TYPES.join(
                ", "
            )}`
        );
    }

    const cacheKey = `anime:${type}:${limit}`;
    const cached = getCached<MalApiResponse>(cacheKey);
    if (cached) return cached;

    const response = await withRetry(async () => {
        const { data: res } = await axios.get<MalApiResponse>(
            `https://api.jikan.moe/v4/top/anime?type=${type}&limit=${limit}`
        );
        if (!res || !res.data || res.data.length === 0) {
            throw new Error("No anime data found");
        }
        return res;
    });

    setCache(cacheKey, response);
    return response;
};

/**
 * Search anime on MyAnimeList
 */
export const searchAnime = async (
    query: string,
    limit: number = 25
): Promise<MalApiResponse> => {
    if (!query || query.trim() === "") {
        throw new Error("Search query cannot be empty");
    }

    try {
        const { data: response } = await axios.get<MalApiResponse>(
            `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(
                query
            )}&limit=${limit}`
        );

        if (!response || !response.data || response.data.length === 0) {
            throw new Error("No anime found with this query");
        }

        return response;
    } catch (error: any) {
        if (error.response?.status === 429) {
            throw new Error("Too many requests! Please wait and try again.");
        } else if (error.response?.status === 404) {
            throw new Error("Anime not found!");
        }
        throw error;
    }
};

/**
 * Get anime details by ID
 */
export const getAnimeDetails = async (id: number): Promise<MalAnimeData> => {
    if (!id || id <= 0) {
        throw new Error("Invalid anime ID");
    }

    try {
        const { data: response } = await axios.get<{ data: MalAnimeData }>(
            `https://api.jikan.moe/v4/anime/${id}/full`
        );

        if (!response || !response.data) {
            throw new Error("Anime not found");
        }

        return response.data;
    } catch (error: any) {
        if (error.response?.status === 429) {
            throw new Error("Too many requests! Please wait and try again.");
        } else if (error.response?.status === 404) {
            throw new Error("Anime not found!");
        }
        throw error;
    }
};

/**
 * Fetch manga ranking from MyAnimeList
 */
export const fetchMangaRanking = async (
    type: MangaType = "manga",
    limit: number = 25
): Promise<MalMangaApiResponse> => {
    if (!VALID_MANGA_TYPES.includes(type)) {
        throw new Error(
            `Invalid manga type. Valid types are: ${VALID_MANGA_TYPES.join(
                ", "
            )}`
        );
    }

    const cacheKey = `manga:${type}:${limit}`;
    const cached = getCached<MalMangaApiResponse>(cacheKey);
    if (cached) return cached;

    const response = await withRetry(async () => {
        const { data: res } = await axios.get<MalMangaApiResponse>(
            `https://api.jikan.moe/v4/top/manga?type=${type}&limit=${limit}`
        );
        if (!res || !res.data || res.data.length === 0) {
            throw new Error("No manga data found");
        }
        return res;
    });

    setCache(cacheKey, response);
    return response;
};

/**
 * Search manga on MyAnimeList
 */
export const searchManga = async (
    query: string,
    limit: number = 25
): Promise<MalMangaApiResponse> => {
    if (!query || query.trim() === "") {
        throw new Error("Search query cannot be empty");
    }

    try {
        const { data: response } = await axios.get<MalMangaApiResponse>(
            `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(
                query
            )}&limit=${limit}`
        );

        if (!response || !response.data || response.data.length === 0) {
            throw new Error("No manga found with this query");
        }

        return response;
    } catch (error: any) {
        if (error.response?.status === 429) {
            throw new Error("Too many requests! Please wait and try again.");
        } else if (error.response?.status === 404) {
            throw new Error("Manga not found!");
        }
        throw error;
    }
};

/**
 * Get manga details by ID
 */
export const getMangaDetails = async (id: number): Promise<MalMangaData> => {
    if (!id || id <= 0) {
        throw new Error("Invalid manga ID");
    }

    try {
        const { data: response } = await axios.get<{ data: MalMangaData }>(
            `https://api.jikan.moe/v4/manga/${id}/full`
        );

        if (!response || !response.data) {
            throw new Error("Manga not found");
        }

        return response.data;
    } catch (error: any) {
        if (error.response?.status === 429) {
            throw new Error("Too many requests! Please wait and try again.");
        } else if (error.response?.status === 404) {
            throw new Error("Manga not found!");
        }
        throw error;
    }
};

/**
 * Create an increment function for pagination
 */
export const createIncrement = (min: number, max: number) => {
    let current = min - 1;
    return () => {
        current++;
        if (current > max) return null;
        return current;
    };
};
