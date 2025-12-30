
export interface TelegramUpdate {
    update_id: number;
    message?: {
        text?: string;
        chat: {
            id: number;
        };
        from?: {
            id: number;
            username?: string;
        };
    };
}
