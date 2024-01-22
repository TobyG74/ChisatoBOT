import type { ConfigCommands } from "../../types/commands";
import fs from "fs";

export default <ConfigCommands>{
    name: "anticall",
    alias: ["antitelpon"],
    usage: "<type> <option>",
    category: "owner",
    description: "Anti Call",
    isOwner: true,
    example: `
*Type :* reject | block

*Turn on Reject call*
• /anticall reject on

*Turn off Reject call*
• /anticall reject off

*Turn on Reject call and block
• /anticall block on

*Turn off Reject call and block
• /anticall block off`,
    async run({ Chisato, args, from, message }) {
        const { config } = Chisato;
        const type = args[0];
        const option = args[1];
        switch (type) {
            case "block":
                if (!["on", "off"].includes(option)) return Chisato.sendText(from, `Option must be on or off`, message);
                if (args[0] === "on") {
                    config.call.status = "block";
                    await Chisato.sendText(from, `Success ${type} call`, message);
                } else if (args[0] === "off") {
                    config.call.status = "off";
                    await Chisato.sendText(from, `Success ${type} call`, message);
                }
                break;
            case "reject":
                if (!["on", "off"].includes(option)) return Chisato.sendText(from, `Option must be on or off`, message);
                if (args[0] === "on") {
                    config.call.status = "reject";
                    await Chisato.sendText(from, `Success ${type} call`, message);
                } else if (args[0] === "off") {
                    config.call.status = "off";
                    await Chisato.sendText(from, `Success ${type} call`, message);
                }
                break;
            default:
                return Chisato.sendText(from, `Type must be block or reject`, message);
        }
        fs.writeFileSync("./src/config.json", JSON.stringify(config, null, 2));
    },
};
