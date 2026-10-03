import { z } from "zod";

/** Inbound boundary: the subset of a Telegram Bot API `Update` this app reads. Unknown fields are dropped. */
export const telegramUpdateSchema = z.object({
    update_id: z.number(),
    message: z.object({
        text: z.string().optional(),
        chat: z.object({
            id: z.number(),
            /** "private" | "group" | "supergroup" | "channel" */
            type: z.string().optional(),
        }),
        from: z.object({
            id: z.number(),
            username: z.string().optional(),
        }).optional(),
    }).optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
export type TelegramUser = NonNullable<NonNullable<TelegramUpdate["message"]>["from"]>;
