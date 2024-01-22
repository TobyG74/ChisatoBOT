import Axios from "axios";

const _apiAjax = "https://tomp3.cc/api/ajax/search?hl=en";
const _apiConvert = "https://tomp3.cc/api/ajax/convert?hl=en";
const watchUrl = "https://www.youtube.com/watch?v=";
const imageUrl = (id: string) => `https://i.ytimg.com/vi/${id}/0.jpg`;

export const Y2mate = (url: string, type: string): Promise<Y2mate> =>
    new Promise((resolve, reject) => {
        Axios(_apiAjax, {
            method: "POST",
            headers: {
                "Content-type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0",
                "X-Requested-With": "XMLHttpRequest",
            },
            data: new URLSearchParams(Object.entries({ query: url, vt: "downloader" }) as any),
        })
            .then(({ data }) => {
                if (data.status !== "ok") {
                    return reject(data.mess);
                }
                if (type === "video") {
                    const videoKeys = Object.values(data.links.mp4).map((videoData) => videoData) as {
                        k: string;
                        size: string;
                    }[];
                    Promise.all(videoKeys.map((video) => Y2mateDownload(data.vid, video.k, video.size)))
                        .then((videoResults) => {
                            videoResults = videoResults.filter((v: any) => v.type !== "3gp" && v.size !== "");
                            resolve({
                                title: data.title,
                                channel: data.a,
                                thumbnail: imageUrl(data.vid),
                                url: watchUrl + data.vid,
                                result: videoResults as ResultY2mate[],
                            });
                        })
                        .catch(reject);
                } else {
                    const audioKeys = Object.values(data.links.mp3).map((audioData) => audioData) as {
                        k: string;
                        size: string;
                    }[];
                    Promise.all(audioKeys.map((audio) => Y2mateDownload(data.vid, audio.k, audio.size)))
                        .then((audioResults) => {
                            audioResults = audioResults.filter((v: any) => v.type === "mp3");
                            resolve({
                                title: data.title,
                                channel: data.a,
                                thumbnail: imageUrl(data.vid),
                                url: watchUrl + data.vid,
                                result: audioResults as ResultY2mate[],
                            });
                        })
                        .catch(reject);
                }
            })
            .catch(reject);
    });

const Y2mateDownload = (vid: string, k: string, size: string) =>
    new Promise((resolve, reject) => {
        Axios(_apiConvert, {
            method: "POST",
            headers: {
                "Content-type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0",
                "X-Requested-With": "XMLHttpRequest",
            },
            data: new URLSearchParams(Object.entries({ vid, k })),
        })
            .then(({ data }) => {
                if (data.status !== "ok") {
                    return reject(data.mess);
                }
                resolve({
                    quality: data.fquality,
                    type: data.ftype,
                    size,
                    url: data.dlink,
                });
            })
            .catch(reject);
    });
