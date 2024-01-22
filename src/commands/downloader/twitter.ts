import { TwitterDL } from "twitter-downloader";
import type { ConfigCommands } from "../../types/commands";
import { isURL } from "../../libs";

export default <ConfigCommands>{
    name: "twitterdownload",
    alias: ["twitterdl", "twtdl"],
    usage: "<url|slide>",
    category: "downloader",
    description: "Download Videos from Twitter",
    isProcess: true,
    cooldown: 3,
    example: `• /twitterdownload https://www.twitter.com/elonmusk/status/xxxxxx`,
    async run({ Chisato, from, query, command, message }) {
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        TwitterDL(query)
            .then(async (res) => {
                if (res.status === "error") {
                    Chisato.log("error", command.name, res.message);
                    return Chisato.sendText(from, res.message, message);
                }
                let str =
                    `*「 TWITTER DOWNLOADER 」*\n\n` +
                    `• ID: ${res.result.id}\n` +
                    `• Description: ${res.result.description}\n` +
                    `• Created At: ${res.result.createdAt}\n` +
                    `• Language: ${res.result.languange}\n` +
                    `• Possibly Sensitive: ${res.result.possiblySensitive ? "Yes" : "No"}\n` +
                    `• Quote Status: ${res.result.isQuoteStatus ? "Yes" : "No"}\n\n` +
                    `*「 STATISTICS 」*\n\n` +
                    `• Favorites: ${res.result.statistics.favoriteCount}\n` +
                    `• Replies: ${res.result.statistics.replieCount}\n` +
                    `• Retweets: ${res.result.statistics.retweetCount}\n` +
                    `• Views: ${res.result.statistics.viewCount}\n\n` +
                    `*「 AUTHOR 」*\n\n` +
                    `• Username: ${res.result.author.username}\n` +
                    `• Verified: ${res.result.author.verified ? "Yes" : "No"}\n` +
                    `• Location: ${res.result.author.location}\n` +
                    `• Possibly Sensitive: ${res.result.author.possiblySensitive ? "Yes" : "No"}\n` +
                    `• Url: ${res.result.author.url}\n`;
                await Chisato.sendText(from, str, message);
                for (const media of res.result.media) {
                    if (media.type === "video") {
                        const video = media.videos.reduce((maxBitrateResult, currentResult) => {
                            return currentResult.bitrate > maxBitrateResult.bitrate ? currentResult : maxBitrateResult;
                        }, media.videos[0]);
                        str =
                            `*「 VIDEO 」*\n\n` +
                            `• Type: ${media.type}\n` +
                            `• Bitrate: ${video.bitrate}\n` +
                            `• Quality: ${video.quality}\n` +
                            `• Content Type: ${video.content_type}\n` +
                            `• Duration: ${media.duration}\n` +
                            `• Url: ${media.expandedUrl}\n`;
                        await Chisato.sendVideo(from, video.url, false, str, message);
                    } else {
                        str = `*「 IMAGE 」*\n\n` + `• Type: ${media.type}\n` + `• Url: ${media.expandedUrl}\n`;
                        await Chisato.sendImage(from, media.image, str, message);
                    }
                }
            })
            .catch((e) => {
                Chisato.log("error", command.name, e);
                Chisato.sendText(
                    from,
                    "There is an error. Please report it to the bot creator immediately!\nMessage : " + e,
                    message
                );
            });
    },
};
