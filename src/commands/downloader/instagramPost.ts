import type { ConfigCommands } from "../../types/commands";
import { downloader, isURL } from "../../utils";

export default <ConfigCommands>{
    name: "instagrampost",
    alias: ["igpost"],
    usage: "<url>",
    category: "downloader",
    description: "Download Post Media from Instagram",
    cooldown: 3,
    limit: 1,
    isProcess: true,
    example: `• /instagrampost https://www.instagram.com/p/xxxxxxxx`,
    async run({ Chisato, from, query, message, command }) {
        const ig = new downloader.instagram();
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        ig.post(query)
            .then(async (data) => {
                if (data.status === 404) return Chisato.sendText(from, data.message, message);
                if (data.type === "post") {
                    await Chisato.sendText(
                        from,
                        `*「 INSTAGRAM POST DOWNLOADER 」*\n\n• Type: ${data.type}\n\n• Total: ${data.result.length}`,
                        message
                    );
                    for (let i = 0; i < data.result.length; i++) {
                        if (data.result[i].type === "image")
                            await Chisato.sendImage(from, data.result[i], `• Type: ${data.result[i].type}`);
                        else if (data.result[i].type === "video")
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
