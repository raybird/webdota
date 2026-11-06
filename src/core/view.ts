/**
 * view.ts - 斜角 2.5D 鏡頭的視角（依本地玩家隊伍決定）
 *
 * 與一般 MOBA 相同，每位玩家都看到自家主堡在畫面左下、敵方主堡在右上：
 * 主堡在 (-22,-22)（藍）與 (22,22)（紅），藍方鏡頭繞 y 軸轉 -90°，紅方轉 +90°（整個畫面轉 180°），
 * 牆面正對鏡頭，只看得到頂面與正面。俯角 36.87°（3:4:5），像素密度剛好是整數比：
 * 水平每單位 19px、地面縱深每單位 11.4px（5 單位 57px）、垂直面每單位 15.2px（5 單位 76px），
 * public/env 的貼圖照這個比例畫，與螢幕像素 1:1 對齊。
 * 玩家輸入是畫面方向（W = 畫面上方），送出前用 screenToWorld 轉成世界方向，
 * 所以兩隊鏡頭不同，Host 與 Client 套用移動時也不需要知道對方的鏡頭。
 */

import type { Team } from './ecs/components/TeamComponent';

/** 俯角：鏡頭高度與水平距離的比例 3 : 4（36.87°） */
const PITCH_RISE = 30;
const PITCH_RUN = 40;
/** sin／cos(俯角)：地面縱深與垂直面高度在畫面上的縮放 */
export const PITCH_SIN = 0.6;
export const PITCH_COS = 0.8;

const YAW_OF_TEAM: Partial<Record<Team, number>> = { blue: -90, red: 90 };

let team: Team = 'blue';
let yawDeg = -90;
let cos = 0;
let sin = -1;

/** 遊戲開始時依本地玩家隊伍設定視角；觀戰或沒有隊伍時用藍方視角 */
export function setViewTeam(t: Team | null | undefined): void {
    team = t === 'red' ? 'red' : 'blue';
    yawDeg = YAW_OF_TEAM[team] ?? -90;
    const yaw = (yawDeg * Math.PI) / 180;
    // 四捨五入避免 cos(90°) 這類浮點殘差讓鏡頭有極小的斜度
    cos = Math.round(Math.cos(yaw) * 1e9) / 1e9;
    sin = Math.round(Math.sin(yaw) * 1e9) / 1e9;
}

/** 繞 y 軸旋轉 xz 平面上的向量（與 PlayCanvas 的 y 軸旋轉同向） */
function rotate(x: number, z: number): { x: number; z: number } {
    return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

/** 鏡頭繞 y 軸的角度（度）；小地圖以 CSS rotate 同角度旋轉即可與畫面同向 */
export function viewYawDeg(): number {
    return yawDeg;
}

/** 從注視點指向鏡頭的方向（未正規化） */
export function viewOffset(): { x: number; y: number; z: number } {
    const h = rotate(0, PITCH_RUN);
    return { x: h.x, y: PITCH_RISE, z: h.z };
}

/** 畫面方向（x 右、y 上）轉成地面上的世界方向 */
export function screenToWorld(x: number, y: number): { x: number; z: number } {
    return rotate(x, -y);
}

/** 目前視角所屬的隊伍（觀戰或沒有隊伍時為藍方） */
export function viewTeam(): Team {
    return team;
}

/** 畫面右方在地面上的世界方向 */
export function screenRight(): { x: number; z: number } {
    return rotate(1, 0);
}

/** 畫面下方（朝向鏡頭）在地面上的世界方向 */
export function screenDown(): { x: number; z: number } {
    return rotate(0, 1);
}
