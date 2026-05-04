import type { ConfigCommands } from "../../types/structure/commands.js";
import { news } from "../../utils";
import Axios from "axios";

export default {
    name: "earthquake",
    alias: ["infogempa", "gempa"],
    usage: "",
    category: "news",
    description: "Showing latest earthquake in Indonesia from BMKG",
    cooldown: 3,
    async run({ Chisato, from, message }) {
        await Chisato.sendReaction(from, "⏳", message.key);
        try {
            const data = await news.getEarthquake();

            let caption = "*🌍 Latest Earthquake Information*\n";
            caption +=
                "_Data from BMKG (Meteorologi, Klimatologi, dan Geofisika)_\n\n";

            for (let i = 0; i < data.length; i++) {
                const res = data[i];

                caption +=
                    i === 0
                        ? "━━━ *MOST SIGNIFICANT* ━━━\n\n"
                        : i === 1
                        ? "\n━━━ *RECENT EARTHQUAKES* ━━━\n\n"
                        : "\n";

                caption += `• *Tanggal:* ${res.tanggal}\n`;
                caption += `• *Jam:* ${res.jam}\n`;
                caption += `• *Koordinat:* ${res.coordinates}\n`;
                caption += `  - Lintang: ${res.lintang}\n`;
                caption += `  - Bujur: ${res.bujur}\n`;
                caption += `• *Magnitude:* ${res.magnitude}\n`;
                caption += `• *Kedalaman:* ${res.kedalaman}\n`;
                caption += `• *Wilayah:* ${res.wilayah}\n`;
                caption += `• *Potensi:* ${res.potensi}\n`;

                if (res.dirasakan) {
                    caption += `• *Dirasakan:* ${res.dirasakan}\n`;
                }

                if (i === 0 && res.shakemap) {
                    await Chisato.sendImage(
                        from,
                        res.shakemap,
                        caption,
                        message
                    );
                    caption = "";
                } else if (i === data.length - 1) {
                    if (caption) {
                        await Chisato.sendText(from, caption, message);
                    }
                }
            }

            if (caption && !data[0]?.shakemap) {
                await Chisato.sendText(from, caption, message);
            }
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (err: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.sendText(
                from,
                "There is an error fetching earthquake data. Please try again later!\nMessage: " +
                    err.message,
                message
            );
            Chisato.logger.error("Error fetching earthquake data:", err);
        }
    },
} satisfies ConfigCommands;