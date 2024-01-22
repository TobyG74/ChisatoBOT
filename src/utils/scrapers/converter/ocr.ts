import Axios from "axios";
import formData from "form-data";

export const ocrScanner = async (buffer: Buffer): Promise<OCRResponse> =>
    new Promise(async (resolve, reject) => {
        const form = new formData();
        form.append("apikey", process.env.OCR_APIKEY);
        form.append("file", buffer, `${Date.now()}.png`);
        form.append("OCREngine", 2);
        Axios("https://api.ocr.space/parse/image", {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data",
            },
            data: form,
        })
            .then(({ data }) => {
                resolve(data);
            })
            .catch((err) => reject(err));
    });
