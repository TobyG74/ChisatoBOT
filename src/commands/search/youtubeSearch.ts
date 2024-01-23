import type { ConfigCommands } from "../../types/commands.js";
import yts from "yt-search";

export default <ConfigCommands>{
    name: "youtubesearch",
    alias: ["ytsearch", "yts", "searchyt"],
    category: "search",
    usage: "<query>",
    description: "Search youtube video, channel, live, or playlist",
    limit: 1,
    cooldown: 5,
    isProcess: true,
    example: `• /youtubesearch xxxxx`,
    async run({ Chisato, query, from, message, command }) {
        if (!query) return Chisato.sendText(from, "Please provide query!", message);
        yts(query)
            .then((res) => {
                for (let i = 0; i < 5; i++) {
                    const result = res.all[i];
                    if (result.type === "channel") {
                        let caption = `*「 YOUTUBE CHANNEL 」*\n\n`;
                        caption += `• Name : ${result.name}\n`;
                        caption += `• Title : ${result.title}\n`;
                        caption += `• Type : ${result.type}\n`;
                        caption += `• Subscribers : ${result.subCountLabel}\n`;
                        caption += `• Link : ${result.url}\n`;
                        Chisato.sendImage(from, result.image, caption, message);
                    } else if (result.type === "video") {
                        let caption = `*「 YOUTUBE VIDEO 」*\n\n`;
                        caption += `• ID : ${result.videoId}\n`;
                        caption += `• Title : ${result.title}\n`;
                        caption += `• Type : ${result.type}\n`;
                        caption += `• Views : ${result.views}\n`;
                        caption += `• Duration : ${result.timestamp}\n`;
                        caption += `• Upload : ${result.ago}\n`;
                        caption += `• Channel : ${result.author.name}\n`;
                        caption += `• Description : ${result.description}\n`;
                        caption += `• Link : ${result.url}\n`;
                        Chisato.sendImage(from, result.image, caption, message);
                    } else if (result.type === "live") {
                        let caption = `*「 YOUTUBE LIVE 」*\n\n`;
                        caption += `• ID : ${result.videoId}\n`;
                        caption += `• Title : ${result.title}\n`;
                        caption += `• Type : ${result.type}\n`;
                        caption += `• Status : ${result.status}\n`;
                        caption += `• Watching : ${result.watching}\n`;
                        caption += `• Channel : ${result.author.name}\n`;
                        caption += `• Description : ${result.description}\n`;
                        caption += `• Link : ${result.url}\n`;
                        Chisato.sendImage(from, result.image, caption, message);
                    } else if (result.type === "list") {
                        let caption = `*「 YOUTUBE PLAYLIST 」*\n\n`;
                        caption += `• ID : ${result.listId}\n`;
                        caption += `• Title : ${result.title}\n`;
                        caption += `• Type : ${result.type}\n`;
                        caption += `• Video Count : ${result.videoCount}\n`;
                        caption += `• Channel : ${result.author.name}\n`;
                        caption += `• Link : ${result.url}\n`;
                        Chisato.sendImage(from, result.image, caption, message);
                    }
                }
            })
            .catch((err) => {
                Chisato.log("error", command.name, err);
                Chisato.sendText(
                    from,
                    "There is an error. Please report it to the bot creator immediately!\nMessage : " + err,
                    message
                );
            });
    },
};
