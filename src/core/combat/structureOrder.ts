/**
 * 建築依序攻擊（決策 D15，docs/gameplay-v2/features/f5-map-v2.md）
 *
 * 同一隊的建築有順序（外塔 1、內塔 2、前塔 3、主堡 4），前面還有沒破的建築時，後面的無敵。
 * 沒有設定順序的建築（舊地圖）不受保護，也不保護別人。
 */

export interface OrderedStructure<Id> {
    id: Id;
    team: string;
    order?: number;
    alive: boolean;
}

/** 目前受保護（打不動）的建築 */
export function shieldedStructures<Id>(structures: Iterable<OrderedStructure<Id>>): Set<Id> {
    const list = [...structures];
    const lowestAlive = new Map<string, number>();
    for (const s of list) {
        if (!s.alive || s.order === undefined) continue;
        lowestAlive.set(s.team, Math.min(lowestAlive.get(s.team) ?? Infinity, s.order));
    }
    const shielded = new Set<Id>();
    for (const s of list) {
        if (s.order === undefined) continue;
        const lowest = lowestAlive.get(s.team);
        if (lowest !== undefined && s.order > lowest) shielded.add(s.id);
    }
    return shielded;
}
