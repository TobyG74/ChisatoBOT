import Axios from "axios";
import * as cheerio from "cheerio";
import type { MLPlayerResponse } from "../../../types/lookup/ml";

export type { MLPlayerResult, MLPlayerError, MLPlayerResponse } from "../../../types/lookup/ml";

const BASE_URL = "https://gempaytopup.com/stalk-ml";
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";

export async function checkMLPlayer(
    userID: string,
    serverID: string
): Promise<MLPlayerResponse> {
    const getRes = await Axios.get(BASE_URL, {
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html",
        },
        timeout: 15000,
    });

    const rawCookies: string[] =
        (getRes.headers["set-cookie"] as string[]) || [];
    const cookieStr = rawCookies
        .map((c: string) => c.split(";")[0])
        .join("; ");

    const $ = cheerio.load(getRes.data as string);
    const csrfToken =
        $('meta[name="csrf-token"]').attr("content") ||
        $('input[name="_token"]').attr("value") ||
        "";

    const postRes = await Axios.post(
        BASE_URL,
        { uid: userID, zone: serverID },
        {
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": csrfToken,
                Cookie: cookieStr,
                Referer: "https://gempaytopup.com/",
                Origin: "https://gempaytopup.com",
                "User-Agent": USER_AGENT,
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/json, text/javascript, */*; q=0.01",
            },
            timeout: 15000,
        }
    );

    const data = postRes.data as {
        success: boolean;
        username?: string;
        region?: string;
        country_code?: string;
        message?: string;
    };

    if (data.success) {
        return {
            success: true,
            username: data.username ?? "",
            region: data.region ?? "",
            countryCode: data.country_code ?? "",
        };
    }

    return {
        success: false,
        message: data.message ?? "ID atau Server tidak valid",
    };
}
