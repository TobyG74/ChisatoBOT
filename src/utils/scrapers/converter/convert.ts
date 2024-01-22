import fs from "fs";
import { fromBuffer } from "file-type";
import { spawn } from "child_process";
import { getBuffer } from "../../../libs";

export const toAudioMP3 = (url: string): Promise<Buffer> =>
    new Promise(async (resolve, reject) => {
        let buffer = await getBuffer(url);
        let tmp = `./temp/audio_${Date.now()}_${(await fromBuffer(buffer)).ext}`;
        let out = tmp + ".mp3";
        fs.writeFileSync(tmp, buffer);
        spawn("ffmpeg", ["-y", "-i", tmp, "-vn", "-ac", "2", "-b:a", "128k", "-ar", "44100", "-f", "mp3", out])
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
        let buffer = await getBuffer(url);
        let tmp = `./temp/audio_${Date.now()}_${(await fromBuffer(buffer)).ext}`;
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
