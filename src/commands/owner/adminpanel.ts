import type { ConfigCommands } from "../../types/structure/commands";
import bcrypt from "bcrypt";
import { Database } from "../../infrastructure/database";

const SALT_ROUNDS = 10;

// Store session state for each user
export const adminPanelSessions = new Map<string, {
    action: string;
    step: number;
    data: {
        phoneNumber?: string;
        username?: string;
        password?: string;
    };
    timestamp: number;
}>();

const sessions = adminPanelSessions;

// Clean up old sessions (older than 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, session] of sessions.entries()) {
        if (now - session.timestamp > 5 * 60 * 1000) {
            sessions.delete(key);
        }
    }
}, 60000);

export default {
    name: "adminpanel",
    alias: ["dashboardadmin"],
    category: "owner",
    description: "Interactive admin account management for dashboard",
    usage: "",
    isOwner: true,
    isPrivate: true,
    async run({ Chisato, message, args, from, sender }) {
        const msg = message;
        const userId = sender;

        const session = sessions.get(userId);

        if (!session && args.length === 0) {
            await Chisato.sendMessage(from, {
                text: `🔐 *Dashboard Admin Management*\n\n` +
                    `Please choose an action:\n\n` +
                    `1️⃣ Create new admin account\n` +
                    `2️⃣ Reset admin password\n` +
                    `3️⃣ Delete admin account\n` +
                    `4️⃣ List all admin accounts\n` +
                    `5️⃣ Cancel\n\n` +
                    `Reply with the number (1-5)`,
            }, { quoted: msg });
            return;
        }

        if (!session && args.length > 0) {
            const choice = args[0];
            
            switch (choice) {
                case "1": {
                    const phoneNumber = userId.split("@")[0];
                    const existingByPhone = await Database.admin.findFirst({
                        where: { phoneNumber },
                    });

                    if (existingByPhone) {
                        await Chisato.sendMessage(from, {
                            text: `❌ *Phone Number Already Registered!*\n\n` +
                                `Your phone number (${phoneNumber}) is already registered as admin.\n\n` +
                                `If you need to reset the password, please select option 2.`,
                        }, { quoted: msg });
                        return;
                    }
                    
                    sessions.set(userId, {
                        action: "create",
                        step: 2,
                        data: {
                            phoneNumber: phoneNumber, 
                        },
                        timestamp: Date.now(),
                    });
                    await Chisato.sendMessage(from, {
                        text: `📱 *Phone Number Auto-Detected:* ${phoneNumber}\n\n` +
                            `👤 *Create Admin Account - Step 1/2*\n\n` +
                            `Please enter the username:\n\n` +
                            `Requirements:\n` +
                            `• 3-20 characters\n` +
                            `• Only letters, numbers, and underscore\n` +
                            `• No spaces or special characters\n\n` +
                            `Reply "cancel" to abort.`,
                    }, { quoted: msg });
                    break;
                }
                case "2": {
                    sessions.set(userId, {
                        action: "reset",
                        step: 1,
                        data: {},
                        timestamp: Date.now(),
                    });
                    await Chisato.sendMessage(from, {
                        text: `🔄 *Reset Admin Password - Step 1/2*\n\n` +
                            `Please enter the username to reset:\n\n` +
                            `Reply "cancel" to abort.`,
                    }, { quoted: msg });
                    break;
                }
                case "3": {
                    sessions.set(userId, {
                        action: "delete",
                        step: 1,
                        data: {},
                        timestamp: Date.now(),
                    });
                    await Chisato.sendMessage(from, {
                        text: `🗑️ *Delete Admin Account*\n\n` +
                            `Please enter the username to delete:\n\n` +
                            `Reply "cancel" to abort.`,
                    }, { quoted: msg });
                    break;
                }
                case "4": {
                    try {
                        const admins = await Database.admin.findMany({
                            select: {
                                phoneNumber: true,
                                username: true,
                                createdAt: true,
                            },
                            orderBy: {
                                createdAt: "asc",
                            },
                        });

                        if (admins.length === 0) {
                            await Chisato.sendMessage(from, {
                                text: `❌ *No Admin Accounts Found!*\n\n` +
                                    `Create your first admin account by selecting option 1.`,
                            }, { quoted: msg });
                            return;
                        }

                        const adminList = admins.map((admin, index) => {
                            const date = new Date(admin.createdAt);
                            return `${index + 1}. *${admin.username}*\n   📱 ${admin.phoneNumber}\n   📅 ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                        }).join("\n\n");

                        await Chisato.sendMessage(from, {
                            text: `📋 *Dashboard Admin Accounts*\n\n` +
                                `Total: ${admins.length} admin(s)\n\n` +
                                `${adminList}`,
                        }, { quoted: msg });
                    } catch (error) {
                        console.error("List admin error:", error);
                        await Chisato.sendMessage(from, {
                            text: `❌ Error listing admin accounts: ${error instanceof Error ? error.message : String(error)}`,
                        }, { quoted: msg });
                    }
                    break;
                }
                case "5":
                case "cancel": {
                    await Chisato.sendMessage(from, {
                        text: `❌ Operation cancelled.`,
                    }, { quoted: msg });
                    break;
                }
                default: {
                    await Chisato.sendMessage(from, {
                        text: `❌ Invalid choice! Please reply with 1, 2, 3, 4, or 5.`,
                    }, { quoted: msg });
                    break;
                }
            }
            return;
        }

        if (session) {
            const input = args.join(" ").trim();

            if (input.toLowerCase() === "cancel") {
                sessions.delete(userId);
                await Chisato.sendMessage(from, {
                    text: `❌ Operation cancelled.`,
                }, { quoted: msg });
                return;
            }

            session.timestamp = Date.now();

            try {
                if (session.action === "create") {
                    await handleCreateSession(Chisato, msg, from, userId, session, input);
                } else if (session.action === "reset") {
                    await handleResetSession(Chisato, msg, from, userId, session, input);
                } else if (session.action === "delete") {
                    await handleDeleteSession(Chisato, msg, from, userId, session, input);
                }
            } catch (error) {
                console.error("Session error:", error);
                sessions.delete(userId);
                await Chisato.sendMessage(from, {
                    text: `❌ An error occurred: ${error instanceof Error ? error.message : String(error)}\n\nSession cancelled.`,
                }, { quoted: msg });
            }
        }
    },
} satisfies ConfigCommands;

// Handler for create admin session
async function handleCreateSession(Chisato: any, msg: any, from: string, userId: string, session: any, input: string) {
    if (session.step === 2) {
        if (!input.match(/^[a-zA-Z0-9_]{3,20}$/)) {
            await Chisato.sendMessage(from, {
                text: `❌ Invalid username format!\n\n` +
                    `Username must be:\n` +
                    `• 3-20 characters\n` +
                    `• Only letters, numbers, and underscore\n` +
                    `• No spaces or special characters\n\n` +
                    `Please try again or reply "cancel" to abort.`,
            }, { quoted: msg });
            return;
        }

        const existingByUsername = await Database.admin.findFirst({
            where: { username: input },
        });

        if (existingByUsername) {
            await Chisato.sendMessage(from, {
                text: `❌ This username is already taken!\n\n` +
                    `Please choose a different username or reply "cancel" to abort.`,
            }, { quoted: msg });
            return;
        }

        session.data.username = input;
        session.step = 3;
        sessions.set(userId, session);

        await Chisato.sendMessage(from, {
            text: `✅ Username saved: ${input}\n\n` +
                `🔐 *Create Admin Account - Step 2/2*\n\n` +
                `Please enter the password:\n\n` +
                `Requirements:\n` +
                `• Minimum 6 characters\n` +
                `• Can contain letters, numbers, and symbols\n\n` +
                `⚠️ *Important:* This password will be shown only once!\n\n` +
                `Reply "cancel" to abort.`,
        }, { quoted: msg });
    } else if (session.step === 3) {
        if (input.length < 6) {
            await Chisato.sendMessage(from, {
                text: `❌ Password too short!\n\n` +
                    `Password must be at least 6 characters long.\n\n` +
                    `Please try again or reply "cancel" to abort.`,
            }, { quoted: msg });
            return;
        }

        session.data.password = input;

        const hashedPassword = await bcrypt.hash(input, SALT_ROUNDS);

        await Database.admin.create({
            data: {
                phoneNumber: session.data.phoneNumber!,
                username: session.data.username!,
                password: hashedPassword,
            },
        });

        sessions.delete(userId);

        await Chisato.sendMessage(from, {
            text: `✅ *Admin Account Created Successfully!*\n\n` +
                `📱 Phone Number: ${session.data.phoneNumber}\n` +
                `👤 Username: ${session.data.username}\n` +
                `🔐 Password: ${input}\n\n` +
                `⚠️ *IMPORTANT: Save these credentials now!*\n` +
                `The password is shown only this once and cannot be retrieved later.\n\n` +
                `🌐 Login URL:\n` +
                `http://localhost:${process.env.DASHBOARD_PORT || 3000}/login.html`,
        }, { quoted: msg });
    }
}

// Handler for reset password session
async function handleResetSession(Chisato: any, msg: any, from: string, userId: string, session: any, input: string) {
    if (session.step === 1) {
        const admin = await Database.admin.findUnique({
            where: { username: input },
        });

        if (!admin) {
            await Chisato.sendMessage(from, {
                text: `❌ Admin account not found!\n\n` +
                    `No account with username "${input}" exists.\n\n` +
                    `Please try again or reply "cancel" to abort.`,
            }, { quoted: msg });
            return;
        }

        session.data.username = input;
        session.step = 2;
        sessions.set(userId, session);

        await Chisato.sendMessage(from, {
            text: `✅ Username found: ${input}\n\n` +
                `🔐 *Reset Password - Step 2/2*\n\n` +
                `Please enter the new password:\n\n` +
                `Requirements:\n` +
                `• Minimum 6 characters\n` +
                `• Can contain letters, numbers, and symbols\n\n` +
                `⚠️ *Important:* This password will be shown only once!\n\n` +
                `Reply "cancel" to abort.`,
        }, { quoted: msg });
    } else if (session.step === 2) {
        if (input.length < 6) {
            await Chisato.sendMessage(from, {
                text: `❌ Password too short!\n\n` +
                    `Password must be at least 6 characters long.\n\n` +
                    `Please try again or reply "cancel" to abort.`,
            }, { quoted: msg });
            return;
        }

        const hashedPassword = await bcrypt.hash(input, SALT_ROUNDS);

        await Database.admin.update({
            where: { username: session.data.username! },
            data: { password: hashedPassword },
        });

        sessions.delete(userId);

        await Chisato.sendMessage(from, {
            text: `✅ *Password Reset Successfully!*\n\n` +
                `👤 Username: ${session.data.username}\n` +
                `🔐 New Password: ${input}\n\n` +
                `⚠️ *IMPORTANT: Save this password now!*\n` +
                `The password is shown only this once and cannot be retrieved later.`,
        }, { quoted: msg });
    }
}

// Handler for delete admin session
async function handleDeleteSession(Chisato: any, msg: any, from: string, userId: string, session: any, input: string) {
    const admin = await Database.admin.findUnique({
        where: { username: input },
    });

    if (!admin) {
        await Chisato.sendMessage(from, {
            text: `❌ Admin account not found!\n\n` +
                `No account with username "${input}" exists.\n\n` +
                `Please try again or reply "cancel" to abort.`,
        }, { quoted: msg });
        return;
    }

    await Database.admin.delete({
        where: { username: input },
    });

    sessions.delete(userId);

    await Chisato.sendMessage(from, {
        text: `✅ *Admin Account Deleted Successfully!*\n\n` +
            `👤 Username: ${input}\n` +
            `📱 Phone Number: ${admin.phoneNumber}\n\n` +
            `The admin account has been permanently removed from the database.`,
    }, { quoted: msg });
}
