/**
 * 對戰地圖
 *
 * 預設 arena_v2；網址加 ?map=demo_arena 可換回舊的測試圖（Host 與 Client 要用同一張）。
 */

import type { MapConfig } from '../../core/map';
import arenaV2 from './arena_v2.json';
import demoArena from './demo_arena.json';

const MAPS: Record<string, MapConfig> = {
    arena_v2: arenaV2 as unknown as MapConfig,
    demo_arena: demoArena as unknown as MapConfig,
};

export const DEFAULT_MAP_ID = 'arena_v2';

export function selectMap(search: string = typeof location !== 'undefined' ? location.search : ''): MapConfig {
    const requested = new URLSearchParams(search).get('map');
    return MAPS[requested ?? ''] ?? MAPS[DEFAULT_MAP_ID]!;
}
