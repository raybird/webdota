/**
 * 遊戲事件類型定義
 */

// 網路事件
export type PlayerJoinedEvent = {
    type: 'PLAYER_JOINED'
    playerId: string
}

export type PlayerLeftEvent = {
    type: 'PLAYER_LEFT'
    playerId: string
}

export type PingUpdatedEvent = {
    type: 'PING_UPDATED'
    peerId: string
    ping: number
}

export type PlayerReadyEvent = {
    type: 'PLAYER_READY'
    playerId: string
    isReady: boolean
}

export type CharacterSelectedEvent = {
    type: 'CHARACTER_SELECTED'
    playerId: string
    characterId: string
}

// 遊戲事件
export type GameStartedEvent = {
    type: 'GAME_STARTED'
}

export type GameEndedEvent = {
    type: 'GAME_ENDED'
}

export type GamePausedEvent = {
    type: 'GAME_PAUSED'
}

export type GameResumedEvent = {
    type: 'GAME_RESUMED'
}

// 房間事件
export type RoomCreatedEvent = {
    type: 'ROOM_CREATED'
    roomId: string
}

export type RoomJoinedEvent = {
    type: 'ROOM_JOINED'
    roomId: string
}

export type RoomLeftEvent = {
    type: 'ROOM_LEFT'
}

export type CountdownStartedEvent = {
    type: 'COUNTDOWN_STARTED'
    seconds: number
}

// 技能事件
export type SkillUsedEvent = {
    type: 'SKILL_USED'
    playerId: string
    skillId: string
}

// 戰鬥事件
export type PlayerDamagedEvent = {
    type: 'PLAYER_DAMAGED'
    playerId: string
    damage: number
    sourceId: string
}

export type PlayerHealedEvent = {
    type: 'PLAYER_HEALED'
    playerId: string
    amount: number
}

export type EntityTookDamageEvent = {
    type: 'ENTITY_TOOK_DAMAGE'
    targetId: string
    damage: number
    isCrit: boolean
}

/** 英雄明顯回血（RegenFeedback 依血量變化發出，Host 與 Client 都會發）；label 為頭上的提示文字 */
export type EntityHealedEvent = {
    type: 'ENTITY_HEALED'
    targetId: string
    amount: number
    label?: string
}

/** 英雄升級（Host 加經驗、Client 套用同步的經驗時都會發） */
export type PlayerLevelUpEvent = {
    type: 'PLAYER_LEVEL_UP'
    playerId: string
    entityId: string
    level: number
}

/** 本地玩家靠近受保護的敵方建築（依序攻擊），頭上顯示提示；只在本機發出 */
export type StructureShieldedEvent = {
    type: 'STRUCTURE_SHIELDED'
    targetId: string
    label: string
}

/** 防禦塔（含主堡）發射光彈；傷害在 flightTime 秒後光彈命中時才結算（Host 發出，GameEngine 轉播給 Client） */
export type TowerAttackEvent = {
    type: 'TOWER_ATTACK'
    attackerId: string
    targetId: string
    flightTime: number
    /** 命中時的傷害（轉播給 Client 記錄，Host 遷移時新 Host 接手結算） */
    damage: number
}

export type EntityDiedEvent = {
    type: 'ENTITY_DIED'
    entityId: string
    killerId: string | null
}

export type PlayerRespawnedEvent = {
    type: 'PLAYER_RESPAWNED'
    entityId: string
}

// 聯合類型
export type GameEvent =
    | PlayerJoinedEvent
    | PlayerLeftEvent
    | PlayerReadyEvent
    | CharacterSelectedEvent
    | GameStartedEvent
    | GameEndedEvent
    | GamePausedEvent
    | GameResumedEvent
    | RoomCreatedEvent
    | RoomJoinedEvent
    | RoomLeftEvent
    | CountdownStartedEvent
    | SkillUsedEvent
    | PlayerDamagedEvent
    | PlayerHealedEvent
    | EntityTookDamageEvent
    | EntityHealedEvent
    | StructureShieldedEvent
    | PlayerLevelUpEvent
    | TowerAttackEvent
    | EntityDiedEvent
    | PlayerRespawnedEvent
    | GameOverEvent
    | PingUpdatedEvent

// 遊戲結束事件
export type GameOverEvent = {
    type: 'GAME_OVER'
    winnerTeam: 'red' | 'blue'
    reason: 'base_destroyed' | 'surrender' | 'timeout'
}

