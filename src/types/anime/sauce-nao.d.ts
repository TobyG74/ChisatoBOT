/**
 * SauceNAO API Response Types
 * Based on saucenao.com reverse image search
 */

/**
 * SauceNAO search result
 */
interface SauceNaoResult {
	/** Title of the found source */
	title: string;
	
	/** Description or additional info */
	description: string;
	
	/** Similarity percentage (0-100) */
	similarity: number;
	
	/** MyAnimeList URL (optional) */
	MAL?: string;
	
	/** Error message if search failed */
	error?: string;
}
