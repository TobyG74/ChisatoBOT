import Axios, { AxiosRequestConfig } from "axios";

export const getBuffer = async (url: string, options?: AxiosRequestConfig) => {
    try {
        options ? options : {};
        const response = await (
            await Axios.get(url, {
                headers: {
                    DNT: 1,
                    "Upgrade-Insecure-Request": 1,
                },
                ...options,
                responseType: "arraybuffer",
            })
        ).data;
        return response;
    } catch (e) {
        console.log(`Failed : ${e}`);
    }
};
