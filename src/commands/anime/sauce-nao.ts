import type { ConfigCommands } from "../../types/structure/commands";
import { SauceNaoScraper } from "../../utils/scrapers/anime/sauce-nao.scraper";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import path from 'path';
import fs from 'fs';

export default {
	name: "saucenao",
	alias: ["nao", "sauce", "sos"],
	category: "anime",
	description: "Reverse image search untuk menemukan sumber anime dari gambar",
	usage: "[reply image | image url]",
	cooldown: 5,
	limit: 2,
	async run({ Chisato, message, args, from, prefix }) {
		const scraper = new SauceNaoScraper();

		try {
			let imageBuffer: Buffer | null = null;
			let imageUrl: string | null = null;

			if (message.quoted && message.quoted.type === "imageMessage") {
				const quoted = message.quoted;
				if (quoted) {
					try {
						const baileys = await (async () => {
							const dynamicImport = new Function('specifier', 'return import(specifier)');
							return await dynamicImport("@whiskeysockets/baileys");
						})();
						const { downloadContentFromMessage, toBuffer } = baileys;

						const stream = await downloadContentFromMessage(
							quoted.message.imageMessage,
							"image"
						);
						imageBuffer = await toBuffer(stream);
					} catch (error) {
						return Chisato.sendText(
							from,
							"❌ Gagal mendownload gambar. Silakan coba lagi.",
							message
						);
					}
				}
			} else if (message.message?.imageMessage) {
				imageBuffer = await Chisato.downloadMediaMessage(message);
			} else if (args.length > 0 && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i.test(args[0])) {
				imageUrl = args[0];
			} else {
				let text = `*「 SAUCENAO - REVERSE IMAGE SEARCH 」*\n\n`;
				text += `🔍 Cari sumber anime dari gambar!\n\n`;
				text += `📝 *Cara menggunakan:*\n`;
				text += `1️⃣ Reply gambar dengan ${prefix}saucenao\n`;
				text += `2️⃣ Kirim gambar dengan caption ${prefix}saucenao\n`;
				text += `3️⃣ ${prefix}saucenao [url gambar]\n\n`;
				text += `💡 *Contoh:*\n`;
				text += `• ${prefix}saucenao (reply ke gambar anime)\n`;
				text += `• ${prefix}saucenao https://example.com/anime.jpg\n\n`;
				text += `✨ Powered by saucenao.com`;

				return Chisato.sendText(from, text, message);
			}

			let result: SauceNaoResult;

			if (imageBuffer) {
				const tempPath = path.join(__dirname, '../../../temp', `saucenao_${Date.now()}.jpg`);
				fs.writeFileSync(tempPath, imageBuffer);

				result = await scraper.searchByFile(tempPath);

				if (fs.existsSync(tempPath)) {
					fs.unlinkSync(tempPath);
				}
			} else if (imageUrl) {
				result = await scraper.searchByUrl(imageUrl);
			} else {
				return Chisato.sendText(
					from,
					"❌ Tidak ada gambar yang diberikan. Silakan reply gambar atau berikan URL gambar.",
					message
				);
			}

			if (result.error) {
				await Chisato.sendReaction(from, "❌", message.key);
				return Chisato.sendText(from, `❌ Error: ${result.error}`, message);
			}

			if (!result.title || result.similarity === 0) {
				await Chisato.sendReaction(from, "❌", message.key);
				let text = `❌ Tidak dapat menemukan sumber anime dari gambar ini.\n\n`;
				text += `💡 *Tips:*\n`;
				text += `• Coba gunakan command ${prefix}tracemoe sebagai alternatif\n`;
				text += `• Pastikan gambar cukup jelas\n`;
				text += `• Gunakan screenshot dari scene anime`;
				return Chisato.sendText(from, text, message);
			}

			const confidence = scraper.getConfidenceLevel(result.similarity);
			
			let text = `*「 SAUCENAO RESULT 」*\n\n`;
			text += `📌 *Title:*\n${result.title}\n\n`;
			
			if (result.description) {
				text += `📝 *Description:*\n${result.description}\n\n`;
			}
			
			text += `🎯 *Similarity:* ${scraper.formatSimilarity(result.similarity)}\n`;
			text += `✨ *Confidence:* ${confidence}\n\n`;

			if (result.MAL) {
				text += `🔗 *Links:*\n`;
				text += `• MyAnimeList: ${result.MAL}\n`;
			}

			text += `\n✨ Powered by saucenao.com`;

			await Chisato.sendReaction(from, "✅", message.key);

			const builder = new TemplateBuilder.Native(Chisato);
			
			builder
				.mainBody(text)
				.mainFooter("SauceNAO Reverse Image Search");

			const buttons = [];
			
			if (result.MAL) {
				buttons.push(builder.button.url({
					display: "Open MyAnimeList",
					url: result.MAL
				}));
			}
			
			buttons.push(builder.button.url({
				display: "Visit SauceNAO",
				url: "https://saucenao.com"
			}));

			builder.buttons(...buttons);

			const msg = await builder.render();
			await Chisato.relayMessage(from, msg.message, {
				messageId: msg.key.id
			});

		} catch (error) {
			console.error('SauceNAO Error:', error);
			await Chisato.sendReaction(from, "❌", message.key);
			return Chisato.sendText(
				from,
				`❌ Terjadi kesalahan: ${error instanceof Error ? error.message : 'Unknown error'}`,
				message
			);
		}
	}
} satisfies ConfigCommands;
