import FormData from "form-data";
import axios, { AxiosResponse } from "axios";

export async function enhanceImage(store: Buffer, name: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
        const validExports = ["enhance", "recolor", "dehaze"];
        name = validExports.includes(name) ? name : validExports[0];

        const data = new FormData();
        const apiUrl = `https://inferenceengine.vyro.ai/${name}`;

        data.append("model_version", "1");
        data.append("image", Buffer.from(store), {
            filename: "enhance_image_body.jpg",
            contentType: "image/jpeg",
        });

        try {
            const response: AxiosResponse = await axios.post(apiUrl, data, {
                headers: {
                    "User-Agent": "okhttp/4.9.3",
                    Connection: "Keep-Alive",
                    "Accept-Encoding": "gzip",
                    ...data.getHeaders(),
                },
                responseType: 'arraybuffer',
            });

            resolve(Buffer.from(response.data));
        } catch (error) {
            reject(new Error("Request failed"));
        }
    });
}
