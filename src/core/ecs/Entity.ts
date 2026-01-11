/**
 * Entity.ts - ECS 實體定義
 * Entity 只是一個唯一 ID，不包含任何資料或邏輯
 */

export type EntityId = string;

/**
 * 建立新的 Entity ID
 */
export function createEntityId(): EntityId {
    return crypto.randomUUID();
}

/**
 * 驗證 EntityId 是否有效
 */
export function isValidEntityId(id: unknown): id is EntityId {
    return typeof id === 'string' && id.length > 0;
}
