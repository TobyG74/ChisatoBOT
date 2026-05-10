import type { ConfigCommands } from "../../types/structure/commands";
import fs from "fs";

export default {
    name: "owner",
    alias: ["creator", "author"],
    category: "general",
    description: "Sending Owner Contacts",
    async run({ Chisato, from, message }) {
        const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        
        if (!config.ownerNumber || config.ownerNumber.length === 0) {
            await Chisato.sendText(from, "Owner number has not been set in config.json", message);
            return;
        }

        await Chisato.sendContact(from, config.ownerNumber);
        Chisato.sendText(from, "That's my Owner Contacts", message);
    },
} satisfies ConfigCommands;