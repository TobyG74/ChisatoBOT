export interface MLPlayerResult {
    success: true;
    username: string;
    region: string;
    countryCode: string;
}

export interface MLPlayerError {
    success: false;
    message: string;
}

export type MLPlayerResponse = MLPlayerResult | MLPlayerError;
