/**
 * 地圖數據類型定義
 * Map Data Types for Programmatic Block Building System
 */

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface MapConfig {
    id: string;          // 地圖唯一 ID (e.g., "arena_01")
    name: string;        // 顯示名稱
    size: { w: number; h: number }; // 地圖邊界尺寸

    // 環境設定
    environment: {
        skyColor: [number, number, number]; // RGB (0-1)
        ambientIntensity: number;
        groundColor: [number, number, number];
    };

    // 材質定義 (用於複用)
    materials: Record<string, MaterialConfig>;

    // 積木列表 (地圖上的靜態物體)
    blocks: MapBlock[];

    // 邏輯實體 (出生點、野怪等)
    entities: MapEntity[];
}

export interface MaterialConfig {
    color: [number, number, number]; // RGB (0-1)
    roughness?: number;  // 0-1, default 0.5
    metalness?: number;  // 0-1, default 0
    emissive?: [number, number, number]; // 自發光顏色
    textureType?: 'grid' | 'noise' | 'solid'; // 程式化紋理類型
}

export interface MapBlock {
    id?: string;          // 可選的唯一識別符
    type: 'box' | 'cylinder' | 'ramp';
    position: [number, number, number]; // x, y, z
    rotation?: [number, number, number]; // euler angles in degrees
    scale: [number, number, number];    // width, height, depth
    material: string;                   // 引用 materials 中的 key
    isCollider?: boolean;               // 是否產生碰撞體 (預設 true)
}

export interface MapEntity {
    type: 'spawn_point' | 'tower' | 'creep_camp' | 'objective' | 'base';
    team?: 'red' | 'blue' | 'neutral';
    position: [number, number, number];
    rotation?: [number, number, number];
    config?: Record<string, any>; // 額外參數
}

// Helper type for spawn points
export interface SpawnPoint {
    team: 'red' | 'blue' | 'neutral';
    position: Vector3;
    rotation?: Vector3;
}
