import Axios from "axios";
import FormData from "form-data";

export const Telegraph = (buffer: Buffer) => {
    return new Promise(async (resolve, reject) => {
        const form = new FormData();
        form.append("file", buffer, Date.now() + ".jpg");
        await Axios("https://telegra.ph/upload", {
            method: "POST",
            headers: { ...form.getHeaders() },
            data: form,
        })
            .then(({ data }) => {
                resolve({
                    result: "https://telegra.ph" + data[0].src,
                });
            })
            .catch((e) => reject(e));
    });
};
