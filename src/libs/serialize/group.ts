import type { WAMessage } from "@whiskeysockets/baileys";
import { GroupSerialize } from "../../types/structure/serialize";

export const group = async (message: WAMessage): Promise<GroupSerialize> => {
    const m = <GroupSerialize>{};
    if (message.message?.protocolMessage) {
        m.parameters = [];
        m.key = {
            id: message.key.id || "",
            fromMe: message.key.fromMe || false,
            remoteJid: message.key.remoteJid || "",
            remoteJidAlt: message.key.remoteJidAlt || "",
            participant: message.key.participant || "",
            participantAlt: message.key.participantAlt || "",
            addressingMode: message.key.addressingMode || "",
            isViewOnce: message.key.isViewOnce || false,
        };
        m.parameters = message.messageStubParameters;
        m.from = message.key.remoteJid;
        m.participant = message.key.participantAlt || message.participant;
        m.type = 72;
        m.message = message.message;
        m.expiration = m.message?.protocolMessage?.ephemeralExpiration || 0;
        m.pushName = message.pushName || "";
        return m;
    }
    m.parameters = message.messageStubParameters;
    m.key = message.key = {
        id: message.key.id || "",
        fromMe: message.key.fromMe || false,
        remoteJid: message.key.remoteJid || "",
        remoteJidAlt: message.key.remoteJidAlt || "",
        participant: message.key.participant || "",
        participantAlt: message.key.participantAlt || "",
        addressingMode: message.key.addressingMode || "",
        isViewOnce: message.key.isViewOnce || false,
    };
    m.from = message.key.remoteJid;
    m.timestamp = message.messageTimestamp;
    m.participant = message.key.participantAlt || message.participant;
    m.type = message.messageStubType;
    m.message = message?.message || {};
    m.expiration = m.message?.protocolMessage?.ephemeralExpiration || 0;
    m.pushName = message.pushName || "";
    return m;
};
