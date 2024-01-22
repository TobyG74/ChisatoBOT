import { WAMessage } from "baileys";
import { Chisato } from "../../types/client";
import { GroupSerialize } from "../../types/serialize";

export const group = async (message: WAMessage): Promise<GroupSerialize> => {
    const m = <GroupSerialize>{};
    if (message.message?.protocolMessage) {
        m.parameters = [];
        m.key = message.key;
        m.from = message.key.remoteJid;
        m.timestamp = message.messageTimestamp;
        m.participant = message.key.participant || message.participant;
        m.type = 72;
        m.message = message.message;
        m.expiration = m.message?.protocolMessage?.ephemeralExpiration || 0;
        return m;
    }
    m.parameters = message.messageStubParameters;
    m.key = message.key;
    m.from = message.key.remoteJid;
    m.timestamp = message.messageTimestamp;
    m.participant = message.key.participant || message.participant;
    m.type = message.messageStubType;
    m.message = message.message;
    m.expiration = m.message?.protocolMessage?.ephemeralExpiration || 0;
    return m;
};
