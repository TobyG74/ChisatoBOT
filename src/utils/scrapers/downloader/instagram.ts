const Axios = require("axios");
const cheerio = require("cheerio");

const apiURL = "https://v3.igdownloader.app/api/ajaxSearch";

export class instagram {
    private request(url: string) {
        return new Promise<IGDownloader>(async (resolve, reject) => {
            Axios(apiURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    Origin: "https://saveig.com",
                    Referer: "https://saveig.com/",
                    DNT: 1,
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
                },
                data: new URLSearchParams(Object.entries({ recaptchaToken: "", q: url, t: "media", lang: "en" })),
            })
                .then(({ data }) => resolve(data))
                .catch((err) => reject(err));
        });
    }

    /** Instagram Download Post */
    public post(url: string) {
        return new Promise<InstagramDownloader>(async (resolve, reject) => {
            this.request(url)
                .then((data: any) => {
                    if (data.status === "ok") {
                        const $ = cheerio.load(data.data);
                        const images = [];
                        $("li")
                            .get()
                            .map((img, i) => {
                                const imgs = [];
                                $(img)
                                    .find("option")
                                    .get()
                                    .map((v) => {
                                        imgs.push({
                                            size: $(v).text().trim(),
                                            download: $(v).attr("value"),
                                        });
                                    });
                                images.push({
                                    [i]: imgs,
                                });
                            });
                        if (images.length !== 0)
                            resolve({
                                status: 200,
                                type: "image",
                                images,
                            });
                        resolve({
                            status: 200,
                            type: "video",
                            video: $("div.download-items__btn > a").attr("href"),
                        });
                    } else {
                        resolve({
                            status: 404,
                            message: "Post not found or account is private",
                        });
                    }
                })
                .catch((err) => reject(err));
        });
    }

    /** Instagram Download Reels */
    public reels(url: string) {
        return new Promise<InstagramDownloader>(async (resolve, reject) => {
            this.request(url)
                .then((data) => {
                    if (data.status === "ok") {
                        const $ = cheerio.load(data.data);
                        resolve({
                            status: 200,
                            type: "reels",
                            video: $("div.download-items__btn > a").attr("href"),
                        });
                    } else {
                        resolve({
                            status: 404,
                            message: "Reels not found or account is private",
                        });
                    }
                })
                .catch((err) => reject(err));
        });
    }

    /** Instagram Download Story */
    public story(url: string) {
        return new Promise<InstagramDownloader>(async (resolve, reject) => {
            this.request(url)
                .then((data) => {
                    if (data.status === "ok") {
                        const $ = cheerio.load(data.data);
                        resolve({
                            status: 200,
                            type: "story",
                            video: $("div.download-items__btn > a").attr("href"),
                        });
                    } else {
                        resolve({
                            status: 404,
                            message: "Story not found or account is private!",
                        });
                    }
                })
                .catch((err) => reject(err));
        });
    }
}
