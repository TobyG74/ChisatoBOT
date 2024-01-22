import type { ConfigCommands } from "../../types/commands";
import { downloader, isURL } from "../../utils";

export default <ConfigCommands>{
    name: "instagramstory",
    alias: ["igstory"],
    usage: "<url>",
    category: "downloader",
    description: "Download Story Media from Instagram",
    cooldown: 3,
    isProcess: true,
    example: `• /instagramstory https://www.instagram.com/stories/ini.tobz/xxxxxxxx`,
    async run({ Chisato, from, query, message, command }) {
        const ig = new downloader.instagram();
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        ig.story(query)
            .then(async (data) => {
                if (data.status === 404) return Chisato.sendText(from, data.message, message);
                if (data.type === "story") {
                    Chisato.sendVideo(from, data.video, false, "*「 INSTAGRAM STORY DOWNLOADER 」*", message);
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
