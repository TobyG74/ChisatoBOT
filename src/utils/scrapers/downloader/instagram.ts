import Axios from "axios";
import cheerio from "cheerio";

const apiURL = "https://v3.igdownloader.app/api/ajaxSearch";

export class instagram {
    private request = (url: string): Promise<IGDownloader> =>
        new Promise(async (resolve, reject) => {
            Axios(apiURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
                },
                data: new URLSearchParams(Object.entries({ recaptchaToken: "", q: url, t: "media", lang: "en" })),
            })
                .then(({ data }) => resolve(data))
                .catch((err) => reject(err));
        });

    /** Instagram Download Post */
    public post = (url: string): Promise<InstagramDownloader> =>
        new Promise(async (resolve, reject) => {
            this.request(url)
                .then((data: any) => {
                    if (data.status === "ok") {
                        const $ = cheerio.load(data.data);
                        const result = [];

                        $("div.download-items")
                            .get()
                            .map((res) => {
                                const title = $(res).find("a").attr("title").trim().toLowerCase();
                                const url = $(res).find("a").attr("href");
                                if (title.includes("photo"))
                                    result.push({
                                        type: "image",
                                        url,
                                    });
                                else if (title.includes("video"))
                                    result.push({
                                        type: "video",
                                        url,
                                    });
                            });

                        if (result.length > 0)
                            resolve({
                                status: 200,
                                type: "post",
                                result,
                            });
                        else
                            resolve({
                                status: 404,
                                message: "Post not found or account is private",
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

    /** Instagram Download Reels */
    public reels = (url: string): Promise<InstagramDownloader> =>
        new Promise(async (resolve, reject) => {
            this.request(url)
                .then((data) => {
                    if (data.status === "ok") {
                        const $ = cheerio.load(data.data);
                        const result = [];

                        $("div.download-items")
                            .get()
                            .map((res) => {
                                const title = $(res).find("a").attr("title").trim().toLowerCase();
                                const url = $(res).find("a").attr("href");
                                if (title.includes("video"))
                                    result.push({
                                        type: "video",
                                        url,
                                    });
                            });

                        if (result.length > 0)
                            resolve({
                                status: 200,
                                type: "reels",
                                result,
                            });
                        else
                            resolve({
                                status: 404,
                                message: "Reels not found or account is private",
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

    /** Instagram Download Story */
    public story = (url: string): Promise<InstagramDownloader> =>
        new Promise<InstagramDownloader>(async (resolve, reject) => {
            this.request(url)
                .then((data) => {
                    if (data.status === "ok") {
                        const $ = cheerio.load(data.data);
                        const result = [];

                        $("div.download-items")
                            .get()
                            .map((res) => {
                                const title = $(res).find("a").attr("title").trim().toLowerCase();
                                const url = $(res).find("a").attr("href");
                                if (title.includes("photo"))
                                    result.push({
                                        type: "image",
                                        url,
                                    });
                                else if (title.includes("video"))
                                    result.push({
                                        type: "video",
                                        url,
                                    });
                            });

                        if (result.length > 0)
                            resolve({
                                status: 200,
                                type: "story",
                                result,
                            });
                        else
                            resolve({
                                status: 404,
                                message: "Story not found or account is private!",
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
