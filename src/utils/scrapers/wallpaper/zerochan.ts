import Axios from "axios";
import { load } from "cheerio";

export const ZeroChan = (query: string): Promise<ZeroChan[]> =>
    new Promise(async (resolve, reject) => {
        Axios.get(`https://www.zerochan.net/${query}`)
            .then(({ data }) => {
                const $ = load(data);
                const result = [];
                $("ul#thumbs2 li")
                    .get()
                    .map((res) => {
                        const title = $(res).find("a > img").attr("title");
                        const image = $(res).find("p > a").attr("href");
                        if (!image) return;
                        result.push({
                            quality: title.split(" ")[0],
                            size: title.split(" ")[1],
                            url: image,
                            source: "https://www.zerochan.net" + $(res).find("a").attr("href"),
                        });
                    });
                if (result.length === 0) {
                    return resolve([]);
                }
                resolve(result);
            })
            .catch(reject);
    });
