# 地圖系統設計方案：程式化積木搭建 (Programmatic Block Building)

本文件詳細說明採用「程式化積木搭建」方式開發 WebDota 地圖系統的設計方案。此方案旨在不依賴外部 3D 模型軟體 (如 Blender) 的情況下，透過配置檔與程式碼，快速建構具備豐富 gameplay 的 3D 地圖。

## 1. 核心概念

地圖由基礎的幾何體（積木）組成，所有地圖資訊存儲於 JSON 配置檔中。`MapManager` 負責讀取配置，並同步生成：
1.  **視覺層 (Visuals)**: PlayCanvas 的 Render Components (Box, Cylinder 等)。
2.  **物理層 (Physics)**: Rapier 的 Colliders。
3.  **邏輯層 (Logic)**: 出生點、重生點、防禦塔位置等遊戲邏輯數據。

## 2. 地圖數據結構 (Map Data Structure)

地圖將定義為一個 JSON 物件，包含基礎資訊、材質定義、積木列表與邏輯點位。

```typescript
export interface MapConfig {
    id: string;          // 地圖唯一 ID (e.g., "arena_01")
    name: string;        // 顯示名稱
    size: { w: number, h: number }; // 地圖邊界尺寸

    // 環境設定
    environment: {
        skyColor: [number, number, number]; // RGB
        ambientLight: [number, number, number];
        groundTexture: string; // 地板材質 ID
    };

    // 材質定義 (用於複用)
    materials: Record<string, {
        color: [number, number, number];
        texture?: string; // 預留: 生成的貼圖名稱
        roughness?: number;
        metalness?: number;
    }>;

    // 積木列表 (地圖上的靜態物體)
    blocks: MapBlock[];

    // 邏輯實體 (出生點、野怪等)
    entities: MapEntity[];
}

export interface MapBlock {
    type: 'box' | 'cylinder' | 'wall';
    position: [number, number, number]; // x, y, z
    rotation?: [number, number, number]; // euler angles
    scale: [number, number, number];    // w, h, d
    material: string;                   // 引用 materials 中的 key
    isCollider: boolean;                // 是否產生碰撞體 (預設 true)
}

export interface MapEntity {
    type: 'spawn_point' | 'tower' | 'creep_camp';
    team?: 'red' | 'blue' | 'neutral';
    position: [number, number, number];
    config?: Record<string, any>; // 額外參數
}
```

## 3. MapManager 架構

`MapManager` 是核心控制器，負責地圖的生命週期管理。

### 類別設計

```typescript
class MapManager {
    private app: pc.Application;
    private physicsWorld: RAPIER.World;
    private currentMapEntity: pc.Entity | null = null;
    private mapColliders: RAPIER.Collider[] = [];

    constructor(app: pc.Application, physics: RAPIER.World) { ... }

    /**
     * 加載指定地圖
     */
    async loadMap(config: MapConfig) {
        // 1. 清理當前地圖 (Visual & Physics)
        this.unloadCurrentMap();

        // 2. 建立地圖根節點
        const mapRoot = new pc.Entity('MapRoot');
        this.app.root.addChild(mapRoot);
        this.currentMapEntity = mapRoot;

        // 3. 生成地板
        this.createGround(config, mapRoot);

        // 4. 生成積木 (Blocks)
        for (const block of config.blocks) {
            this.createBlock(block, mapRoot);
        }

        // 5. 處理邏輯實體 (存儲供 GameEngine 查詢)
        this.parseEntities(config.entities);
    }

    /**
     * 創建單個積木
     */
    private createBlock(data: MapBlock, parent: pc.Entity) {
        // Visual
        const entity = new pc.Entity();
        entity.addComponent('render', {
            type: data.type === 'wall' ? 'box' : data.type,
        });
        // 套用材質...
        // 設定 Transform...
        parent.addChild(entity);

        // Physics
        if (data.isCollider) {
            // 根據類型建立 Rapier Collider
            // Box: Cuboid
            // Cylinder: Cylinder
            const colliderDesc = ...;
            const collider = this.physicsWorld.createCollider(colliderDesc);
            this.mapColliders.push(collider);
        }
    }

    // ... 其他輔助方法
}
```

## 4. 視覺優化策略 (Making it look good)

雖然只用方塊，但配合**生成式紋理**和**光影**，可以達到不錯的效果。

### A. 程式化紋理生成 (Procedural Textures)
我們可以使用 `Canvas API` 動態繪製紋理，不需要依賴外部圖片檔案。

例如：
- **石磚 (Stone Brick)**: 在 Canvas 上畫灰色背景 + 深色網格線 + 雜訊。
- **草地 (Grass)**: 綠色背景 + 隨機深淺綠色噪點。
- **隊伍區域**: 地板疊加紅/藍色半透明遮罩。

### B. 光影烘焙 (Lighting)
- 開啟 PlayCanvas 的 `clusteredLighting`。
- 為主光源 (Directional Light) 開啟 `castShadows: true`。
- 對於靜態積木，可以考慮開啟 `lightmapped: true` (進階)。

## 5. 開發工作流 (Workflow)

1.  **地圖設計**:
    - 在 `src/data/maps/` 下建立新的 map JSON 檔 (e.g., `arena.json`)。
    - 手動編寫或複製貼上坐標數據定義牆壁和障礙物。
2.  **預覽與測試**:
    - 遊戲啟動時讀取該 JSON。
    - 進入遊戲即可看到搭建好的地圖。
3.  **迭代**:
    - 調整 JSON 中的坐標、尺寸。
    - 調整顏色或紋理參數。

## 6. 範例地圖配置 (JSON)

```json
{
  "id": "demo_arena",
  "name": "試煉場",
  "size": { "w": 50, "h": 50 },
  "environment": {
    "skyColor": [0.1, 0.1, 0.2],
    "groundTexture": "grass"
  },
  "materials": {
    "wall_mat": { "color": [0.5, 0.5, 0.5] },
    "pillar_mat": { "color": [0.8, 0.2, 0.2] }
  },
  "blocks": [
    {
      "type": "box",
      "position": [0, 1, 0],
      "scale": [2, 2, 2],
      "material": "wall_mat",
      "isCollider": true
    },
    {
      "type": "wall",
      "position": [10, 2, 10],
      "scale": [10, 4, 1],
      "rotation": [0, 45, 0],
      "material": "wall_mat",
      "isCollider": true
    }
  ],
  "entities": [
    {
      "type": "spawn_point",
      "team": "blue",
      "position": [-20, 1, -20]
    },
    {
      "type": "spawn_point",
      "team": "red",
      "position": [20, 1, 20]
    }
  ]
}
```
