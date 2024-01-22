import type { ConfigCommands } from "../../types/commands";
import { commands } from "../../libs";
import fs from "fs";

export default <ConfigCommands>{
    name: "menu",
    alias: ["allmenu", "commands", "command", "cmd"],
    category: "general",
    description: "See All Menu List",
    async run({ Chisato, from, message, prefix, botName }) {
        const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        const { pushName } = message;
        const category = [];
        const checkMaintenance = (name: string) => {
            if (config.maintenance.includes(name)) return true;
            return false;
        };
        const command = Array.from(commands.values()).map((res, i) => res);
        let caption =
            "┏━━「 𓆩 𝚮ɪᴅᴅᴇɴ 𝐅ɪɴᴅᴇʀ ⁣𓆪 」\n┃\n" +
            `┣ Hiii ${pushName ? pushName : "Kak"}, \n` +
            `┣ The command currently being maintained is Strikethrough\n` +
            `┣ Example : ${prefix}~sticker~\n` +
            `┣ Run the command without < >\n┃\n` +
            `┣ *Instruction* :\n` +
            `┣ ★ : Owner\n` +
            `┣ ▷ : User\n` +
            `┣ ➤ : Admin Group\n┃\n`;
        for (const cmd of command) {
            const value = commands.get(cmd.name);
            if (Object.keys(category).includes(value.category)) category[value.category].push(value);
            else {
                category[value.category] = [];
                category[value.category].push(value);
            }
        }
        const keys = Object.keys(category).sort((a, b) => a.localeCompare(b));
        for (const key of keys) {
            caption += `┣━━━「 *${key.toLocaleUpperCase()}* 」━━━\n┃\n`;
            caption += `${category[key]
                .sort((a: ConfigCommands, b: string) => a.category.localeCompare(b))
                .map(
                    (v: ConfigCommands, i: number) =>
                        `┣${v.isOwner ? "★" : v.isGroupAdmin ? "➤" : "▷"} ${prefix}${
                            checkMaintenance(v.name) ? `~${v.name}~` : v.name
                        } ${v.usage ? v.usage : " "}`
                )
                .join("\n")}\n┃\n`;
        }
        caption += `┗━━「 *${botName}* 」`;
        await Chisato.sendText(from, caption, message);
    },
};
