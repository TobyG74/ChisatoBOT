import type { ConfigCommands } from "../../types/commands";
import { downloader, isURL } from "../../utils";

export default <ConfigCommands>{
    name: "youtubeaudio",
    alias: ["yta", "ytmp3", "ytaudio"],
    usage: "<url>",
    category: "downloader",
    description: "Download Audio from Youtube",
    isProcess: true,
    cooldown: 3,
    example: `• /youtubeaudio https://youtu.be/xxxxxxx`,
    async run({ Chisato, from, query, message, command }) {
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        downloader
            .Y2mate(query, "audio")
            .then(async (res) => {
                let caption = `*「 YOUTUBE AUDIO 」*\n\n• Title: ${res.title}\n• Channel: ${res.channel}\n`;
                const result = res.result[0];
                caption +=
                    `• Quality: ${result.quality}p\n` +
                    `• Size: ${result.size}\n` +
                    `• Url: ${res.url}\n\n` +
                    `Available audio qualities:\n`;
                if (res.result.length !== 1) {
                    for (let qty of res.result) {
                        caption += `• ${qty.quality}p\n`;
                    }
                }
                caption += `\nWait a moment, Audio is being sent...`;
                await Chisato.sendImage(from, res.thumbnail, caption, message);
                await Chisato.sendAudio(from, result.url, false, null, message, {
                    fileName: `${res.title}.mp3`,
                });
            })
            .catch((e) => {
                Chisato.log("error", command.name, e);
                Chisato.sendText(
                    from,
                    "There is an error. Please report it to the bot creator immediately!\nMessage : " + e,
                    message
                );
            });
    },
};
