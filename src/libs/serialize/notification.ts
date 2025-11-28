import { Client } from "..";
import { GroupSerialize } from "../../types/structure/serialize";

export const notification = async (
    Chisato: Client,
    message: any
): Promise<GroupSerialize> => {
    const m = <GroupSerialize>{};
    if (message.attrs.type === "w:gp2") {
        m.from = message.attrs.from;
        m.type = 24;
        m.participant =
            (await Chisato.decodeJid(message.attrs?.participant)) ||
            (await Chisato.decodeJid(message.content[0].attrs?.participant));
        m.parameters = [message.content[0].content[0].content.toString()];
        m.timestamp = message.attrs.t;
        const botJid = await Chisato.decodeJid(Chisato.user.id);
        m.key = {
            fromMe:
                botJid ===
                m.participant.split("@")[0],
            remoteJid: message.attrs.from,
            id: message.attrs.id,
            participant: m.participant,
            remoteJidAlt: "",
            participantAlt: "",
            addressingMode: "",
            isViewOnce: false,
        };
        m.expiration = 0;
    }
    return m;
};
