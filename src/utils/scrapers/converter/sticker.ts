import petPetGif from "pet-pet-gif";
import fs from "fs";
import Axios from "axios";
import AI2D from "@arugaz/ai2d";

export class Sticker {
    static Anime = async (buffer: Buffer) => {
        try {
            const result = await AI2D(buffer, {
                proxy: process.env.PROXY,
                crop: "SINGLE",
            });
            return result;
        } catch (e) {
            return e;
        }
    };

    static Pet = async (param: string, filename: string) => {
        let animatedGif = await petPetGif(param);
        fs.writeFileSync(filename, animatedGif);
        return filename;
    };

    static emojiMix = async (emoji1: string, emoji2: string) => {
        return new Promise(async (resolve, reject) => {
            await Axios.get(
                `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(
                    emoji1
                )}_${encodeURIComponent(emoji2)}`
            )
                .then(({ data }) => {
                    if (data.results.length === 0) {
                        resolve({
                            error: `${emoji1} and ${emoji2} cannot be combined! Try different emojis...`,
                            message: `${emoji1} and ${emoji2} cannot be combined! Try different emojis...`,
                        });
                    }
                    resolve({ url: data.results[0].url });
                })
                .catch((e) => reject(e));
        });
    };

    static memeGen = async (top: string, bottom: string, url: string) => {
        return new Promise(async (resolve, reject) => {
            await Axios.get(`https://api.memegen.link/images/custom/${top}/${bottom}.png?background=${url}`, {
                headers: {
                    DNT: 1,
                    "Upgrade-Insecure-Request": 1,
                },
                responseType: "arraybuffer",
            })
                .then(({ data }) => {
                    resolve(data);
                })
                .catch((e) => reject(e));
        });
    };
}
