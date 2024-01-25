import type { ConfigCommands } from "../../types/commands";
import { downloader, isURL } from "../../utils";

export default <ConfigCommands>{
    name: "facebookvideo",
    alias: ["fbvideo"],
    usage: "<url>",
    category: "downloader",
    description: "Download Video from Facebook",
    cooldown: 3,
    limit: 1,
    isProcess: true,
    example: `• /fbvideo https://web.facebook.com/watch?v=xxxxxxx`,
    async run({ Chisato, from, query, message, command }) {
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        downloader
            .facebookVideo(query)
            .then((res) => {
                if (res.result.length === 0) return Chisato.sendText(from, "Video not found!", message);
                const caption = `*「 FACEBOOK VIDEO DOWNLOADER 」*\n\n• Duration: ${res.duration}\n• Quality: ${res.result[0].quality}`;
                Chisato.sendVideo(from, res.result[0].url, false, caption, message);
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
