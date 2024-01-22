import type { ConfigCommands } from "../../types/commands";
import { downloader, isURL } from "../../utils";

export default <ConfigCommands>{
    name: "instagrampost",
    alias: ["igpost"],
    usage: "<url>",
    category: "downloader",
    description: "Download Post Media from Instagram",
    cooldown: 3,
    isProcess: true,
    example: `• /instagrampost https://www.instagram.com/p/xxxxxxxx`,
    async run({ Chisato, from, query, message, command }) {
        const ig = new downloader.instagram();
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        ig.post(query)
            .then(async (data) => {
                if (data.status === 404) return Chisato.sendText(from, data.message, message);
                if (data.type === "image") {
                    await Chisato.sendText(from, "*「 INSTAGRAM POST DOWNLOADER 」*", message);
                    for (let i = 0; i < data.images.length; i++) {
                        Chisato.sendImage(from, data.images[i][i][0].download, `• Size: ${data.images[i][i][0].size}`);
                    }
                } else {
                    Chisato.sendVideo(from, data.video, false, "*「 INSTAGRAM POST DOWNLOADER 」*", message);
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
