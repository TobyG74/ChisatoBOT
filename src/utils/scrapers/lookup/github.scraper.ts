import axios from "axios";
import type { GithubUser } from "../../../types/lookup/github";

export type { GithubUser };

const cache = new Map<string, { data: GithubUser; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000;

export const fetchGithubUser = async (username: string): Promise<GithubUser> => {
    const key = username.toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    const { data } = await axios.get<GithubUser>(
        `https://api.github.com/users/${encodeURIComponent(username)}`,
        { timeout: 10000, headers: { "User-Agent": "ChisatoBOT" } }
    );

    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
};
