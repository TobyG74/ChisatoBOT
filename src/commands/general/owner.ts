import type { ConfigCommands } from "../../types/commands";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

export default <ConfigCommands>{
    name: "owner",
    alias: ["creator", "author"],
    category: "general",
    description: "Sending Owner Contacts",
    async run({ Chisato, from, message }) {
        await Chisato.sendContact(from, config.ownerNumber);
        Chisato.sendText(from, "That's my Owner Contacts", message);
    },
};
