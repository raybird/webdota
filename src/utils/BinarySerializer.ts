/**
 * BinarySerializer.ts - 二進位序列化工具
 * 將遊戲數據規訓為緊湊的 ArrayBuffer，減少 P2P 頻寬消耗
 */

import type { PlayerInput, GameState, PlayerState } from '../core/NetworkManager';

export const PacketType = {
    INPUT: 1,
    GAME_STATE: 5
} as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class BinarySerializer {
    /**
     * 序列化 PlayerInput
     * 格式: [Type(1), Frame(4), moveX(4), moveY(4), dirX(4), dirZ(4), SkillLen(1), SkillId(N)]
     * 沒有使用技能時 SkillLen 為 0，總長 22 Bytes
     */
    static serializeInput(input: PlayerInput): ArrayBuffer {
        const skillBytes = input.skillUsed ? encoder.encode(input.skillUsed) : new Uint8Array(0);
        const buffer = new ArrayBuffer(22 + skillBytes.length);
        const view = new DataView(buffer);

        view.setUint8(0, PacketType.INPUT);
        view.setUint32(1, input.frame);
        view.setFloat32(5, input.moveX);
        view.setFloat32(9, input.moveY);
        view.setFloat32(13, input.skillDirection?.x ?? 0);
        view.setFloat32(17, input.skillDirection?.z ?? 0);
        view.setUint8(21, skillBytes.length);
        new Uint8Array(buffer).set(skillBytes, 22);

        return buffer;
    }

    /**
     * 反序列化 PlayerInput
     */
    static deserializeInput(buffer: ArrayBuffer, playerId: string): PlayerInput {
        const view = new DataView(buffer);
        const input: PlayerInput = {
            frame: view.getUint32(1),
            playerId,
            moveX: view.getFloat32(5),
            moveY: view.getFloat32(9)
        };

        const skillLen = view.getUint8(21);
        if (skillLen > 0) {
            input.skillUsed = decoder.decode(new Uint8Array(buffer, 22, skillLen));
            input.skillDirection = { x: view.getFloat32(13), z: view.getFloat32(17) };
        }

        return input;
    }

    /**
     * 序列化 GameState
     * 格式: [Type(1), Frame(4), PlayerCount(1), ...Players]
     * 每位玩家: [ID_Len(1), ID(N), Pos(12), Rot(16), HP(4), Energy(4)]
     */
    static serializeGameState(state: GameState): ArrayBuffer {
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
}
