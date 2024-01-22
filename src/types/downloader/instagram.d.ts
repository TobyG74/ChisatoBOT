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
    images?: Images[];
    video?: string;
};

type Images = {
    [string]: {
        size: string;
        download: string;
    };
};
