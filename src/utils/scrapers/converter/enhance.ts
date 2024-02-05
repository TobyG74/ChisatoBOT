import FormData from "form-data";
import fetch from "node-fetch";

export async function enhanceImage(store: Buffer, name: string): Promise<Buffer> {
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
        const response = await fetch(apiUrl, {
            method: "POST",
            body: data,
            headers: {
                "User-Agent": "okhttp/4.9.3",
                Connection: "Keep-Alive",
                "Accept-Encoding": "gzip",
            },
        });

        if (!response.ok) {
            throw new Error("Failed to fetch");
        }

        return await response.buffer();
    } catch (error) {
        throw new Error("Request failed");
    }
}
