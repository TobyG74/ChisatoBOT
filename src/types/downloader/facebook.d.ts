declare type FacebookResult = {
    thumbnail: string;
    videos: Array<{
        quality: string;
        url: string;
    }>;
}