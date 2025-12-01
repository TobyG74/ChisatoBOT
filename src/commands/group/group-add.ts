import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "add",
    alias: ["gadd", "groupadd"],
    usage: "[tag]",
    category: "group",
    description: "Add Member to Group",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, args, from, command, message, prefix }) {
        if (message.quoted["contactMessage"]) {
            const vcard = message.quoted["contactMessage"].vcard;
            const parseWaid = vcard.match(/(?<=waid=).+$/m)[0].split(":")[0];
            await Chisato.groupParticipantsUpdate(from, [parseWaid], "add");
        } else if (args[0]) {
            if (isNaN(parseInt(args[0])))
                return Chisato.sendText(
                    from,
                    `The number format is incorrect! Example : ${prefix}${command.name} 62813xxxxxxx`,
                    message
                );
            const parseWaid = args[0] + "@s.whatsapp.net";
            await Chisato.groupParticipantsUpdate(from, [parseWaid], "add");
        } else {
            await Chisato.sendText(
                from,
                `Sorry, the format is wrong!\nYou can send the contact of the person you want to add to the group or you can use the number.\nExample : ${prefix}${command.name} 62813xxxxxxx`,
                message
            );
        }
    },
} satisfies ConfigCommands;