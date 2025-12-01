/**
 * Process template variables in text
 * Supports: {prefix}, {command.name}, {command.alias}, {botName}, {pushName}
 * Also supports dynamic context variables like {status}, {emoji}
 */
export function processTemplate(
    text: string,
    variables: {
        prefix?: string;
        command?: { name: string; alias?: string[] };
        botName?: string;
        pushName?: string;
        context?: any;
        [key: string]: any;
    }
): string {
    let processed = text;

    // Replace {prefix}
    if (variables.prefix) {
        processed = processed.replace(/{prefix}/g, variables.prefix);
    }

    // Replace {command.name}
    if (variables.command?.name) {
        processed = processed.replace(/{command\.name}/g, variables.command.name);
    }

    // Replace {command.alias}
    if (variables.command?.alias && variables.command.alias.length > 0) {
        processed = processed.replace(/{command\.alias}/g, variables.command.alias[0]);
    }

    // Replace {botName}
    if (variables.botName) {
        processed = processed.replace(/{botName}/g, variables.botName);
    }

    // Replace {pushName}
    if (variables.pushName) {
        processed = processed.replace(/{pushName}/g, variables.pushName);
    }

    // Replace any other custom variables
    Object.keys(variables).forEach(key => {
        if (!['prefix', 'command', 'botName', 'pushName', 'context'].includes(key)) {
            const regex = new RegExp(`{${key}}`, 'g');
            processed = processed.replace(regex, String(variables[key] || ''));
        }
    });

    return processed;
}

/**
 * Format example text with proper template variables
 */
export function formatExample(
    example: string,
    variables: {
        prefix?: string;
        command?: { name: string; alias?: string[] };
        botName?: string;
        pushName?: string;
        context?: any;
        [key: string]: any;
    }
): string {
    return processTemplate(example, variables);
}
