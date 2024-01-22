import type { ConfigCommands } from "../../types/commands";
import fs from "fs";

export default <ConfigCommands>{
    name: "autoreadstatus",
    alias: ["autoreadsw", "arsw"],
    usage: "<on|off>",
    category: "owner",
    description: "Auto Read for Status",
    isOwner: true,
    async run({ Chisato, args, from, message }) {
        const config: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        if (!args[0]) return Chisato.sendText(from, "Please input option!", message);
        if (args[0] === "on") {
            if (config.settings.autoReadStatus) return Chisato.sendText(from, "Auto Read Status already on!", message);
            config.settings.autoReadStatus = true;
            Chisato.sendText(from, "Success turn on Auto Read Status!", message);
            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
        } else if (args[0] === "off") {
            if (!config.settings.autoReadStatus)
                return Chisato.sendText(from, "Auto Read Status already off!", message);
            config.settings.autoReadStatus = false;
            Chisato.sendText(from, "Success turn off Auto Read Status!", message);
            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
        } else {
            Chisato.sendText(from, "Option not found!", message);
        }
    },
};
