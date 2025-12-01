import type { ConfigCommands } from "../../types/structure/commands";
import { commands } from "../../libs";
import fs from "fs";

export default {
    name: "menu",
    alias: ["allmenu", "commands", "command", "cmd"],
    category: "general",
    description: "See All Menu List",
    async run({ Chisato, from, message, prefix, botName }) {
        const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        const { pushName } = message;
        const category = [];
        const checkMaintenance = (name: string) => {
            if (config.maintenance.includes(name)) return true;
            return false;
        };
        const command = Array.from(commands.values()).map((res, i) => res);
        
        // Build category structure
        for (const cmd of command) {
            const value = commands.get(cmd.name);
            if (Object.keys(category).includes(value.category)) category[value.category].push(value);
            else {
                category[value.category] = [];
                category[value.category].push(value);
            }
        }

        // Modern WhatsApp Style Menu
        let caption = `╭━━━━『 *${botName}* 』━━━━╮\n\n`;
        caption += `👋 *Hello, ${pushName || "User"}!*\n\n`;
        caption += `╭───『 *INFO* 』\n`;
        caption += `│ • Total Commands: *${command.length}*\n`;
        caption += `│ • Prefix: *${prefix}*\n`;
        caption += `│ • Categories: *${Object.keys(category).length}*\n`;
        caption += `╰────────────────\n\n`;
        
        caption += `📝 *Command Legend:*\n`;
        caption += `• ⭐ = Owner Only\n`;
        caption += `• 💎 = Team Only\n`;
        caption += `• 👑 = Group Admin\n`;
        caption += `• ✨ = Public\n\n`;
        
        caption += `⚠️ *Note:*\n`;
        caption += `Commands with ~strikethrough~ are under maintenance\n`;
        caption += `Example: ${prefix}~command~\n\n`;

        const keys = Object.keys(category).sort((a, b) => a.localeCompare(b));
        
        for (const key of keys) {
            const categoryCommands = category[key].sort((a: ConfigCommands, b: ConfigCommands) => 
                a.name.localeCompare(b.name)
            );
            
            caption += `┏━━━『 *${key.toUpperCase()}* 』\n`;
            
            categoryCommands.forEach((v: ConfigCommands, i: number) => {
                const icon = v.isOwner ? "⭐" : v.isTeam ? "💎" : v.isGroupAdmin ? "👑" : "✨";
                const cmdName = checkMaintenance(v.name) ? `~${v.name}~` : v.name;
                const usage = v.usage ? ` ${v.usage}` : "";
                
                caption += `┃ ${icon} ${prefix}${cmdName}${usage}\n`;
            });
            
            caption += `┗━━━━━━━━━━━━━━━\n\n`;
        }
        
        caption += `╰━━━━━━━━━━━━━━━╯\n`;
        caption += `_Powered by ${botName}_`;
        
        await Chisato.sendText(from, caption, message);
    },
} satisfies ConfigCommands;