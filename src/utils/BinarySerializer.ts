/**
 * BinarySerializer.ts - 二進位序列化工具
 * 將遊戲數據規訓為緊湊的 ArrayBuffer，減少 P2P 頻寬消耗
 */

import { type PlayerInput, type GameState, type PlayerState } from '../core/NetworkManager';

export const PacketType = {
    INPUT: 1,
    PING: 2,
    PONG: 3,
    SYNC_FRAME: 4,
    GAME_STATE: 5
} as const;

export type PacketTypeName = typeof PacketType[keyof typeof PacketType];

export class BinarySerializer {
    /**
     * 序列化 PlayerInput
     * 格式: [Type(1), Frame(4), moveX(4), moveY(4), ActionFlag(1)] = 14 Bytes
     */
    static serializeInput(input: PlayerInput): ArrayBuffer {
        const buffer = new ArrayBuffer(14);
        const view = new DataView(buffer);
        
        view.setUint8(0, PacketType.INPUT);
        view.setUint32(1, input.frame);
        view.setFloat32(5, input.moveX);
        view.setFloat32(9, input.moveY);
        
        // 動作標記
        let actionFlag = 0;
        if (input.action === 'test_damage') actionFlag = 1;
        view.setUint8(13, actionFlag);
        
        return buffer;
    }

    /**
     * 反序列化 PlayerInput
     */
    static deserializeInput(buffer: ArrayBuffer, playerId: string): PlayerInput {
        const view = new DataView(buffer);
        const frame = view.getUint32(1);
        const moveX = view.getFloat32(5);
        const moveY = view.getFloat32(9);
        const actionFlag = view.getUint8(13);
        
        const input: PlayerInput = {
            frame,
            playerId,
            moveX,
            moveY
        };
        
        if (actionFlag === 1) input.action = 'test_damage';
        
        return input;
    }

    /**
     * 序列化 GameState
     * 格式: [Type(1), Frame(4), PlayerCount(1), ...Players]
     * 每位玩家: [ID_Len(1), ID(N), Pos(12), Rot(16), HP(4), Energy(4)]
     */
    static serializeGameState(state: GameState): ArrayBuffer {
        const encoder = new TextEncoder();
        let size = 6; // Type(1) + Frame(4) + Count(1)
        
        const encodedPlayers = state.players.map(p => {
            const idBytes = encoder.encode(p.id);
            size += 1 + idBytes.length + 12 + 16 + 4 + 4; // Len(1) + ID + Pos(12) + Rot(16) + Stats(8)
            return { p, idBytes };
        });

        const buffer = new ArrayBuffer(size);
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        
        view.setUint8(0, PacketType.GAME_STATE);
        view.setUint32(1, state.frame);
        view.setUint8(5, state.players.length);
        
        let offset = 6;
        for (const { p, idBytes } of encodedPlayers) {
            // ID
            view.setUint8(offset, idBytes.length);
            offset += 1;
            bytes.set(idBytes, offset);
            offset += idBytes.length;
            
            // Position
            view.setFloat32(offset, p.pos.x);
            view.setFloat32(offset + 4, p.pos.y);
            view.setFloat32(offset + 8, p.pos.z);
            offset += 12;
            
            // Rotation
            view.setFloat32(offset, p.rot.x);
            view.setFloat32(offset + 4, p.rot.y);
            view.setFloat32(offset + 8, p.rot.z);
            view.setFloat32(offset + 12, p.rot.w);
            offset += 16;
            
            // Stats
            view.setFloat32(offset, p.stats.hp);
            view.setFloat32(offset + 4, p.stats.energy);
            offset += 8;
        }
        
        return buffer;
    }

    /**
     * 反序列化 GameState
     */
    static deserializeGameState(buffer: ArrayBuffer): GameState {
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        const decoder = new TextDecoder();
        
        const frame = view.getUint32(1);
        const playerCount = view.getUint8(5);
        
        const players: PlayerState[] = [];
        let offset = 6;
        
        for (let i = 0; i < playerCount; i++) {
            const idLen = view.getUint8(offset);
            offset += 1;
            const id = decoder.decode(bytes.subarray(offset, offset + idLen));
            offset += idLen;
            
            const pos = {
                x: view.getFloat32(offset),
                y: view.getFloat32(offset + 4),
                z: view.getFloat32(offset + 8)
            };
            offset += 12;
            
            const rot = {
                x: view.getFloat32(offset),
                y: view.getFloat32(offset + 4),
                z: view.getFloat32(offset + 8),
                w: view.getFloat32(offset + 12)
            };
            offset += 16;
            
            const stats = {
                hp: view.getFloat32(offset),
                energy: view.getFloat32(offset + 4)
            };
            offset += 8;
            
            players.push({ id, pos, rot, stats });
        }
        
        return {
            frame,
            timestamp: Date.now(),
            players,
            isGameStarted: true // 進入 GameState 通常表示遊戲已開始
        };
    }

    /**
     * 序列化 SyncFrame
     */
    static serializeSyncFrame(frame: number): ArrayBuffer {
        const buffer = new ArrayBuffer(5);
        const view = new DataView(buffer);
        view.setUint8(0, PacketType.SYNC_FRAME);
        view.setUint32(1, frame);
        return buffer;
    }

    /**
     * 反序列化 SyncFrame
     */
    static deserializeSyncFrame(buffer: ArrayBuffer): number {
        const view = new DataView(buffer);
        return view.getUint32(1);
    }
}
