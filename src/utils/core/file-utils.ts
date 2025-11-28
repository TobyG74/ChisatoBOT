import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

/**
 * File and system utilities
 * Handle file operations, random generation, and array operations
 */
export class FileUtils {
    /**
     * Get file size from filesystem
     */
    static getFileSize(filePath: string): string {
        try {
            const stats = fs.statSync(filePath);
            const bytes = stats.size;

            if (bytes >= 1073741824) {
                return (bytes / 1073741824).toFixed(2) + " GB";
            } else if (bytes >= 1048576) {
                return (bytes / 1048576).toFixed(2) + " MB";
            } else if (bytes >= 1024) {
                return (bytes / 1024).toFixed(2) + " KB";
            } else if (bytes > 1) {
                return bytes + " bytes";
            } else if (bytes === 1) {
                return bytes + " byte";
            } else {
                return "0 bytes";
            }
        } catch (error) {
            throw new Error(
                `Failed to get file size: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Get file extension from URL or path
     */
    static getExtension(urlOrPath: string): string {
        if (typeof urlOrPath !== "string") return "";
        const parts = urlOrPath.split("/");
        const filename = parts[parts.length - 1];
        const extension = filename.split(".").pop();
        return extension || "";
    }

    /**
     * Generate random filename with extension
     */
    static randomFilename(extension: string): string {
        const random = randomBytes(7).toString("hex").toUpperCase();
        return `${random}${
            extension.startsWith(".") ? extension : "." + extension
        }`;
    }

    /**
     * Generate random number string
     */
    static randomNumber(length: number): string {
        if (length <= 0) return "";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += Math.floor(Math.random() * 10);
        }
        return result;
    }

    /**
     * Generate random alphanumeric string
     */
    static randomString(length: number): string {
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Generate random hex string
     */
    static randomHex(bytes: number = 16): string {
        return randomBytes(bytes).toString("hex");
    }

    /**
     * Sleep/delay utility
     */
    static sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Check if file exists
     */
    static fileExists(filePath: string): boolean {
        try {
            return fs.existsSync(filePath);
        } catch {
            return false;
        }
    }

    /**
     * Ensure directory exists (create if not)
     */
    static ensureDir(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Read JSON file safely
     */
    static readJSON<T = any>(filePath: string): T | null {
        try {
            const content = fs.readFileSync(filePath, "utf-8");
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    /**
     * Write JSON file safely
     */
    static writeJSON(
        filePath: string,
        data: any,
        pretty: boolean = true
    ): boolean {
        try {
            const content = pretty
                ? JSON.stringify(data, null, 2)
                : JSON.stringify(data);
            fs.writeFileSync(filePath, content, "utf-8");
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file MIME type from extension
     */
    static getMimeType(extension: string): string {
        const ext = extension.toLowerCase().replace(".", "");
        const mimeTypes: Record<string, string> = {
            // Images
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
            // Videos
            mp4: "video/mp4",
            webm: "video/webm",
            avi: "video/x-msvideo",
            mov: "video/quicktime",
            // Audio
            mp3: "audio/mpeg",
            wav: "audio/wav",
            ogg: "audio/ogg",
            // Documents
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            // Others
            json: "application/json",
            xml: "application/xml",
            zip: "application/zip",
        };
        return mimeTypes[ext] || "application/octet-stream";
    }
}

/**
 * Array utilities
 */
export class ArrayUtils {
    /**
     * Remove duplicates from array
     */
    static removeDuplicates<T>(array: T[]): T[] {
        return Array.from(new Set(array));
    }

    /**
     * Shuffle array randomly
     */
    static shuffle<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /**
     * Get random element from array
     */
    static random<T>(array: T[]): T | undefined {
        if (array.length === 0) return undefined;
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Chunk array into smaller arrays
     */
    static chunk<T>(array: T[], size: number): T[][] {
        const result: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    }

    /**
     * Group array by key
     */
    static groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
        return array.reduce((result, item) => {
            const groupKey = String(item[key]);
            if (!result[groupKey]) {
                result[groupKey] = [];
            }
            result[groupKey].push(item);
            return result;
        }, {} as Record<string, T[]>);
    }

    /**
     * Find unique items by key
     */
    static uniqueBy<T>(array: T[], key: keyof T): T[] {
        const seen = new Set();
        return array.filter((item) => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }
}
