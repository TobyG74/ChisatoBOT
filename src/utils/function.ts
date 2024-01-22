import { randomBytes } from "crypto";
import fs from "fs";

export const isJSON = (str: string) => {
    try {
        JSON.parse(str);
    } catch {
        return false;
    }
    return true;
};

export const isURL = (str: any) => {
    let url: URL;
    try {
        url = new URL(str);
    } catch {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
};

export const generateRandomNumber = (length) => {
    if (length <= 0) {
        return "";
    }

    let result = "";
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10);
    }

    return result;
};

export const fileformat = (url: string) => {
    const array = url.split("/");
    return array[array.length - 1].split(".")[1];
};

export const runtime = (seconds: number) => {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor((seconds % (3600 * 24)) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
};

export const removeDuplicateArray = (array = []) => {
    const arr = new Set(array);
    const uniqueArray = [];
    for (const value of arr) {
        if (uniqueArray.indexOf(value) === -1) {
            uniqueArray.push(value);
        }
    }
    return uniqueArray;
};

export const toMB = (size: number) => {
    return size / 1024 ** 2;
};

const padTo2Digits = (num: number) => {
    return num.toString().padStart(2, "0");
};

export const getFilesize = (filename: string) => {
    const stats = fs.statSync(filename);
    let bytes = stats.size;
    let size: string;
    if (bytes >= 1073741824) {
        size = (bytes / 1073741824).toFixed(2) + " GB";
    } else if (bytes >= 1048576) {
        size = (bytes / 1048576).toFixed(2) + " MB";
    } else if (bytes >= 1024) {
        size = (bytes / 1024).toFixed(2) + " KB";
    } else if (bytes > 1) {
        size = bytes + " bytes";
    } else if (bytes == 1) {
        size = bytes + " byte";
    } else {
        size = "0 bytes";
    }
    return size;
};

export const convertMsToTime = (milliseconds: number) => {
    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
};

export const convertSecToDuration = (seconds: number) => {
    let minutes = Math.floor(seconds / 60);

    seconds = seconds % 60;

    return `${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
};

export const convertSecToTime = (seconds: number) => {
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;

    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
};

export const getRemaining = (time: number) => {
    const total = Date.now() - time;
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return (
        (days ? (days > 1 ? days + " days " : days == 1 ? " day " : "") : "") +
        (hours ? (hours > 1 ? hours + " hours " : hours == 1 ? " hour " : "") : "") +
        (minutes ? (minutes > 1 ? minutes + " minutes " : minutes == 1 ? " minute " : "") : "") +
        (seconds ? (seconds > 1 ? seconds + " seconds " : seconds == 1 ? " second " : "") : "")
    );
};

export const getRandom = (ext: string) => {
    return randomBytes(7).toString("hex").toUpperCase() + ext;
};

export const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
