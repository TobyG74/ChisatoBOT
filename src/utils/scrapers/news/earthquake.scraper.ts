import Axios from "axios";
import { load } from "cheerio";

const URL_INDONESIA_WITH_IMAGE =
    "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json";
const URL_INDONESIA_WITHOUT_IMAGE =
    "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json";

/**
 * Get latest earthquake information from BMKG Indonesia
 */
export const getEarthquake = async (): Promise<EarthquakeData[]> => {
    try {
        // Get earthquake without image
        const { Infogempa: infoWithoutImage } = (
            await Axios.get(URL_INDONESIA_WITHOUT_IMAGE)
        ).data;
        const { gempa: recentEarthquakes } = infoWithoutImage;

        // Get earthquake with image
        const { Infogempa: infoWithImage } = (
            await Axios.get(URL_INDONESIA_WITH_IMAGE)
        ).data;
        const {
            Tanggal: date,
            Jam: time,
            DateTime: dateTime,
            Coordinates: coordinates,
            Lintang: latitude,
            Bujur: longitude,
            Magnitude: magnitude,
            Kedalaman: depth,
            Wilayah: region,
            Potensi: potency,
            Dirasakan: feel,
            Shakemap: shakemap,
        } = infoWithImage.gempa;

        const results: EarthquakeData[] = [
            {
                tanggal: date,
                jam: time,
                datetime: dateTime,
                coordinates,
                lintang: latitude,
                bujur: longitude,
                magnitude,
                kedalaman: depth,
                wilayah: region,
                potensi: potency,
                dirasakan: feel,
                shakemap: `https://data.bmkg.go.id/DataMKG/TEWS/${shakemap}`,
            },
        ];

        // Add recent earthquakes
        for (const data of recentEarthquakes) {
            results.push({
                tanggal: data.Tanggal,
                jam: data.Jam,
                datetime: data.DateTime,
                coordinates: data.Coordinates,
                lintang: data.Lintang,
                bujur: data.Bujur,
                magnitude: data.Magnitude,
                kedalaman: data.Kedalaman,
                wilayah: data.Wilayah,
                potensi: data.Potensi,
            });
        }

        return results;
    } catch (error) {
        throw error;
    }
};

/**
 * Get latest earthquake information from BMKG
 */
export const LatestEarthquake = (): Promise<EarthquakeData> =>
    new Promise(async (resolve, reject) => {
        try {
            const { data } = await Axios.get(
                "https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg"
            );
            const $ = load(data);

            const tabelGempa = $("table.table-hover tr");
            if (tabelGempa.length === 0) {
                return reject(new Error("No earthquake data found"));
            }

            // Get the latest earthquake (first row after header)
            const latestRow = tabelGempa.eq(1);

            const tanggal = latestRow.find("td").eq(1).text().trim();
            const jam = latestRow.find("td").eq(2).text().trim();
            const coordinates = latestRow.find("td").eq(3).text().trim();
            const magnitude = latestRow.find("td").eq(4).text().trim();
            const kedalaman = latestRow.find("td").eq(5).text().trim();
            const wilayah = latestRow.find("td").eq(6).text().trim();
            const potensi = latestRow.find("td").eq(7).text().trim();

            // Parse coordinates
            const coordParts = coordinates.split(",");
            const lintang = coordParts[0]?.trim() || "";
            const bujur = coordParts[1]?.trim() || "";

            resolve({
                tanggal,
                jam,
                datetime: `${tanggal} ${jam}`,
                coordinates,
                lintang,
                bujur,
                magnitude,
                kedalaman,
                wilayah,
                potensi,
            });
        } catch (error) {
            reject(error);
        }
    });

/**
 * Get recent earthquakes (multiple) from BMKG
 */
export const RecentEarthquakes = (
    limit: number = 10
): Promise<EarthquakeData[]> =>
    new Promise(async (resolve, reject) => {
        try {
            const { data } = await Axios.get(
                "https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg"
            );
            const $ = load(data);

            const tabelGempa = $("table.table-hover tr");
            if (tabelGempa.length === 0) {
                return reject(new Error("No earthquake data found"));
            }

            const earthquakes: EarthquakeData[] = [];

            // Skip header row (index 0), get data rows
            tabelGempa.slice(1, limit + 1).each((_, row) => {
                const tanggal = $(row).find("td").eq(1).text().trim();
                const jam = $(row).find("td").eq(2).text().trim();
                const coordinates = $(row).find("td").eq(3).text().trim();
                const magnitude = $(row).find("td").eq(4).text().trim();
                const kedalaman = $(row).find("td").eq(5).text().trim();
                const wilayah = $(row).find("td").eq(6).text().trim();
                const potensi = $(row).find("td").eq(7).text().trim();

                // Parse coordinates
                const coordParts = coordinates.split(",");
                const lintang = coordParts[0]?.trim() || "";
                const bujur = coordParts[1]?.trim() || "";

                earthquakes.push({
                    tanggal,
                    jam,
                    datetime: `${tanggal} ${jam}`,
                    coordinates,
                    lintang,
                    bujur,
                    magnitude,
                    kedalaman,
                    wilayah,
                    potensi,
                });
            });

            resolve(earthquakes);
        } catch (error) {
            reject(error);
        }
    });

/**
 * Get earthquake with significant magnitude (M >= 5.0) from BMKG
 */
export const SignificantEarthquake = (): Promise<EarthquakeData> =>
    new Promise(async (resolve, reject) => {
        try {
            const { data } = await Axios.get(
                "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"
            );

            const gempa = data.Infogempa.gempa;

            resolve({
                tanggal: gempa.Tanggal,
                jam: gempa.Jam,
                datetime: gempa.DateTime,
                coordinates: `${gempa.Lintang}, ${gempa.Bujur}`,
                lintang: gempa.Lintang,
                bujur: gempa.Bujur,
                magnitude: gempa.Magnitude,
                kedalaman: gempa.Kedalaman,
                wilayah: gempa.Wilayah,
                potensi: gempa.Potensi,
                dirasakan: gempa.Dirasakan,
                shakemap: `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`,
            });
        } catch (error) {
            reject(error);
        }
    });
