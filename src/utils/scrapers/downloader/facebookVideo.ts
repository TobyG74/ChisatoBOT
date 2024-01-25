import Axios from "axios";
import cheerio from "cheerio";

const baseURL = "https://fdownloader.net/id";
const apiURL = "https://v3.fdownloader.net/api/ajaxSearch?lang=en";

export const facebookVideo = (url: string): Promise<FacebookVideo> =>
    new Promise(async (resolve, reject) => {
        const { data } = await Axios(baseURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
            },
            data: new URLSearchParams(
                Object.entries({
                    recaptchaToken: "",
                    q: url,
                    t: "media",
                    lang: "en",
                })
            ),
        });
        const $ = cheerio.load(data);
        const script = $("body").find("script").text().trim();
        const k_token = script.split("k_token = ")[1].split(";")[0];
        const k_exp = script.split("k_exp = ")[1].split(";")[0];
        Axios(apiURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
            },
            data: new URLSearchParams(
                Object.entries({
                    k_exp,
                    k_token,
                    q: url,
                    lang: "en",
                    web: "fdownloader.net",
                    v: "v2",
                    w: "",
                })
            ),
        })
            .then(({ data }) => {
                const $ = cheerio.load(data.data);
                const result: ResultFacebookVideo[] = [];
                const duration = $("div.clearfix > p").text().trim();
                $("div.tab__content")
                    .map((i, el) => $(el))
                    .get(0)
                    .find("tbody > tr")
                    .each((index, element) => {
                        const quality = $(element).find("td.video-quality").text();
                        const url = $(element).find("td > a").attr("href");
                        if (quality && url)
                            result.push({
                                quality,
                                url,
                            });
                    });
                resolve({
                    duration,
                    result,
                });
            })
            .catch((err) => {
                console.log(err);
            });
    });
