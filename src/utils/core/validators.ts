/**
 * Validation utilities for common data types
 * Centralized validation logic to avoid duplication
 */
export class Validators {
    /**
     * Check if string is valid JSON
     */
    static isJSON(str: string): boolean {
        if (typeof str !== "string") return false;
        try {
            const parsed = JSON.parse(str);
            return typeof parsed === "object" && parsed !== null;
        } catch {
            return false;
        }
    }

    /**
     * Check if string is valid URL
     */
    static isURL(str: string): boolean {
        if (typeof str !== "string") return false;
        try {
            const url = new URL(str);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    }

    /**
     * Check if string is valid email
     */
    static isEmail(str: string): boolean {
        if (typeof str !== "string") return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(str);
    }

    /**
     * Check if value is empty (null, undefined, empty string, empty array, empty object)
     */
    static isEmpty(value: any): boolean {
        if (value === null || value === undefined) return true;
        if (typeof value === "string") return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "object") return Object.keys(value).length === 0;
        return false;
    }

    /**
     * Check if value is numeric (string or number)
     */
    static isNumeric(value: any): boolean {
        if (typeof value === "number") return !isNaN(value) && isFinite(value);
        if (typeof value === "string") return /^\d+(\.\d+)?$/.test(value);
        return false;
    }

    /**
     * Validate phone number format (basic validation)
     */
    static isPhoneNumber(str: string): boolean {
        if (typeof str !== "string") return false;
        // Remove common separators
        const cleaned = str.replace(/[\s\-\(\)]/g, "");
        return /^\+?\d{10,15}$/.test(cleaned);
    }

    /**
     * Check if string contains only alphanumeric characters
     */
    static isAlphanumeric(str: string): boolean {
        if (typeof str !== "string") return false;
        return /^[a-zA-Z0-9]+$/.test(str);
    }

    /**
     * Validate array of specific type
     */
    static isArrayOf<T>(
        value: any,
        validator: (item: any) => item is T
    ): value is T[] {
        return Array.isArray(value) && value.every(validator);
    }

    /**
     * Check if value is within range
     */
    static isInRange(value: number, min: number, max: number): boolean {
        return typeof value === "number" && value >= min && value <= max;
    }
}
