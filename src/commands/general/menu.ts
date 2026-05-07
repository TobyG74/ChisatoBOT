import type { ConfigCommands } from "../../types/structure/commands";
import { commands } from "../../libs";
import fs from "fs";
import moment from "moment-timezone";

const CATEGORY_ICON: Record<string, string> = {
    general:      "🌐",
    downloader:   "📥",
    converter:    "🔄",
    search:       "🔎",
    anime:        "🎌",
    news:         "📰",
    wallpaper:    "🖼️",
    group:        "👥",
    groupsetting: "⚙️",
    games:        "🎮",
    misc:         "🎲",
    lookup:       "🔍",
    owner:        "👑",
    debugging:    "🛠️",
};

const getGreeting = (timezone: string): string => {
    const hour = parseInt(moment().tz(timezone).format("H"), 10);
    if (hour >= 4  && hour < 11) return "Good Morning";
    if (hour >= 11 && hour < 15) return "Good Afternoon";
    if (hour >= 15 && hour < 18) return "Good Evening";
    return "Good Night";
};

export default {
    name: "menu",
    alias: ["allmenu", "commands", "command", "cmd"],
    category: "general",
    description: "See All Menu List",
    async run({ Chisato, from, message, prefix, botName }) {
        const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        const tz: string = config.timezone || config.timeZone || "Asia/Jakarta";
        const { pushName } = message;

        const isMaintenance = (name: string) => config.maintenance?.includes(name);

        const allCmds = Array.from(commands.values());
        const category: Record<string, ConfigCommands[]> = {};

        for (const cmd of allCmds) {
            const cat = cmd.category || "misc";
            if (!category[cat]) category[cat] = [];
            category[cat].push(cmd);
        }

        const now      = moment().tz(tz);
        const greeting = getGreeting(tz);
        const catKeys  = Object.keys(category).sort((a, b) => a.localeCompare(b));

        // ── Header ──────────────────────────────────────────────
        let text = "";
        text += `✦ ──────────────────── ✦\n`;
        text += `        ✧ *${botName}* ✧\n`;
        text += `✦ ──────────────────── ✦\n\n`;

        text += `${greeting}, *${pushName || "Stranger"}* 👋\n`;
        text += `_${now.format("dddd, DD MMMM YYYY • HH:mm")} (WIB)_\n\n`;

        // ── Stats ────────────────────────────────────────────────
        text += `┌─────「 📊 *BOT STATS* 」\n`;
        text += `│  🤖 *Bot*    : ${botName}\n`;
        text += `│  🔑 *Prefix* : ${prefix}\n`;
        text += `│  📦 *Cmds*   : ${allCmds.length}\n`;
        text += `│  🗂️ *Cats*   : ${catKeys.length}\n`;
        text += `└${"─".repeat(24)}\n\n`;

        // ── Legend ───────────────────────────────────────────────
        text += `📌 *Legend:*\n`;
        text += `  ⭐ Owner  💎 Team  👑 Admin  ✅ Public\n`;
        text += `  〰️ = under maintenance\n\n`;

        // ── Categories ───────────────────────────────────────────
        for (const key of catKeys) {
            const icon   = CATEGORY_ICON[key] ?? "📂";
            const sorted = category[key].sort((a, b) => a.name.localeCompare(b.name));

            text += `┌─「 ${icon} *${key.toUpperCase()}* 」\n`;

            for (const v of sorted) {
                const badge = v.isOwner
                    ? "⭐"
                    : v.isTeam
                    ? "💎"
                    : v.isGroupAdmin
                    ? "👑"
                    : "✅";
                const usage     = v.usage ? ` _${v.usage}_` : "";
                const inMaint   = isMaintenance(v.name);
                const cmdText   = inMaint
                    ? `~${prefix}${v.name}~`
                    : `${prefix}${v.name}`;

                text += `│  ${badge} ${cmdText}${usage}\n`;
            }

            text += `└${"─".repeat(24)}\n\n`;
        }

        // ── Footer ───────────────────────────────────────────────
        text += `✦ ──────────────────── ✦\n`;
        text += `  _${prefix}help <cmd> for details_\n`;
        text += `✦ ──────────────────── ✦`;

        await Chisato.sendText(from, text, message);
    },
} satisfies ConfigCommands;