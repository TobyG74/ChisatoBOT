import type { ConfigCommands } from "../../types/commands";
import { downloader, isURL } from "../../utils";

export default <ConfigCommands>{
    name: "instagramreels",
    alias: ["igreels"],
    usage: "<url>",
    category: "downloader",
    description: "Download Reels Media from Instagram",
    cooldown: 3,
    limit: 1,
    isProcess: true,
    example: `• /instagramreels https://www.instagram.com/reels/xxxxxxxx`,
    async run({ Chisato, from, query, message, command }) {
        const ig = new downloader.instagram();
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        ig.reels(query)
            .then(async (data) => {
                if (data.status === 404) return Chisato.sendText(from, data.message, message);
                if (data.type === "reels") {
                    await Chisato.sendText(
                        from,
                        `*「 INSTAGRAM REELS DOWNLOADER 」*\n\n• Type: ${data.type}\n\n• Total: ${data.result.length}`,
                        message
                    );
                    for (let i = 0; i < data.result.length; i++) {
                        if (data.result[i].type === "video")
                            await Chisato.sendVideo(from, data.result[i], false, `• Type: ${data.result[i].type}`);
                    }
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
