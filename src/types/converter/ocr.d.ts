declare type OCRResponse = {
    ParsedResults?: ParsedResult[];
    OCRExitCode: number;
    IsErroredOnProcessing: boolean;
    ErrorDetails?: string;
    ErrorMessage?: string[];
    ProcessingTimeInMilliseconds: string;
    SearchablePDFURL?: string;
};

type ParsedResult = {
    TextOverlay: TextOverlay;
    TextOrientation: string;
    FileParseExitCode: number;
    ParsedText: string;
    ErrorMessage: string;
    ErrorDetails: string;
};

type TextOverlay = {
    Lines: Line[];
    HasOverlay: boolean;
};

type Line = {
    LineText: string;
    Words: Word[];
    MaxHeight: number;
    MinTop: number;
};

type Word = {
    WordText: string;
    Left: number;
    Top: number;
    Height: number;
    Width: number;
};
