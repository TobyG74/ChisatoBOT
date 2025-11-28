/**
 * Formatting utilities for strings, numbers, dates, and files
 * Centralized formatting logic with consistent output
 */
export class Formatters {
    /**
     * Format milliseconds to HH:MM:SS
     */
    static msToTime(milliseconds: number): string {
        if (typeof milliseconds !== "number" || milliseconds < 0) {
            return "00:00:00";
        }

        let seconds = Math.floor(milliseconds / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);

        seconds = seconds % 60;
        minutes = minutes % 60;
        hours = hours % 24;

        return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(
            seconds
        )}`;
    }

    /**
     * Format seconds to MM:SS (duration format)
     */
    static secToDuration(seconds: number): string {
        if (typeof seconds !== "number" || seconds < 0) {
            return "00:00";
        }

        let minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;

        return `${this.padZero(minutes)}:${this.padZero(seconds)}`;
    }

    /**
     * Format seconds to HH:MM:SS
     */
    static secToTime(seconds: number): string {
        if (typeof seconds !== "number" || seconds < 0) {
            return "00:00:00";
        }

        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);

        seconds = seconds % 60;
        minutes = minutes % 60;

        return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(
            seconds
        )}`;
    }

    /**
     * Format seconds to human-readable runtime (e.g., "2 days, 3 hours, 5 minutes, 10 seconds")
     */
    static runtime(seconds: number): string {
        if (typeof seconds !== "number" || seconds < 0) {
            return "0 seconds";
        }

        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        const parts: string[] = [];
        if (d > 0) parts.push(`${d} ${d === 1 ? "day" : "days"}`);
        if (h > 0) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
        if (m > 0) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
        if (s > 0 || parts.length === 0)
            parts.push(`${s} ${s === 1 ? "second" : "seconds"}`);

        return parts.join(", ");
    }

    /**
     * Format time remaining from timestamp
     */
    static timeRemaining(timestamp: number): string {
        const total = Date.now() - timestamp;
        if (total < 0) return "0 seconds";

        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
        const days = Math.floor(total / (1000 * 60 * 60 * 24));

        const parts: string[] = [];
        if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
        if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
        if (minutes > 0)
            parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
        if (seconds > 0 || parts.length === 0)
            parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);

        return parts.join(" ");
    }

    /**
     * Format bytes to human-readable file size
     */
    static fileSize(bytes: number): string {
        if (typeof bytes !== "number" || bytes < 0) {
            return "0 bytes";
        }

        if (bytes === 0) return "0 bytes";
        if (bytes === 1) return "1 byte";

        const sizes = ["bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const size = bytes / Math.pow(1024, i);

        return `${size.toFixed(2)} ${sizes[i]}`;
    }

    /**
     * Convert bytes to MB
     */
    static bytesToMB(bytes: number): number {
        if (typeof bytes !== "number" || bytes < 0) return 0;
        return bytes / (1024 * 1024);
    }

    /**
     * Format phone number (basic formatting)
     */
    static phoneNumber(number: string): string {
        if (typeof number !== "string") return "";
        // Remove non-numeric characters
        const cleaned = number.replace(/\D/g, "");
        // Format as +XX XXX XXX XXXX (basic international format)
        if (cleaned.length >= 10) {
            return `+${cleaned.slice(0, -10)} ${cleaned.slice(
                -10,
                -7
            )} ${cleaned.slice(-7, -4)} ${cleaned.slice(-4)}`;
        }
        return number;
    }

    /**
     * Truncate string with ellipsis
     */
    static truncate(
        str: string,
        maxLength: number,
        suffix: string = "..."
    ): string {
        if (typeof str !== "string") return "";
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Capitalize first letter of each word
     */
    static titleCase(str: string): string {
        if (typeof str !== "string") return "";
        return str
            .toLowerCase()
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    /**
     * Format number with thousand separators
     */
    static numberWithCommas(num: number): string {
        if (typeof num !== "number") return "0";
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    /**
     * Pad number with leading zeros
     */
    private static padZero(num: number, length: number = 2): string {
        return num.toString().padStart(length, "0");
    }

    /**
     * Format percentage
     */
    static percentage(
        value: number,
        total: number,
        decimals: number = 2
    ): string {
        if (total === 0) return "0%";
        const percent = (value / total) * 100;
        return `${percent.toFixed(decimals)}%`;
    }

    /**
     * Format currency (basic USD format)
     */
    static currency(amount: number, currency: string = "USD"): string {
        if (typeof amount !== "number") return `${currency} 0.00`;
        return `${currency} ${amount
            .toFixed(2)
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    }
}
