import type { ConfigCommands } from "../../types/commands";
import fs from "fs";

export default <ConfigCommands>{
    name: "changemode",
    alias: ["mode"],
    category: "owner",
    description: "Change Mode of Bot",
    isOwner: true,
    async run({ Chisato, args, from, message, botName }) {
        const config: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        if (!args[0]) return Chisato.sendText(from, "Please input mode!", message);
        if (args[0] === "public") {
            if (!config.settings.selfbot) return Chisato.sendText(from, "Bot already in public mode!", message);
            config.settings.selfbot = false;
            Chisato.sendText(from, "Success change mode to public!", message);
            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
        } else if (args[0] === "self") {
            if (config.settings.selfbot) return Chisato.sendText(from, "Bot already in selfbot mode!", message);
            config.settings.selfbot = true;
            Chisato.sendText(from, "Success change mode to selfbot!", message);
            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
        } else {
            Chisato.sendText(from, "Mode not found!", message);
        }
    },
};
