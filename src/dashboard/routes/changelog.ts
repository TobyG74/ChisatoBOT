import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";

export interface ChangelogEntry {
    type: string;
    message: string;
}

export interface ChangelogSection {
    date: string;
    entries: ChangelogEntry[];
}

function parseChangelog(): ChangelogSection[] {
    const filePath = path.join(process.cwd(), "CHANGELOG.md");
    if (!fs.existsSync(filePath)) return [];

    const content = fs.readFileSync(filePath, "utf-8");
    const result: ChangelogSection[] = [];
    let current: ChangelogSection | null = null;

    for (const raw of content.split("\n")) {
        const line = raw.trimEnd();

        const dateMatch = line.match(/^## (.+)$/);
        if (dateMatch) {
            if (current) result.push(current);
            current = { date: dateMatch[1].trim(), entries: [] };
            continue;
        }

        if (current && line.startsWith("- ")) {
            const text = line.slice(2).trim();
            const typeMatch = text.match(/^([a-z]+):\s+(.+)$/i);
            if (typeMatch) {
                current.entries.push({ type: typeMatch[1].toLowerCase(), message: typeMatch[2] });
            } else {
                current.entries.push({ type: "note", message: text });
            }
        }
    }

    if (current) result.push(current);
    return result;
}

export async function changelogRoutes(fastify: FastifyInstance) {
    fastify.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
            const changelog = parseChangelog();
            return reply.send({ success: true, changelog });
        } catch {
            return reply.status(500).send({ success: false, message: "Failed to load changelog" });
        }
    });
}
