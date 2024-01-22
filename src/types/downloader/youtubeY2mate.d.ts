declare type Y2mate = {
    title: string;
    channel: string;
    url: string;
    thumbnail: string;
    result: ResultY2mate[];
};

type ResultY2mate = {
    quality: string;
    type: string;
    size: string;
    url: string;
};
