/**
 * String utility functions for text processing
 */

export class StringUtils {
    /**
     * Calculate Levenshtein distance between two strings
     * Used for finding similarity between command names
     * @param str1 First string
     * @param str2 Second string
     * @returns Distance value (lower = more similar)
     */
    static levenshteinDistance(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;

        // Create 2D array for dynamic programming
        const dp: number[][] = Array(len1 + 1)
            .fill(null)
            .map(() => Array(len2 + 1).fill(0));

        // Initialize base cases
        for (let i = 0; i <= len1; i++) {
            dp[i][0] = i;
        }
        for (let j = 0; j <= len2; j++) {
            dp[0][j] = j;
        }

        // Fill the dp table
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] =
                        Math.min(
                            dp[i - 1][j], // deletion
                            dp[i][j - 1], // insertion
                            dp[i - 1][j - 1] // substitution
                        ) + 1;
                }
            }
        }

        return dp[len1][len2];
    }

    /**
     * Calculate similarity percentage between two strings
     * @param str1 First string
     * @param str2 Second string
     * @returns Similarity percentage (0-100)
     */
    static similarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) {
            return 100.0;
        }

        const distance = this.levenshteinDistance(
            longer.toLowerCase(),
            shorter.toLowerCase()
        );
        return ((longer.length - distance) / longer.length) * 100;
    }

    /**
     * Find most similar strings from array
     * @param input Input string to compare
     * @param candidates Array of candidate strings
     * @param threshold Minimum similarity threshold (0-100)
     * @param maxResults Maximum number of results to return
     * @returns Array of similar strings sorted by similarity
     */
    static findSimilar(
        input: string,
        candidates: string[],
        threshold: number = 50,
        maxResults: number = 3
    ): Array<{ text: string; similarity: number }> {
        const results = candidates
            .map((candidate) => ({
                text: candidate,
                similarity: this.similarity(input, candidate),
            }))
            .filter((result) => result.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults);

        return results;
    }

    /**
     * Check if string starts with any prefix from array
     * @param str String to check
     * @param prefixes Array of prefixes
     * @returns True if string starts with any prefix
     */
    static startsWithAny(str: string, prefixes: string[]): boolean {
        return prefixes.some((prefix) => str.startsWith(prefix));
    }

    /**
     * Remove prefix from string
     * @param str String to process
     * @param prefix Prefix to remove
     * @returns String without prefix
     */
    static removePrefix(str: string, prefix: string): string {
        if (str.startsWith(prefix)) {
            return str.slice(prefix.length);
        }
        return str;
    }

    /**
     * Capitalize first letter of string
     * @param str String to capitalize
     * @returns Capitalized string
     */
    static capitalize(str: string): string {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Truncate string to specified length
     * @param str String to truncate
     * @param maxLength Maximum length
     * @param suffix Suffix to add if truncated
     * @returns Truncated string
     */
    static truncate(
        str: string,
        maxLength: number,
        suffix: string = "..."
    ): string {
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength - suffix.length) + suffix;
    }
}
