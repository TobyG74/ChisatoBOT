import type { WASocket } from "baileys";

declare type ChisatoMediaUpload = string | Buffer | Readable;

declare type Chisato = Partial<Omit<WASocket, 'logger'>>;
