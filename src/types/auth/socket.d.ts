import { AxiosRequestConfig } from "axios";
import {
    AuthenticationState,
    CacheStore,
    MediaConnInfo,
    SignalAuthState,
    TransactionCapabilityOptions,
    WABrowserDescription,
    WAVersion,
    proto,
} from "baileys";
import { UserFacingSocketConfig } from "baileys/Socket";

type Config = {
    /** type of session */
    session: "multi" | "single";
};

declare type SocketConfig = Partial<UserFacingSocketConfig> & Config;
