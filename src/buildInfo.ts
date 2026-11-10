/**
 * 建置版本：正式建置是 commit 編號前 12 碼，開發伺服器是 'dev'（見 vite.config.ts 的 __BUILD_ID__）
 * 加入房間時與房主比對，不同就請玩家重新整理（決策 D16）
 */

declare const __BUILD_ID__: string | undefined;

export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
