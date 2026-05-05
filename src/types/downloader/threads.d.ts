declare type ThreadsMediaType = "video" | "image";

declare type ThreadsMediaItem = {
    type: ThreadsMediaType;
    quality: string;
    url: string;
    mimeType: string;
};

declare type ThreadsResult = {
    thumbnail: string;
    items: ThreadsMediaItem[];
};
