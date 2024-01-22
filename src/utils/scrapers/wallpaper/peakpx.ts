import Axios from "axios";
import cheerio from "cheerio";

export const Peakpx = (query: string, page: string): Promise<Peakpx> =>
    new Promise(async (resolve, reject) => {
        Axios.get(`https://www.peakpx.com/en/search?q=${query}&page=${page}`, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 9; Redmi Note 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36",
            },
        })
            .then(({ data }) => {
                const $ = cheerio.load(data);
                const result: ResultPeakpx[] = [];
                $("ul#list_ul > li")
                    .get()
                    .map((res: any) => {
                        result.push({
                            quality: $(res).find("span").text().trim(),
                            tags: $(res).find("img").attr("alt"),
                            url: $(res).find("img").attr("data-src").replace("-thumbnail", ""),
                            source: $(res).find("a").attr("href"),
                        });
                    });
                resolve({
                    totalImages: result.length,
                    result,
                });
            })
            .catch(reject);
    });
