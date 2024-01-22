declare type Peakpx = {
    totalImages: number;
    result: ResultPeakpx[];
};

type ResultPeakpx = {
    quality: string;
    tags: string;
    url: string;
    source: string;
};
