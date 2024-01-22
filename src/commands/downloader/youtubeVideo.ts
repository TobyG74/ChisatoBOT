import type { ConfigCommands } from "../../types/commands";
import { downloader, isURL } from "../../utils";

export default <ConfigCommands>{
    name: "youtubevideo",
    alias: ["ytv", "ytmp4", "ytvideo"],
    usage: "<url|quality>",
    category: "downloader",
    description: "Download Video from Youtube",
    isProcess: true,
    cooldown: 3,
    example: `
*Quality :*
- 1080p
- 720p
- 480p
- 360p
- 240p
- 144p

*With Spesific Quality*
• /youtubevideo https://youtu.be/xxxxxxxx|720p

*Default Quality 360p*
• /youtubevideo https://youtu.be/xxxxxxxx

*If the video quality is not available, it will automatically download 360p*`,
    async run({ Chisato, from, arg, message, command }) {
        const url = arg.split("|")[0];
        const quality = arg.split("|")[1] || "360" || "240";
        if (!isURL(url)) return Chisato.sendText(from, "Please input a valid url!", message);
        downloader
            .Y2mate(url, "video")
            .then(async (res) => {
                let caption = `*「 YOUTUBE VIDEO 」*\n\n• Title: ${res.title}\n• Channel: ${res.channel}\n`;
                const result = res.result
                    .sort((a, b) => a.quality.localeCompare(b.quality))
                    .find((v) => v.quality === quality.replace("p", ""));
                if (result) {
                    caption +=
                        `• Quality: ${result.quality}p\n` +
                        `• Size: ${result.size}\n` +
                        `• Url: ${res.url}\n\n` +
                        `Available video qualities:\n`;
                    if (res.result.length !== 1) {
                        for (let qty of res.result) {
                            caption += `• ${qty.quality}p\n`;
                        }
                    }
                    caption += `\nWait a moment, Video is being sent...`;
                    await Chisato.sendImage(from, res.thumbnail, caption, message);
                    await Chisato.sendVideo(from, result.url, false, null, message);
                } else {
                    caption +=
                        `• Quality: ${result.quality}p\n` +
                        `• Size: ${result.size}\n` +
                        `• Url: ${res.url}\n\n` +
                        `The resolution you chose is not available. Available video qualities:\n`;
                    if (res.result.length !== 1) {
                        for (let qty of res.result) {
                            caption += `• ${qty.quality}p\n`;
                        }
                    }
                    caption += `\nI will send you the one that is available. Wait a moment, Video is being sent...`;
                    await Chisato.sendImage(from, res.thumbnail, caption, message);
                    await Chisato.sendVideo(from, res.result[0].url, false, null, message);
                }
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
