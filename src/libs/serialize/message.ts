import type { WAMessage } from "@whiskeysockets/baileys";
import { MessageSerialize } from "../../types/structure/serialize";
import { Client } from "..";

export const message = async (
    Chisato: Client,
    message: WAMessage
): Promise<MessageSerialize> => {
    const m = <MessageSerialize>{};
    if (!message) return m;
    if (message.message) {
        m.key = message.key;
        m.id = message.key.id;
        m.from = message.key.remoteJid;
        m.fromMe = message.key.fromMe;
        m.isGroup = m.from.endsWith("@g.us");
        m.message = message.message;
        m.type = Object.keys(m.message).find(
            (type) =>
                type !== "senderKeyDistributionMessage" &&
                type !== "messageContextInfo"
        );
        if (
            [
                "viewOnceMessage",
                "viewOnceMessageV2",
                "viewOnceMessageV2Extension",
                "protocolMessage",
                "ephemeralMessage",
                "productMessage",
                "documentWithCaptionMessage",
                "editedMessage",
            ].includes(m.type)
        ) {
            m.message = m.message[m.type]?.message;
            if (!m.message) {
                return m;
            }
            m.type = Object.keys(m.message)[0];
        }
        m.expiration = m.message[m.type].expiration || 0;
        m.messageTimestamp = message.messageTimestamp;
        m.pushName = message.pushName;
        m.mentions = m.message[m.type]?.contextInfo?.mentionedJid || [];
        m.sender = m.isGroup
            ? await Chisato.decodeJid(m.key.participantAlt)
            : m.fromMe
            ? await Chisato.decodeJid(Chisato.user.id)
            : m.from;
        m.body =
            m.type === "conversation"
                ? m.message.conversation
                : m.type === "extendedTextMessage"
                ? m.message[m.type].text
                : m.type === "imageMessage"
                ? m.message[m.type].caption
                : m.type === "videoMessage"
                ? m.message[m.type].caption
                : m.type === "locationMessage"
                ? m.message[m.type].comment
                : m.type === "listResponseMessage"
                ? m.message[m.type].singleSelectReply.selectedRowId
                : m.type === "templateButtonReplyMessage" &&
                  m.message.templateButtonReplyMessage.selectedId
                ? m.message.templateButtonReplyMessage.selectedId
                : m.type === "buttonsResponseMessage"
                ? m.message[m.type].selectedButtonId
                : m.type === "interactiveResponseMessage"
                ? m.message[m.type].nativeFlowResponseMessage?.paramsJson
                    ? JSON.parse(m.message[m.type].nativeFlowResponseMessage.paramsJson).id
                    : m.message[m.type].nativeFlowResponseMessage?.name || "Interactive Response"
                : m.type === "reactionMessage"
                ? m.message[m.type].text
                : m.type === "documentMessage"
                ? m.message[m.type]?.caption || "Document Message"
                : m.type === "audioMessage"
                ? "Audio Message"
                : m.type === "stickerMessage"
                ? "Sticker Message"
                : m.type === "contactMessage"
                ? "Contact Message"
                : m.type === "productMessage"
                ? "Product Message"
                : m.type === "pollCreationMessage"
                ? "Poll Message"
                : m.type === "protocolMessage"
                ? "Protocol Message"
                : m.type === "buttonsMessage"
                ? "Buttons Message"
                : m.type === "listMessage"
                ? "List Message"
                : m.type === "interactiveMessage"
                ? "Interactive Message"
                : "-";
        m.args = m.body?.trim().split(/ +/).slice(1) || [];
        m.arg = m.body ? m.body.substring(m.body.indexOf(" ") + 1) : "";
        m.query = m.args.join(" ");
        m.download = () => Chisato.downloadMediaMessage(m);
        m.quoted = <MessageSerialize>{};
        if (m.message[m.type]?.contextInfo?.quotedMessage) {
            m.quoted.type = Object.keys(
                m.message[m.type].contextInfo.quotedMessage
            )[0];
            m.quoted.message = m.message[m.type].contextInfo.quotedMessage;
            if (
                [
                    "viewOnceMessage",
                    "viewOnceMessageV2",
                    "viewOnceMessageV2Extension",
                    "protocolMessage",
                    "ephemeralMessage",
                    "productMessage",
                    "documentWithCaptionMessage",
                    "editedMessage",
                ].includes(m.quoted.type)
            ) {
                m.quoted.message = m.quoted.message[m.quoted.type].message;
                m.quoted.type = Object.keys(m.quoted.message)[0];
            }
            m.quoted.sender = await Chisato.decodeJid(
                m.message[m.type].contextInfo.participant
            );
            const botJid = await Chisato.decodeJid(Chisato.user.id);
            m.quoted.key = {
                id: m.message[m.type].contextInfo.stanzaId,
                fromMe: m.quoted.sender === botJid,
                remoteJid: m.sender || m.from,
                participant: m.sender,
            };
            m.quoted.id = m.quoted.key.id;
            m.quoted.from = m.quoted.key.remoteJid;
            m.quoted.fromMe = m.quoted.key.fromMe;
            m.quoted.isGroup = m.quoted.from.endsWith("@g.us");
            m.quoted.body =
                m.quoted.type === "conversation"
                    ? m.quoted.message.conversation
                    : m.quoted.type === "extendedTextMessage"
                    ? m.quoted.message[m.quoted.type].text
                    : m.quoted.type === "imageMessage"
                    ? m.quoted.message[m.quoted.type].caption || "Image Message"
                    : m.quoted.type === "videoMessage"
                    ? m.quoted.message[m.quoted.type].caption || "Video Message"
                    : m.quoted.type === "locationMessage"
                    ? m.quoted.message[m.quoted.type].comment ||
                      "Location Message"
                    : m.quoted.type === "listResponseMessage"
                    ? m.quoted.message[m.quoted.type].singleSelectReply
                          .selectedRowId
                    : m.quoted.type === "templateButtonReplyMessage"
                    ? m.quoted.message[m.quoted.type].selectedId
                    : m.quoted.type === "buttonsResponseMessage"
                    ? m.quoted.message[m.quoted.type].selectedButtonId
                    : m.quoted.type === "reactionMessage"
                    ? m.quoted.message[m.quoted.type].text
                    : m.quoted.type === "audioMessage"
                    ? "Audio Message"
                    : m.quoted.type === "stickerMessage"
                    ? "Sticker Message"
                    : m.quoted.type === "contactMessage"
                    ? "Contact Message"
                    : m.quoted.type === "documentMessage"
                    ? m.quoted.message[m.quoted.type]?.caption ||
                      "Document Message"
                    : m.quoted.type === "productMessage"
                    ? "Product Message"
                    : m.quoted.type === "pollCreationMessage"
                    ? "Poll Message"
                    : m.quoted.type === "protocolMessage"
                    ? "Protocol Message"
                    : m.quoted.type === "buttonsMessage"
                    ? "Buttons Message"
                    : m.quoted.type === "listMessage"
                    ? "List Message"
                    : "-";
            m.quoted.mentions =
                m.quoted.message[m.quoted.type]?.contextInfo?.mentionedJid ||
                [];
            m.quoted.args = m.quoted.body.trim().split(/ +/).slice(1);
            m.quoted.arg = m.quoted.body.substring(
                m.quoted.body.indexOf(" ") + 1
            );
            m.quoted.query = m.quoted.args.join(" ");
            m.quoted.download = () => Chisato.downloadMediaMessage(m.quoted);
        } else m.quoted = null;
    }
    return m;
};
