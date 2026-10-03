import Logger from "@/shared/lib/logger";
import { reliableFetch } from "@/shared/lib/fetch";

const log = Logger.get("Discord");

/**
 * Builds a message body that cannot ping anyone. Event titles, locations and
 * participant names are user-controlled, so a name like "@everyone" would
 * otherwise notify the whole server.
 */
function withoutMentions(content: string | any): any {
    const body = typeof content === 'string' ? { content } : { ...content };
    return { allowed_mentions: { parse: [] }, ...body };
}

/**
 * Sends a message to a Discord channel.
 * @param channelId The Discord Channel ID.
 * @param content The text content (or embed object).
 * @param token The Bot Token.
 */
export async function sendDiscordMessage(channelId: string, content: string | any, token: string): Promise<{ id?: string; error?: any }> {
    if (!token) {
        log.error("Token is missing");
        return { error: "Token missing" };
    }

    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const body: any = withoutMentions(content);

    try {
        const res = await reliableFetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errText = await res.text();
            let errJson;
            try { errJson = JSON.parse(errText); } catch { errJson = { message: errText }; }

            log.error("API Error (sendMessage)", { error: errText });
            return { error: errJson };
        }

        const data = await res.json();
        return { id: data.id };
    } catch (e) {
        log.error("Failed to send message", e as Error);
        // Intent: Return a generic error structure if network catch fails
        return { error: { message: (e as Error).message } };
    }
}

/**
 * Edits an existing Discord message.
 * @param channelId The Discord Channel ID.
 * @param messageId The Message ID to edit.
 * @param content The new text content (or embed object).
 * @param token The Bot Token.
 */
export async function editDiscordMessage(channelId: string, messageId: string, content: string | any, token: string): Promise<boolean> {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;
    const body: any = withoutMentions(content);

    try {
        const res = await reliableFetch(url, {
            method: 'PATCH', // PATCH for edit
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.text();
            log.error("API Error (editMessage)", { error: err });
            return false;
        }

        return true;
    } catch (e) {
        log.error("Failed to edit message", e as Error);
        return false;
    }
}

/**
 * Pins a message in a Discord channel.
 * @param channelId The Discord Channel ID.
 * @param messageId The Message ID to pin.
 * @param token The Bot Token.
 */
export async function pinDiscordMessage(channelId: string, messageId: string, token: string): Promise<boolean> {
    const url = `https://discord.com/api/v10/channels/${channelId}/pins/${messageId}`;

    try {
        const res = await reliableFetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${token}`,
            }
        });

        if (!res.ok) {
            const err = await res.text();
            log.error("API Error (pinMessage)", { error: err });
            return false;
        }

        return true;
    } catch (e) {
        log.error("Failed to pin message", e as Error);
        return false;
    }
}

/**
 * Unpins a message in a Discord channel.
 * @param channelId The Discord Channel ID.
 * @param messageId The Message ID to unpin.
 * @param token The Bot Token.
 */
export async function unpinDiscordMessage(channelId: string, messageId: string, token: string): Promise<boolean> {
    const url = `https://discord.com/api/v10/channels/${channelId}/pins/${messageId}`;

    try {
        const res = await reliableFetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bot ${token}`,
            }
        });

        if (!res.ok) {
            const err = await res.text();
            log.error("API Error (unpinMessage)", { error: err });
            return false;
        }

        return true;
    } catch (e) {
        log.error("Failed to unpin message", e as Error);
        return false;
    }
}

/**
 * Deletes a message the bot posted in a Discord channel.
 * @param channelId The Discord Channel ID.
 * @param messageId The Message ID to delete.
 * @param token The Bot Token.
 */
export async function deleteDiscordMessage(channelId: string, messageId: string, token: string): Promise<boolean> {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;

    try {
        const res = await reliableFetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bot ${token}`,
            }
        });

        if (!res.ok) {
            const err = await res.text();
            log.warn("API Error (deleteMessage)", { error: err });
            return false;
        }

        return true;
    } catch (e) {
        log.error("Failed to delete message", e as Error);
        return false;
    }
}

/**
 * Sends a direct message to a Discord user (opens the DM channel first).
 * Fails when the user shares no server with the bot or has DMs disabled.
 * @param userId The Discord User ID.
 * @param content The text content.
 * @param token The Bot Token.
 */
export async function sendDiscordDM(userId: string, content: string | any, token: string): Promise<{ id?: string; error?: any }> {
    const dm = await createDMChannel(userId, token);
    if (!dm.id) {
        return { error: dm.error ?? { message: "Could not open DM channel" } };
    }
    return sendDiscordMessage(dm.id, content, token);
}

/**
 * Fetches text channels for a specific Guild (Server).
 * Used for the "Channel Picker" in the UI.
 * @param guildId The Discord Guild ID.
 * @param token The Bot Token.
 */
export async function getGuildChannels(guildId: string, token: string): Promise<{ id: string, name: string }[]> {
    const url = `https://discord.com/api/v10/guilds/${guildId}/channels`;

    try {
        const res = await reliableFetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${token}`,
            }
        });

        if (!res.ok) {
            const err = await res.text();
            log.error("API Error (getChannels)", { error: err });
            return [];
        }

        const channels = await res.json();
        // Filter for Text Channels (Type 0) and Announcement Channels (Type 5)
        return channels
            .filter((c: any) => c.type === 0 || c.type === 5)
            .map((c: any) => ({ id: c.id, name: c.name }));

    } catch (e) {
        log.error("Failed to fetch channels", e as Error);
        return [];
    }
}

/**
 * Creates a DM channel with a specific user.
 * @param userId The Discord User ID.
 * @param token The Bot Token.
 */
export async function createDMChannel(userId: string, token: string): Promise<{ id?: string, error?: any }> {
    const url = `https://discord.com/api/v10/users/@me/channels`;

    try {
        const res = await reliableFetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: userId })
        });

        if (!res.ok) {
            const err = await res.text();
            let errJson;
            try { errJson = JSON.parse(err); } catch { errJson = { message: err }; }

            log.error("API Error (createDM)", { error: err });
            return { error: errJson };
        }

        const data = await res.json();
        return { id: data.id };
    } catch (e) {
        log.error("Failed to create DM channel", e as Error);
        return { error: { message: (e as Error).message } };
    }
}

/**
 * Fetches Public User Details from Discord.
 * @param userId The Discord User ID.
 * @param token The Bot Token.
 */
export async function getDiscordUser(userId: string, token: string): Promise<{ id: string, username: string, discriminator: string } | null> {
    const url = `https://discord.com/api/v10/users/${userId}`;

    try {
        const res = await reliableFetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${token}`,
            }
        });

        if (!res.ok) {
            log.error("API Error (getUser)", { status: res.status });
            return null;
        }

        return await res.json();
    } catch (e) {
        log.error("Failed to fetch user", e as Error);
        return null;
    }
}
