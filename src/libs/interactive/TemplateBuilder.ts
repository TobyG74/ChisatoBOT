import { fromBuffer } from "file-type";
import type { Chisato } from "../../types/auth/chisato";

let baileysModule: any = null;

async function getBaileys() {
    if (!baileysModule) {
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        baileysModule = await dynamicImport("@whiskeysockets/baileys");
    }
    return baileysModule;
}

type MediaType = "videoMessage" | "imageMessage";
type Media = string | Buffer | undefined | null;

interface ButtonData {
    display: string;
    id?: string;
    code?: string;
    url?: string;
    sections?: Section[];
    title?: string;
    inApp?: boolean;
}

interface Section {
    title: string;
    highlight_label?: string;
    rows: Row[];
}

interface Row {
    header?: string;
    title: string;
    description?: string;
    id: string;
}

interface Card {
    body?: string | null;
    footer?: string | null;
    title?: string | null;
    header?: string | Buffer;
    buttons: Button[];
}

type Button =
    | { name: "cta_copy"; buttonParamsJson: string }
    | { name: "quick_reply"; buttonParamsJson: string }
    | { name: "cta_url"; buttonParamsJson: string }
    | { name: "single_select"; buttonParamsJson: string }
    | { name: "cta_call"; buttonParamsJson: string }
    | { name: "cta_reminder"; buttonParamsJson: string }
    | { name: "cta_cancel_reminder"; buttonParamsJson: string }
    | { name: "address_message"; buttonParamsJson: string }
    | { name: "send_location"; buttonParamsJson: string }
    | { name: "open_webview"; buttonParamsJson: string };

/**
 * Base class for interactive buttons
 * Special Thanks to: Nugraizy
 * Github: https://github.com/nugraizy
 */
class InteractiveButtons {
    button = {
        /**
         * Copy button
         */
        copy(data: { display: string; code: string }): Button {
            return {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: data.display,
                    copy_code: data.code,
                }),
            };
        },

        /**
         * Quick reply button
         */
        reply(data: { display: string; id: string }): Button {
            return {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: data.display,
                    id: data.id,
                }),
            };
        },

        /**
         * URL button
         */
        url(data: { display: string; url: string }): Button {
            return {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: data.display,
                    url: data.url,
                    merchant_url: data.url,
                }),
            };
        },

        /**
         * List button
         */
        list(data: { display: string; sections: Section[] }): Button {
            return {
                name: "single_select",
                buttonParamsJson: JSON.stringify({
                    title: data.display,
                    sections: data.sections,
                }),
            };
        },

        /**
         * Call button
         */
        call(data: { display: string; id: string }): Button {
            return {
                name: "cta_call",
                buttonParamsJson: JSON.stringify({
                    display_text: data.display,
                    id: data.id,
                }),
            };
        },

        /**
         * Reminder button
         */
        reminder(data: { display: string; id: string }): Button {
            return {
                name: "cta_reminder",
                buttonParamsJson: JSON.stringify({
                    display_text: data.display,
                    id: data.id,
                }),
            };
        },

        /**
         * Cancel reminder button
         */
        cancel(data: { display: string; id: string }): Button {
            return {
                name: "cta_cancel_reminder",
                buttonParamsJson: JSON.stringify({
                    display_text: data.display,
                    id: data.id,
                }),
            };
        },

        /**
         * Address button
         */
        address(data: { display: string; id: string }): Button {
            return {
                name: "address_message",
                buttonParamsJson: JSON.stringify({
                    display_text: data.display,
                    id: data.id,
                }),
            };
        },

        /**
         * Location button
         */
        location(data: { display: string }): Button {
            return {
                name: "send_location",
                buttonParamsJson: JSON.stringify({
                    display_text: data.display,
                }),
            };
        },

        /**
         * Webview button
         */
        webview(data: { title: string; url: string; inApp: boolean }): Button {
            return {
                name: "open_webview",
                buttonParamsJson: JSON.stringify({
                    title: data.title,
                    link: {
                        in_app_webview: data.inApp,
                        url: data.url,
                    },
                }),
            };
        },
    };
}

/**
 * Carousel message builder
 */
export class Carousel extends InteractiveButtons {
    private client: Chisato;
    private _media: Media = null;
    private _cards: Promise<any>[] = [];
    private _buildParams: any;

