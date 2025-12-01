import { TextConvert } from './../../utils/converter/text-convert';

declare global {
    interface String {
        toLower(): string;
        toBold(): string;
        toUpper(): string;
        toTitle(): string;
        format(...args: any[]): string;
    }
}

/**
 * Convert string to bold (using Unicode sans-serif bold)
 */
String.prototype.toBold = function (): string {
    return this.split("")
        .map((char) => TextConvert("bold-sans", char))
        .join("")
        .trim();
};

/**
 * Format string with placeholders (%s, %d, etc.)
 */
String.prototype.format = function (...args: any[]): string {
    let result: string = this.toString();

    for (let i = 0; i < args.length; i++) {
        result = result.replace(/%[sdifoxXc]/, String(args[i]));
    }

    return result;
};

/**
 * Convert to lowercase (first character of each word)
 */
String.prototype.toLower = function (): string {
    const separator = this.includes("-") ? "-" : " ";

    return this.split(separator)
        .map((word) => word.charAt(0).toLowerCase() + word.slice(1))
        .join(" ")
        .trim();
};

/**
 * Convert to uppercase (first character of each word)
 */
String.prototype.toUpper = function (): string {
    const separator = this.includes("-") ? "-" : " ";

    return this.split(separator)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
        .trim();
};

/**
 * Convert to title case
 */
String.prototype.toTitle = function (): string {
    return this.toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
        .trim();
};

export {};
