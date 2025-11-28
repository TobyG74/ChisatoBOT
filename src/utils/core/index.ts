/**
 * Core Utilities - Clean, Reusable, and Efficient
 *
 * This module provides foundational classes and utilities for the entire application:
 * - BaseHTTPClient: HTTP client with retry logic and error handling
 * - BaseScraper: Base class for all scrapers with caching and rate limiting
 * - Validators: Common validation functions
 * - Formatters: String, number, and date formatting utilities
 * - FileUtils: File operations and random generation
 * - ArrayUtils: Array manipulation utilities
 * - CacheManager: In-memory caching with TTL
 */

// Base classes
export * from "./base-http-client";
export * from "./base-scraper";
export * from "./cache-manager";

// Utilities
export * from "./validators";
export * from "./formatters";
export * from "./file-utils";
export * from "./string-utils";

/**
 * Re-export commonly used utilities for convenience
 */
export { Validators } from "./validators";
export { Formatters } from "./formatters";
export { FileUtils, ArrayUtils } from "./file-utils";
export { StringUtils } from "./string-utils";
export { CacheManager, globalCache } from "./cache-manager";
export { BaseHTTPClient } from "./base-http-client";
export { BaseScraper } from "./base-scraper";
