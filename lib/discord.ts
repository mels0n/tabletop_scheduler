import Logger from "@/lib/logger";

const log = Logger.get("Discord");

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
    const body: any = typeof content === 'string' ? { content } : content;

    try {
        const res = await fetch(url, {
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
    const body: any = typeof content === 'string' ? { content } : content;

    try {
        const res = await fetch(url, {
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
        const res = await fetch(url, {
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
        const res = await fetch(url, {
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
 * Fetches text channels for a specific Guild (Server).
 * Used for the "Channel Picker" in the UI.
 * @param guildId The Discord Guild ID.
 * @param token The Bot Token.
 */
export async function getGuildChannels(guildId: string, token: string): Promise<{ id: string, name: string }[]> {
    const url = `https://discord.com/api/v10/guilds/${guildId}/channels`;

    try {
        const res = await fetch(url, {
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
        const res = await fetch(url, {
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
