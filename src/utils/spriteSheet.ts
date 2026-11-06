/**
 * 讀取 Aseprite 風格的連續圖 JSON（public/fx 與 public/characters 共用的格式），同一路徑只抓一次
 */

export interface SpriteSheetJson {
    frames: { frame: { x: number; y: number; w: number; h: number } }[];
    meta: { image: string; size: { w: number; h: number }; pixelfx?: { fps?: number; loop?: boolean } };
}

const cache = new Map<string, Promise<SpriteSheetJson | null>>();

/** @param src 不含副檔名的路徑，例如 /characters/warrior-idle；不存在或格式錯誤時回傳 null */
export function loadSpriteSheet(src: string): Promise<SpriteSheetJson | null> {
    let cached = cache.get(src);
    if (!cached) {
        cached = fetch(`${src}.json`)
            .then(r => (r.ok ? r.json() as Promise<SpriteSheetJson> : null))
            .then(json => (json && Array.isArray(json.frames) && json.frames.length > 0 ? json : null))
            .catch(() => null);
        cache.set(src, cached);
    }
    return cached;
}
