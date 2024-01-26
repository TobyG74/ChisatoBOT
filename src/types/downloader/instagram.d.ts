declare type IGDownloader = {
    status: string;
    p: string;
    v: string;
    data: string;
};

declare type InstagramDownloader = {
    status: number;
    message?: string;
    type?: string;
    result?: ResultInstagram[];
};

type ResultInstagram = {
    type: string;
    url: string;
};
