/**
 * Connection Constants and Enums
 * Centralized connection-related constants
 */

import type { DisconnectReason } from "@whiskeysockets/baileys";

export const CONNECTION_CONFIG = {
    MAX_RETRY_ATTEMPTS: 2,
    RECONNECT_DELAY: 3000, 
    QR_TIMEOUT: 60000, 
} as const;

export const DISCONNECT_MESSAGES: Record<number, string> = {
    500: "Bad Session", 
    428: "Connection Closed", 
    408: "Connection Lost / Timed Out", 
    440: "Connection Replaced", 
    401: "Logged Out", 
    515: "Restart Required", 
    411: "Multidevice Mismatch", 
    403: "Forbidden", 
    503: "Unavailable Service", 
};

export const RECONNECT_REASONS = [
    428, 
    408, 
    515, 
];

export const RESCAN_REASONS = [
    401,
];

export const RETRY_REASONS = [
    500,
    411,
    403,
    503, 
];

/**
 * Check if reason requires reconnection
 */
export function shouldReconnect(reason: number): boolean {
    return RECONNECT_REASONS.includes(reason);
}

/**
 * Check if reason requires QR rescan
 */
export function shouldRescan(reason: number): boolean {
    return RESCAN_REASONS.includes(reason);
}

/**
 * Check if reason allows retry
 */
export function canRetry(reason: number, attempts: number): boolean {
    return (
        RETRY_REASONS.includes(reason) &&
        attempts < CONNECTION_CONFIG.MAX_RETRY_ATTEMPTS
    );
}

/**
 * Get human-readable disconnect message
 */
export function getDisconnectMessage(reason: number): string {
    return DISCONNECT_MESSAGES[reason] || `Unknown Reason (${reason})`;
}
