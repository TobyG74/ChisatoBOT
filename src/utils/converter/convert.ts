import fs from "fs";
import { fromBuffer } from "file-type";
import { spawn } from "child_process";
import { BaseHTTPClient } from "../core/base-http-client";

// HTTP client for downloading files
const httpClient = new BaseHTTPClient({ timeout: 15000, maxRetries: 3 });

export const toAudioMP3 = (url: string): Promise<Buffer> =>
    new Promise(async (resolve, reject) => {
        let buffer = await httpClient["getBuffer"](url);
        let tmp = `./temp/audio_${Date.now()}_${
            (await fromBuffer(buffer)).ext
        }`;
        let out = tmp + ".mp3";
        fs.writeFileSync(tmp, buffer);
        spawn("ffmpeg", [
            "-y",
            "-i",
            tmp,
            "-vn",
            "-ac",
            "2",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-f",
            "mp3",
            out,
        ])
            .on("error", (e) => {
                reject(e);
                fs.unlinkSync(tmp);
                buffer = null;
            })
            .on("close", () => {
                fs.unlinkSync(tmp);
                resolve(fs.readFileSync(out));
                buffer = null;
                if (fs.existsSync(out)) fs.unlinkSync(out);
            });
    });

export const toAudioOpus = (url: string): Promise<Buffer> =>
    new Promise(async (resolve, reject) => {
        let buffer = await httpClient["getBuffer"](url);
        let tmp = `./temp/audio_${Date.now()}_${
            (await fromBuffer(buffer)).ext
        }`;
        let out = tmp + ".opus";
        fs.writeFileSync(tmp, buffer);
        spawn("ffmpeg", [
            "-y",
            "-i",
            tmp,
            "-acodec",
            "libopus",
            "-b:a",
            "128k",
            "-vbr",
            "on",
            "-compression_level",
            "10",
            out,
        ])
            .on("error", (e) => {
                reject(e);
                fs.unlinkSync(tmp);
                buffer = null;
            })
            .on("close", () => {
                fs.unlinkSync(tmp);
                resolve(fs.readFileSync(out));
                buffer = null;
                if (fs.existsSync(out)) fs.unlinkSync(out);
            });
    });

export const toVideoMP4 = (url: string): Promise<Buffer> =>
    new Promise(async (resolve, reject) => {
        let buffer = await httpClient["getBuffer"](url);
        let tmp = `./temp/video_${Date.now()}_${
            (await fromBuffer(buffer)).ext
        }`;
        let out = tmp + ".mp4";
        fs.writeFileSync(tmp, buffer);
        spawn("ffmpeg", [
            "-y",
            "-i",
            tmp,
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            out,
        ])
            .on("error", (e) => {
                reject(e);
                fs.unlinkSync(tmp);
                buffer = null;
            })
            .on("close", () => {
                fs.unlinkSync(tmp);
                resolve(fs.readFileSync(out));
                buffer = null;
                if (fs.existsSync(out)) fs.unlinkSync(out);
            });
    });