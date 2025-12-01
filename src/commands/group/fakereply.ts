import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "fakereply",
    alias: ["freply"],
    usage: "[tag|faketext|yourtext]",
    category: "group",
    description: "Sending Fake Reply.",
    example: `• {prefix}{command.name} @tag|Hello|Hi`,
    async run({ Chisato, from, message, command }) {
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        const baileys = await dynamicImport("@whiskeysockets/baileys");
        const { generateWAMessageFromContent } = baileys;
        const { arg } = message;
        let tag = arg.split("|")[0]; // Target Jid
        let text1 = arg.split("|")[1]; // Target Text
        let text2 = arg.split("|")[2]; // Your Text
        const str =
            `*「 ! 」* Please Enter Tag & Text1 & Text2 !\n\n` +
            `Example:\n` +
            `/${command.name} <tag|faketext|yourtext>`;
        if (!tag.startsWith("@")) return Chisato.sendText(from, "Please Tag Someone!", message);
        if (!tag || !text1 || !text2) return Chisato.sendText(from, str, message);
        tag = tag.replace("@", "").replace(" ", "") + "@s.whatsapp.net";
        const messages = generateWAMessageFromContent(
            from,
            {
                extendedTextMessage: {
                    text: text2,
                    contextInfo: {
                        participant: tag,
                        quotedMessage: {
                            extendedTextMessage: {
                                text: arg.split("|")[1],
                            },
                        },
                    },
                },
            },
            {
                userJid: tag,
            }
        );
        await Chisato.relayMessage(from, messages.message, {
            messageId: messages.key.id,
        });
    },
} satisfies ConfigCommands;