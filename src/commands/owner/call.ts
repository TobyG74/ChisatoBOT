import { encodeWAMessage } from "baileys";
import type { ConfigCommands } from "../../types/commands";
import crypto from "crypto";

export default <ConfigCommands>{
    name: "call",
    alias: ["telpon"],
    usage: "<number|count>",
    category: "owner",
    description: "Call",
    isOwner: true,
    async run({ Chisato, arg, message }) {
        try {
            const count = arg.split("|")[1];
            const number = message.mentions[0] ? message.mentions[0] : arg.split("|")[0] + "@s.whatsapp.net";
            for (let i = 0; i < Number(count); i++) {
                const buffer = encodeWAMessage({
                    call: {
                        callKey: new Uint8Array(crypto.getRandomValues(new Uint8Array(32)).buffer),
                    },
                });
                const enc = await Chisato.signalRepository.encryptMessage({
                    jid: number,
                    data: buffer,
                });
                const node = {
                    tag: "call",
                    attrs: {
                        to: number,
                        id: Chisato.generateMessageTag(),
                    },
                    content: [
                        {
                            tag: "offer",
                            attrs: {
                                "call-id": crypto.randomBytes(16).toString("hex").substring(0, 64).toUpperCase(),
                                "call-creator": Chisato.user.id,
                            },
                            content: [
                                {
                                    tag: "audio",
                                    attrs: { enc: "opus", rate: "16000" },
                                    content: undefined,
                                },
                                {
                                    tag: "audio",
                                    attrs: { enc: "opus", rate: "8000" },
                                    content: undefined,
                                },
                                {
                                    tag: "video",
                                    attrs: {
                                        orientation: "0",
                                        screen_width: "1920",
                                        screen_height: "1080",
                                        device_orientation: "0",
                                        enc: "vp8",
                                        dec: "vp8",
                                    },
                                    content: undefined,
                                },
                                {
                                    tag: "net",
                                    attrs: { medium: "3" },
                                    content: undefined,
                                },
                                {
                                    tag: "capability",
                                    attrs: { ver: "1" },
                                    content: new Uint8Array([1, 4, 255, 131, 207, 4]),
                                },
                                {
                                    tag: "encopt",
                                    attrs: { keygen: "2" },
                                    content: undefined,
                                },
                                {
                                    tag: "destination",
                                    attrs: {},
                                    content: [
                                        {
                                            tag: "to",
                                            attrs: {
                                                jid: number,
                                            },
                                            content: [
                                                {
                                                    tag: "enc",
                                                    attrs: {
                                                        v: "2",
                                                        type: enc.type,
                                                        count: "0",
                                                    },
                                                    content: enc.ciphertext,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                };
                Chisato.sendNode(node);
            }
        } catch (e) {
            console.log(e);
        }
    },
};
