import type { ConfigCommands } from "../../types/structure/commands";
import { downloader, isURL } from "../../utils";

export default <ConfigCommands>{
    name: "instagramstory",
    alias: ["igstory"],
    usage: "<url>",
    category: "downloader",
    description: "Download Story Media from Instagram",
    cooldown: 3,
    limit: 1,
    isProcess: true,
    example: `• /instagramstory https://www.instagram.com/stories/ini.tobz/xxxxxxxx`,
    async run({ Chisato, from, query, message, command }) {
        const ig = new downloader.instagram();
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        ig.story(query)
            .then(async (data) => {
                if (data.status === 404) return Chisato.sendText(from, data.message, message);
                if (data.type === "story") {
                    await Chisato.sendText(
                        from,
                        `*「 INSTAGRAM STORY DOWNLOADER 」*\n\n• Type: ${data.type}\n• Total: ${data.result.length}\n*Please wait, your video or image is being sent...*`,
                        message
                    );
                    for (let i = 0; i < data.result.length; i++) {
                        if (data.result[i].type === "image")
                            await Chisato.sendImage(from, data.result[i].url, `• Type: ${data.result[i].type}`);
                        else if (data.result[i].type === "video")
                            await Chisato.sendVideo(from, data.result[i].url, false, `• Type: ${data.result[i].type}`);
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
