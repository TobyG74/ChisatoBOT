import { ConfigCommands } from "../../types/commands.js";
import { wallpaper } from "../../utils";

export default <ConfigCommands>{
    name: "zerochan",
    alias: ["zchan"],
    usage: "<query>",
    category: "wallpaper",
    description: "Search Wallpaper from ZeroChan",
    isProcess: true,
    cooldown: 2,
    example: `• /zerochan Chisato Nishikigi`,
    async run({ Chisato, query, from, message }) {
        wallpaper
            .ZeroChan(query)
            .then(async (res) => {
                if (res.length === 0) return Chisato.sendText(from, "Not found!", message);
                const random = Math.floor(Math.random() * res.length);
                const caption =
                    `*「 ZEROCHAN 」*\n\n` +
                    `• *Size* : ${res[random].size}\n` +
                    `• *Quality* : ${res[random].quality}\n` +
                    `• *Source* : ${res[random].source}\n`;
                await Chisato.sendImage(from, res[random].url, caption, message);
            })
            .catch((err) => {
                if (err.response.status === 404) return Chisato.sendText(from, "Not found!", message);
                Chisato.sendText(
                    from,
                    "There is an error. Please report it to the bot creator immediately!\nMessage : " + err,
                    message
                );
                Chisato.log("error", "ZeroChan", err);
            });
    },
};
