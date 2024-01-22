import type { ConfigCommands } from "../../types/commands";
import fs from "fs";

export default <ConfigCommands>{
    name: "autoreadmessage",
    alias: ["autoreadmsg", "armsg"],
    usage: "<on|off>",
    category: "owner",
    description: "Auto Read for Message",
    isOwner: true,
    async run({ Chisato, args, from, message }) {
        const config: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        if (!args[0]) return Chisato.sendText(from, "Please input option!", message);
        if (args[0] === "on") {
            if (config.settings.autoReadMessage)
                return Chisato.sendText(from, "Auto Read Message already on!", message);
            config.settings.autoReadMessage = true;
            Chisato.sendText(from, "Success turn on Auto Read Message!", message);
            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
        } else if (args[0] === "off") {
            if (!config.settings.autoReadMessage)
                return Chisato.sendText(from, "Auto Read Message already off!", message);
            config.settings.autoReadMessage = false;
            Chisato.sendText(from, "Success turn off Auto Read Message!", message);
            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
        } else {
            Chisato.sendText(from, "Option not found!", message);
        }
    },
};
