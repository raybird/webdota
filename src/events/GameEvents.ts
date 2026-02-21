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
    | SkillEffectEvent
    | GameOverEvent
    | PingUpdatedEvent

export type SkillEffectEvent = {
    type: 'SKILL_EFFECT'
    playerId: string
    skillId: string
    position: { x: number, y: number, z: number }
    direction: { x: number, y: number, z: number }
}

// 遊戲結束事件
export type GameOverEvent = {
    type: 'GAME_OVER'
    winnerTeam: 'red' | 'blue'
    reason: 'base_destroyed' | 'surrender' | 'timeout'
}

