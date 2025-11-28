import FormData from 'form-data';
import { createReadStream } from 'fs';
import * as cheerio from 'cheerio';
import { BaseHTTPClient } from '../../core/base-http-client';

/**
 * SauceNAO Scraper
 * Reverse image search for anime source identification
 */
export class SauceNaoScraper extends BaseHTTPClient {
	private readonly baseURL = 'https://saucenao.com/search.php';

	constructor() {
		super({
			baseURL: 'https://saucenao.com',
			timeout: 30000,
			maxRetries: 2,
		});
	}

	/**
	 * Check if URL is a valid image URLz
	 */
	private async isValidImageURL(url: string): Promise<boolean> {
		try {
			const response = await fetch(url.replace('https:', 'http:'));
			return response.status === 200;
		} catch {
			return false;
		}
	}

	/**
	 * Search by image file (Buffer or file path)
	 */
	async searchByFile(filePath: string): Promise<SauceNaoResult> {
		try {
			const form = new FormData();
			form.append('file', createReadStream(filePath));

			const response = await new Promise<string>((resolve, reject) => {
				form.submit(this.baseURL, (err, res) => {
					if (err) {
						reject(err);
						return;
					}

					res.setEncoding('utf-8');
					let data = '';
					res.on('data', (chunk) => (data += chunk));
					res.on('end', () => resolve(data));
				});
			});

			return this.parseResponse(response);
		} catch (error) {
			return {
				title: '',
				description: '',
				similarity: 0,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Search by image URL
	 */
	async searchByUrl(imageUrl: string): Promise<SauceNaoResult> {
			try {
			if (!(await this.isValidImageURL(imageUrl))) {
				return {
					title: '',
					description: '',
					similarity: 0,
					error: 'Invalid image URL',
				};
			}

			const response = await this.client.get<string>(`/search.php?url=${imageUrl}`);
			return this.parseResponse(response.data);
		} catch (error) {
			return {
				title: '',
				description: '',
				similarity: 0,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Parse HTML response from SauceNAO
	 */
	private parseResponse(html: string): SauceNaoResult {
		try {
			const $ = cheerio.load(html);
			const result = $('#middle > div:nth-child(2)');

			const title = result.find('div.resulttitle > strong').text().trim();
			const description = result.find('div.resulttitle').text().trim();
			const similarityText = result
				.find('div.resultmatchinfo > div.resultsimilarityinfo')
				.text()
				.replace('%', '')
				.trim();
			const similarity = Number(similarityText) || 0;
			const malLink = result.find('div.resultmatchinfo > div.resultmiscinfo > a:nth-child(4)').attr('href');

			const output: SauceNaoResult = {
				title: title || '',
				description: description || '',
				similarity,
			};

			if (malLink) {
				output.MAL = malLink;
			}

			return output;
		} catch (error) {
			return {
				title: '',
				description: '',
				similarity: 0,
				error: error instanceof Error ? error.message : 'Failed to parse response',
			};
		}
	}

	/**
	 * Format similarity percentage
	 */
	formatSimilarity(similarity: number): string {
		return `${similarity.toFixed(2)}%`;
	}

	/**
	 * Get confidence level based on similarity
	 */
	getConfidenceLevel(similarity: number): string {
		if (similarity >= 90) return 'Very High 🟢';
		if (similarity >= 70) return 'High 🟡';
		if (similarity >= 50) return 'Medium 🟠';
		return 'Low 🔴';
	}
}