    constructor(client: Chisato) {
        super();
        this.client = client;
        this._buildParams = {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                },
                interactiveMessage: {
                    body: { text: "" },
                    footer: { text: "" },
                    header: { title: "" },
                    carouselMessage: { cards: [] },
                },
            },
        };
    }

    async render() {
        const baileys = await getBaileys();
        const { generateWAMessageFromContent } = baileys;
        this._cards = await Promise.all(this._cards);
        const media = !this._media
            ? { hasMediaAttachment: false }
            : await this.prepareMessage(this._media);

        this._buildParams.message.interactiveMessage.carouselMessage.cards =
            this._cards;
        this._buildParams.message.interactiveMessage.header = {
            ...this._buildParams.message.interactiveMessage.header,
            ...media,
        };

        return generateWAMessageFromContent(
            "0@s.whatsapp.net",
            { viewOnceMessage: this._buildParams },
            {
                userJid: "0@s.whatsapp.net",
            } as any
        );
    }

    mainBody(text: string): this {
        this._buildParams.message.interactiveMessage.body.text = text;
        return this;
    }

    mainFooter(text: string): this {
        this._buildParams.message.interactiveMessage.footer.text = text;
        return this;
    }

    mainHeader(text: string, media?: Media): this {
        this._buildParams.message.interactiveMessage.header.text = text;
        this._media = media;
        return this;
    }

    async getMessageType(media: Buffer) {
        const fileType = await fromBuffer(media);
        const mime = fileType?.mime || "";
        const messageType =
            mime.includes("gif") || mime.includes("video")
                ? "videoMessage"
                : "imageMessage";
        return { mime, messageType };
    }

    async prepareGif(media: Buffer, messageType: MediaType) {
        const content: any = {
            gifPlayback: true,
        };

        if (messageType === "videoMessage") {
            content.video = media;
        } else {
            content.image = media;
        }

        const message = await this.client.sendMessage(
            "0@s.whatsapp.net",
            content
        );
        return message;
    }

    async prepareMessage(media: Media) {
        if (media) {
            const buffer =
                typeof media === "string"
                    ? Buffer.from(media, "base64")
                    : media;
            const { messageType } = await this.getMessageType(buffer);

            if (messageType === "videoMessage") {
                const preparedMedia = await this.prepareGif(
                    buffer,
                    messageType
                );
                return {
                    [messageType]: preparedMedia.message?.[messageType],
                    hasMediaAttachment: true,
                };
            } else {
                const preparedMedia = await this.client.sendMessage(
                    "0@s.whatsapp.net",
                    { image: buffer }
                );
                return {
                    [messageType]: preparedMedia.message?.[messageType],
                    hasMediaAttachment: true,
                };
            }
        }
        return { hasMediaAttachment: false };
    }

    cards(cards: Card[]): this {
        this._cards = cards.map(
            async ({ body, footer, title, header, buttons }) => {
                let attachment;

                if (header && Buffer.isBuffer(header) && header.length > 0) {
                    attachment = await this.prepareMessage(header);
                } else {
                    attachment = { hasMediaAttachment: false };
                }

                return {
                    body: { text: body || "" },
                    footer: { text: footer || "" },
                    header: { title: title || "", ...attachment },
                    nativeFlowMessage: {
                        buttons,
                        messageParamsJson: "",
                    },
                };
            }
        );
        return this;
    }
}

/**
 * Native message builder
 */
export class Native extends InteractiveButtons {
    private client: Chisato;
    private _media: Media = null;
    private _buttons: Button[] = [];
    private _buildParams: any;

    constructor(client: Chisato) {
        super();
        this.client = client;
        this._buildParams = {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                },
                interactiveMessage: {
                    body: { text: "" },
                    footer: { text: "" },
                    header: { title: "" },
                    nativeFlowMessage: {
                        buttons: [],
                        messageParamsJson: "",
                    },
                },
            },
        };
    }

    mainBody(text: string): this {
        this._buildParams.message.interactiveMessage.body.text = text;
        return this;
    }

    mainFooter(text: string): this {
        this._buildParams.message.interactiveMessage.footer.text = text;
        return this;
    }

    mainHeader(text: string, media?: Media): this {
        this._buildParams.message.interactiveMessage.header.title = text;
        this._media = media;
        return this;
    }

    async render() {
        const baileys = await getBaileys();
        const { generateWAMessageFromContent } = baileys;
        const media = !this._media
            ? { hasMediaAttachment: false }
            : await this.prepareMessage(this._media);

        this._buildParams.message.interactiveMessage.header = {
            ...this._buildParams.message.interactiveMessage.header,
            ...media,
        };
        this._buildParams.message.interactiveMessage.nativeFlowMessage.buttons =
            this._buttons;

        return generateWAMessageFromContent(
            "0@s.whatsapp.net",
            { viewOnceMessage: this._buildParams },
            {
                userJid: "0@s.whatsapp.net",
            } as any
        );
    }

    buttons(...buttons: Button[]): this {
        this._buttons = buttons;
        return this;
    }

    async getMessageType(media: Buffer) {
        const fileType = await fromBuffer(media);
        const mime = fileType?.mime || "";
        const messageType =
            mime.includes("gif") || mime.includes("video")
                ? "videoMessage"
                : "imageMessage";
        return { mime, messageType };
    }

    async prepareGif(media: Buffer, messageType: MediaType) {
        const content: any = {
            gifPlayback: true,
        };

        if (messageType === "videoMessage") {
            content.video = media;
        } else {
            content.image = media;
        }

        const message = await this.client.sendMessage(
            "0@s.whatsapp.net",
            content
        );
        return message;
    }

    async prepareMessage(media: Media) {
        if (media) {
            const buffer =
                typeof media === "string"
                    ? Buffer.from(media, "base64")
                    : media;
            const { messageType } = await this.getMessageType(buffer);

            if (messageType === "videoMessage") {
                const preparedMedia = await this.prepareGif(
                    buffer,
                    messageType
                );
                return {
                    [messageType]: preparedMedia.message?.[messageType],
                    hasMediaAttachment: true,
                };
            } else {
                const preparedMedia = await this.client.sendMessage(
                    "0@s.whatsapp.net",
                    { image: buffer }
                );
                return {
                    [messageType]: preparedMedia.message?.[messageType],
                    hasMediaAttachment: true,
                };
            }
        }
        return { hasMediaAttachment: false };
    }
}

/**
 * Template Builder - main export with Carousel and Native builders
 */
export class TemplateBuilder {
    static Carousel = Carousel;
    static Native = Native;
}
