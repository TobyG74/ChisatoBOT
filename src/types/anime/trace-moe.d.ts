export interface TraceMoeResult {
    frameCount: number;
    error: string;
    result: TraceMoeMatch[];
}

export interface TraceMoeMatch {
    anilist: number;
    filename: string;
    episode: number | null;
    from: number;
    to: number;
    similarity: number;
    video: string;
    image: string;
}

export interface TraceMoeAnilistInfo {
    id: number;
    idMal: number;
    title: {
        romaji: string;
        english: string | null;
        native: string;
    };
    synonyms: string[];
    isAdult: boolean;
}
