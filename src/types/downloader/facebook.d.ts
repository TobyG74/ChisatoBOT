declare type FacebookVideoResult = {
    title: string;
    duration: string;
    thumbnail: string;
    mp4: Array<{
        quality: string;
        render: boolean;
        type: "direct" | "render";
        url?: string;
        videoUrl?: string;
        videoCodec?: string;
        videoType?: string;
    }>;
}