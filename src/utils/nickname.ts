/**
 * 玩家暱稱：存在瀏覽器裡，下次開啟沿用；沒有設定時給一個隨機名稱
 */

const STORAGE_KEY = 'webdota.nickname';
export const NICKNAME_MAX_LENGTH = 12;

const ADJECTIVES = ['勇敢的', '迅捷的', '沉默的', '閃耀的', '狂野的', '機敏的', '堅毅的', '神秘的'];
const NOUNS = ['旅人', '劍士', '遊俠', '術士', '獵人', '騎士', '行者', '守衛'];

export function normalizeNickname(name: string): string {
    return [...name.trim().replace(/\s+/g, ' ')].slice(0, NICKNAME_MAX_LENGTH).join('');
}

export function randomNickname(): string {
    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
    return `${pick(ADJECTIVES)}${pick(NOUNS)}`;
}

export function loadNickname(): string {
    try {
        const saved = normalizeNickname(localStorage.getItem(STORAGE_KEY) ?? '');
        if (saved) return saved;
    } catch {
        // 無痕模式或封鎖儲存時改用隨機名稱
    }
    return randomNickname();
}

export function saveNickname(name: string): void {
    try {
        localStorage.setItem(STORAGE_KEY, name);
    } catch {
        // 存不了就只在這次使用
    }
}

/** 顯示用名稱：有暱稱用暱稱，否則用 ID 前 6 碼 */
export function displayName(player: { id: string; name?: string }): string {
    return player.name || player.id.substring(0, 6);
}
