import type { ConfigCommands } from "../../types/structure/commands";
import { createWelcomeImage } from "../../utils/converter/welcome";
import path from "path";

export default {
    name: "testwelcome",
    alias: ["testwel", "debugwelcome"],
    usage: "",
    category: "debugging",
    description: "Test welcome message with custom image (for debugging welcome/leave feature)",
    isOwner: true,
    async run({ Chisato, from, message }) {
        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            // Get user info
            const sender = message.key.remoteJid?.includes("@g.us") 
                ? message.key.participant 
                : message.key.remoteJid;
            
            if (!sender) {
                return Chisato.sendText(from, "❌ Cannot get sender information", message);
            }

            // Get group info
            let groupName = "Test Group";
            let memberCount = 1;
            
            if (from.includes("@g.us")) {
                const groupMetadata = await Chisato.groupMetadata(from);
                groupName = groupMetadata.subject;
                memberCount = groupMetadata.participants.length;
            }

            // Get user profile picture
            let profilePicUrl: string;
            try {
                profilePicUrl = await Chisato.profilePictureUrl(sender, "image");
            } catch {
                // Use local noprofile image if profile not found
                profilePicUrl = path.join(process.cwd(), "media", "noprofile.png");
            }

            // Get username
            const pushName = message.pushName || sender.split("@")[0];

            // Create welcome image
            const welcomeBuffer = await createWelcomeImage(
                profilePicUrl,
                pushName,
                groupName,
                memberCount
            );

            // Send welcome image
            await Chisato.sendImage(
                from,
                welcomeBuffer,
                `*WELCOME TEST* 🎉\n\n*User:* ${pushName}\n*Group:* ${groupName}\n*Members:* ${memberCount}\n\n_This is a test message for welcome/leave feature_`,
                message
            );

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            console.error("Welcome test error:", error);
            await Chisato.sendText(
                from,
                `❌ Failed to create welcome image.\n\nError: ${error.message}`,
                message
            );
        }
    },
} satisfies ConfigCommands;