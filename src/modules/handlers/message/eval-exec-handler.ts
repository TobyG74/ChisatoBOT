import { MessageSerialize } from "../../../types/structure/serialize";
import { logger } from "../../../core/logger/logger.service";
import util from "util";
import { exec } from "child_process";

export class EvalExecHandler {
    static async handle(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize
    ): Promise<boolean> {
        // Handle eval
        if (context.body && context.body.startsWith(">> ") && context.isTeam) {
            await this.handleEval(Chisato, context, message);
            return true;
        }

        // Handle exec
        if (context.body && context.body.startsWith("$ ") && context.isTeam) {
            await this.handleExec(Chisato, context, message);
            return true;
        }

        return false;
    }

    private static async handleEval(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize
    ): Promise<void> {
        const code = context.arg;

        try {
            const result = await eval("(async() => {" + code + "})()");
            await Chisato.sendText(
                context.from,
                util.inspect(result, false),
                message
            );
            logger.eval(code.replace(/\n/g, " ").slice(0, 50));
        } catch (error) {
            await Chisato.sendText(
                context.from,
                util.inspect(error, true),
                message
            );
            logger.error(
                `Eval error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    private static async handleExec(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize
    ): Promise<void> {
        const command = context.arg;

        try {
            const result = await new Promise<string>((resolve, reject) => {
                exec(command, { windowsHide: true }, (err, stdout, stderr) => {
                    if (err) return reject(err);
                    if (stderr) return reject(stderr);
                    resolve(stdout);
                });
            });

            await Chisato.sendText(
                context.from,
                util.inspect(result, true),
                message
            );
            logger.exec(command.replace(/\n/g, " ").slice(0, 50));
        } catch (error) {
            await Chisato.sendText(
                context.from,
                util.inspect(error, true),
                message
            );
            logger.error(
                `Exec error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
