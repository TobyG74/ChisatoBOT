import { ConfigCommands } from "../../types/commands.js";
import { wallpaper } from "../../utils";

export default <ConfigCommands>{
    name: "peakpx",
    alias: ["ppx"],
    usage: "<query|page>",
    category: "wallpaper",
    description: "Search Wallpaper from Peakpx",
    isProcess: true,
    cooldown: 2,
    example: `
• /peakpx Chisato Nishikigi|1

*Next image with reply message*
• /peakpx next

*Next image with reply message and option*
• /peakpx next <image>
• /peakpx next 11`,
    async run({ Chisato, arg, args, from, message, prefix }) {
        if (args[0] === "next" && message?.quoted) {
            const query = message.quoted.arg.split("#")[1];
            const image = Number(message.quoted.arg.split("#")[2]) + 1;
            let page = Number(message.quoted.arg.split("#")[3]);
            const total = message.quoted.arg.split("#")[4];
            if (Number(image) > Number(total)) page++;
            if (Number(args[1]) > Number(total))
                return Chisato.sendText(from, `The ${args[1]} image exceeds the total image: ${total}`, message);
            wallpaper
                .Peakpx(query, page.toString())
                .then(async (res) => {
                    const caption =
                        `*「 PEAKPX 」*\n\n` +
                        `• *Tags* : ${res.result[args[1] ? Number(args[1]) : image].tags}\n` +
                        `• *Quality* : ${res.result[args[1] ? Number(args[1]) : image].quality}\n` +
                        `• *Source* : ${res.result[args[1] ? Number(args[1]) : image].source}\n\n` +
                        `To display the next image, please reply to this message with the command:\n*${prefix}peakpx next*\n\n` +
                        `#${query}#${args[1] ? args[1] : image}#${page}#${res.totalImages}`;
                    await Chisato.sendImage(from, res.result[args[1] ? Number(args[1]) : image].url, caption, message);
                })
                .catch((e) => {
                    Chisato.sendText(
                        from,
                        "There is an error. Please report it to the bot creator immediately!\nMessage : " + e,
                        message
                    );
                    Chisato.log("error", "Peakpx", e);
                });
        } else {
            const query = arg.split("|")[0] || arg;
            const page = arg.split("|")[1] || "1";
            wallpaper
                .Peakpx(query, page)
                .then(async (res) => {
                    if (res.result.length === 0) return Chisato.sendText(from, "Not found!", message);
                    const caption =
                        `*「 PEAKPX 」*\n\n` +
                        `• *Tags* : ${res.result[0].tags}\n` +
                        `• *Quality* : ${res.result[0].quality}\n` +
                        `• *Source* : ${res.result[0].source}\n\n` +
                        `To display the next image, please reply to this message with the command:\n*${prefix}peakpx next*\n\n` +
                        `#${query}#0#${page}#${res.totalImages - 1}`;
                    await Chisato.sendImage(from, res.result[0].url, caption, message);
                })
                .catch((e) => {
                    Chisato.sendText(
                        from,
                        "There is an error. Please report it to the bot creator immediately!\nMessage : " + e,
                        message
                    );
                    Chisato.log("error", "Peakpx", e);
                });
        }
    },
};
