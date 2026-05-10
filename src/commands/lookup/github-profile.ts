import type { ConfigCommands } from "../../types/structure/commands";
import { fetchGithubUser } from "../../utils/scrapers/lookup";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import axios from "axios";

export default {
    name: "githubprofile",
    alias: ["github", "ghprofile", "ghuser"],
    usage: "[username]",
    category: "lookup",
    description: "Lookup a GitHub user profile",
    cooldown: 5,
    limit: 2,
    example: `*「 GITHUB PROFILE 」*

🐙 Lookup a GitHub user profile!

📝 *How to use:*
{prefix}{command.name} [username]

💡 *Example:*
• {prefix}{command.name} TobyG74`,
    async run({ Chisato, from, query, message, command }) {
        const username = query?.trim();

        if (!username) {
            return Chisato.sendText(
                from,
                `❌ Please provide a GitHub username.\n\nUsage: {prefix}${command.name} [username]`,
                message
            );
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);

            const user = await fetchGithubUser(username);

            const joinedAt = new Date(user.created_at).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
            });

            let text = `👤 *Name:* ${user.name || user.login}\n`;
            text += `🔖 *Username:* @${user.login}\n`;
            if (user.bio) text += `📝 *Bio:* ${user.bio}\n`;
            if (user.location) text += `📍 *Location:* ${user.location}\n`;
            if (user.company) text += `🏢 *Company:* ${user.company}\n`;
            if (user.blog) text += `🌐 *Website:* ${user.blog}\n`;
            text += `\n📦 *Repos:* ${user.public_repos}\n`;
            text += `👥 *Followers:* ${user.followers.toLocaleString()}\n`;
            text += `➡️ *Following:* ${user.following.toLocaleString()}\n`;
            text += `📅 *Joined:* ${joinedAt}\n`;
            text += `\n✨ Powered by GitHub API`;

            let res = await axios.get(user.avatar_url, { responseType: "arraybuffer", timeout: 10000 })

            const builder = new TemplateBuilder.Native(Chisato);
            builder
                .mainBody(text)
                .mainFooter("GitHub Profile")
                .mainHeader(`*「 GITHUB PROFILE 」*`, Buffer.from(res.data))
                .buttons(
                    builder.button.url({ display: "🐙 Open GitHub Profile", url: user.html_url })
                );

            const msg = await builder.render();
            await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);

            if (error.response?.status === 404) {
                return Chisato.sendText(from, `❌ GitHub user *${username}* not found.`, message);
            }
            if (error.response?.status === 403) {
                return Chisato.sendText(from, `❌ GitHub API rate limit exceeded. Try again later.`, message);
            }

            Chisato.logger.error(command.name, error);
            return Chisato.sendText(from, `❌ Failed to fetch GitHub profile.\n\nError: ${error.message}`, message);
        }
    },
} satisfies ConfigCommands;
