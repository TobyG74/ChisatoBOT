declare type InstagramMediaType = "image" | "video";

declare type InstagramImageQuality = {
    quality: string; 
    url: string;
}

declare type InstagramImageItem = {
    id: string;
    qualities: InstagramImageQuality[];
    defaultUrl: string;
}

declare type InstagramVideoItem = {
    url: string;
}

declare type InstagramResult = {
    type: InstagramMediaType;
    images?: InstagramImageItem[];
    video?: InstagramVideoItem;
}
