import { TwitterDL } from "twitter-downloader";
import type { ConfigCommands } from "../../types/structure/commands";
import { isURL } from "../../libs";

export default {
    name: "xdownload",
    alias: ["xdl", "twitterdl", "twitterdownload"],
    usage: "[url|slide]",
    category: "downloader",
    description: "Download Videos from Twitter",
    cooldown: 3,
    limit: 1,
    example: `• {prefix}{command.name} https://www.twitter.com/elonmusk/status/xxxxxx`,
    async run({ Chisato, from, query, prefix, command, message }) {
        if (!query || !isURL(query)) {
            let text = `*「 X/TWITTER DOWNLOADER 」*\n\n`;
            text += `📥 Download video, GIF, atau gambar dari X (Twitter)!\n\n`;
            text += `📝 *Cara menggunakan:*\n`;
            text += `${prefix}${command.name} [url]\n\n`;
            text += `💡 *Contoh:*\n`;
            text += `• ${prefix}${command.name} https://twitter.com/user/status/xxxxx\n`;
            text += `• ${prefix}xdl https://x.com/user/status/xxxxx`;
            
            return Chisato.sendText(from, text, message);
        }
        
        await Chisato.sendReaction(from, "⏳", message.key);

        TwitterDL(query)
            .then(async (res) => {
                if (res.status === "error") {
                    Chisato.logger.error(command.name, res.message);
                    return Chisato.sendText(from, res.message, message);
                }

                let str =
                    `*「 TWITTER DOWNLOADER 」*\n\n` +
                    `• ID: ${res.result.id}\n` +
                    `• Description: ${res.result.description}\n` +
                    `• Created At: ${res.result.createdAt}\n` +
                    `• Language: ${res.result.languange}\n` +
                    `• Possibly Sensitive: ${
                        res.result.possiblySensitive ? "Yes" : "No"
                    }\n` +
                    `• Quote Status: ${
                        res.result.isQuoteStatus ? "Yes" : "No"
                    }\n\n` +
                    `*「 STATISTICS 」*\n\n` +
                    `• Favorites: ${res.result.statistics.favoriteCount}\n` +
                    `• Replies: ${res.result.statistics.replieCount}\n` +
                    `• Retweets: ${res.result.statistics.retweetCount}\n` +
                    `• Views: ${res.result.statistics.viewCount}\n\n` +
                    `*「 AUTHOR 」*\n\n` +
                    `• Username: ${res.result.author.username}\n` +
                    `• Verified: ${
                        res.result.author.verified ? "Yes" : "No"
                    }\n` +
                    `• Location: ${res.result.author.location}\n` +
                    `• Possibly Sensitive: ${
                        res.result.author.possiblySensitive ? "Yes" : "No"
                    }\n` +
                    `• Url: ${res.result.author.url}\n`;

                await Chisato.sendText(from, str, message);

                for (const media of res.result.media) {
                    if (media.type === "video") {
                        const video = media.videos.reduce(
                            (maxBitrateResult, currentResult) => {
                                return currentResult.bitrate >
                                    maxBitrateResult.bitrate
                                    ? currentResult
                                    : maxBitrateResult;
                            },
                            media.videos[0]
                        );

                        str =
                            `*「 VIDEO 」*\n\n` +
                            `• Type: ${media.type}\n` +
                            `• Bitrate: ${video.bitrate}\n` +
                            `• Quality: ${video.quality}\n` +
                            `• Content Type: ${video.content_type}\n` +
                            `• Duration: ${media.duration}\n` +
                            `• Url: ${media.expandedUrl}\n`;

                        await Chisato.sendVideo(
                            from,
                            video.url,
                            false,
                            str,
                            message
                        );
                    } else if (media.type === "animated_gif") {
                        const gif = media.videos[0];

                        str =
                            `*「 ANIMATED GIF 」*\n\n` +
                            `• Type: ${media.type}\n` +
                            `• Content Type: ${gif.content_type}\n` +
                            `• Duration: ${media.duration}\n` +
                            `• Url: ${media.expandedUrl}\n`;
                        await Chisato.sendVideo(
                            from,
                            gif.url,
                            true,
                            str,
                            message
                        );
                    } else {
                        str =
                            `*「 IMAGE 」*\n\n` +
                            `• Type: ${media.type}\n` +
                            `• Url: ${media.expandedUrl}\n`;

                        await Chisato.sendImage(
                            from,
                            media.image,
                            str,
                            message
                        );
                    }
                }
                await Chisato.sendReaction(from, "✅", message.key);
            })
            .catch(async (e) => {
                await Chisato.sendReaction(from, "❌", message.key);
                Chisato.logger.error(command.name, e);
                Chisato.sendText(
                    from,
                    "There is an error. Please report it to the bot creator immediately!\nMessage : " +
                        e,
                    message
                );
            });
    },
} satisfies ConfigCommands;