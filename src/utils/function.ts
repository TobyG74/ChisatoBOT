/**
 * Legacy function exports - maintained for backward compatibility
 *
 * @deprecated These functions are now available in organized modules:
 * - Validators: For validation functions (isJSON, isURL, etc.)
 * - Formatters: For formatting functions (runtime, convertMsToTime, etc.)
 * - FileUtils: For file operations (getFilesize, getRandom, etc.)
 * - ArrayUtils: For array operations (removeDuplicateArray, etc.)
 *
 * Please migrate to new modular utilities in /core directory
 */

import { Validators } from "./core/validators";
import { Formatters } from "./core/formatters";
import { FileUtils, ArrayUtils } from "./core/file-utils";

// ===== Validation Functions =====
/** @deprecated Use Validators.isJSON() */
export const isJSON = (str: string): boolean => Validators.isJSON(str);

/** @deprecated Use Validators.isURL() */
export const isURL = (str: any): boolean => Validators.isURL(str);

// ===== File Functions =====
/** @deprecated Use FileUtils.randomNumber() */
export const generateRandomNumber = (length: number): string =>
    FileUtils.randomNumber(length);

/** @deprecated Use FileUtils.getExtension() */
export const fileformat = (url: string): string => FileUtils.getExtension(url);

/** @deprecated Use FileUtils.getFileSize() */
export const getFilesize = (filename: string): string =>
    FileUtils.getFileSize(filename);

/** @deprecated Use FileUtils.randomFilename() */
export const getRandom = (ext: string): string => FileUtils.randomFilename(ext);

/** @deprecated Use FileUtils.sleep() */
export const sleep = (ms: number): Promise<void> => FileUtils.sleep(ms);

// ===== Formatting Functions =====
/** @deprecated Use Formatters.runtime() */
export const runtime = (seconds: number): string => Formatters.runtime(seconds);

/** @deprecated Use Formatters.bytesToMB() */
export const toMB = (size: number): number => Formatters.bytesToMB(size);

/** @deprecated Use Formatters.msToTime() */
export const convertMsToTime = (milliseconds: number): string =>
    Formatters.msToTime(milliseconds);

/** @deprecated Use Formatters.secToDuration() */
export const convertSecToDuration = (seconds: number): string =>
    Formatters.secToDuration(seconds);

/** @deprecated Use Formatters.secToTime() */
export const convertSecToTime = (seconds: number): string =>
    Formatters.secToTime(seconds);

/** @deprecated Use Formatters.timeRemaining() */
export const getRemaining = (time: number): string =>
    Formatters.timeRemaining(time);

// ===== Array Functions =====
/** @deprecated Use ArrayUtils.removeDuplicates() */
export const removeDuplicateArray = <T = any>(array: T[] = []): T[] =>
    ArrayUtils.removeDuplicates(array);
