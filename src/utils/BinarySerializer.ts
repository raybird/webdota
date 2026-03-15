/**
 * BinarySerializer.ts - 二進位序列化工具
 * 將遊戲數據規訓為緊湊的 ArrayBuffer，減少 P2P 頻寬消耗
 */

import { type PlayerInput } from '../core/NetworkManager';

export const PacketType = {
    INPUT: 1,
    PING: 2,
    PONG: 3,
    SYNC_FRAME: 4
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
}
