/**
 * MapManager - 地圖管理器
 * 負責加載、生成和管理地圖
 */
import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MapConfig, MapBlock, MapEntity, SpawnPoint, MaterialConfig } from './MapData';

export class MapManager {
    private app: pc.Application;
    private physicsWorld: RAPIER.World;
    private currentMapEntity: pc.Entity | null = null;
    private mapColliders: RAPIER.Collider[] = [];
    private materials: Map<string, pc.StandardMaterial> = new Map();
    private spawnPoints: SpawnPoint[] = [];
    private currentMapConfig: MapConfig | null = null;

    constructor(app: pc.Application, physicsWorld: RAPIER.World) {
        this.app = app;
        this.physicsWorld = physicsWorld;
    }

    /**
     * 加載指定地圖配置
     */
    async loadMap(config: MapConfig): Promise<void> {
        console.log(`[MapManager] Loading map: ${config.name} (${config.id})`);

        // 1. 清理當前地圖
        this.unloadCurrentMap();

        // 2. 儲存當前配置
        this.currentMapConfig = config;

        // 3. 建立地圖根節點
        const mapRoot = new pc.Entity('MapRoot');
        this.app.root.addChild(mapRoot);
        this.currentMapEntity = mapRoot;

        // 4. 套用環境設定
        this.applyEnvironment(config.environment);

        // 5. 建立材質
        this.createMaterials(config.materials);

        // 6. 生成地板
        this.createGround(config, mapRoot);

        // 7. 生成積木
        for (const block of config.blocks) {
            this.createBlock(block, mapRoot);
        }

        // 8. 解析邏輯實體
        this.parseEntities(config.entities);

        console.log(`[MapManager] Map loaded: ${config.blocks.length} blocks, ${this.spawnPoints.length} spawn points`);
    }

    /**
     * 卸載當前地圖
     */
    unloadCurrentMap(): void {
        // 移除視覺實體
        if (this.currentMapEntity) {
            this.currentMapEntity.destroy();
            this.currentMapEntity = null;
        }

        // 移除物理碰撞體
        for (const collider of this.mapColliders) {
            this.physicsWorld.removeCollider(collider, true);
        }
        this.mapColliders = [];

        // 清理材質
        this.materials.forEach(mat => mat.destroy());
        this.materials.clear();

        // 清理出生點
        this.spawnPoints = [];
        this.currentMapConfig = null;

        console.log('[MapManager] Current map unloaded');
    }

    /**
     * 套用環境設定
     */
    private applyEnvironment(env: MapConfig['environment']): void {
        // 設定天空顏色 (Camera clear color)
        const camera = this.app.root.findByName('Camera') as pc.Entity | null;
        if (camera && camera.camera) {
            camera.camera.clearColor = new pc.Color(env.skyColor[0], env.skyColor[1], env.skyColor[2]);
        }

        // 設定環境光強度
        const light = this.app.root.findByName('Light') as pc.Entity | null;
        if (light && light.light) {
            light.light.intensity = env.ambientIntensity;
        }
    }

    /**
     * 建立材質庫
     */
    private createMaterials(materialConfigs: Record<string, MaterialConfig>): void {
        for (const [name, config] of Object.entries(materialConfigs)) {
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(config.color[0], config.color[1], config.color[2]);
            material.gloss = 1 - (config.roughness ?? 0.5);
            material.metalness = config.metalness ?? 0;

            if (config.emissive) {
                material.emissive = new pc.Color(config.emissive[0], config.emissive[1], config.emissive[2]);
            }

            material.update();
            this.materials.set(name, material);
        }
    }

    /**
     * 建立地板
     */
    private createGround(config: MapConfig, parent: pc.Entity): void {
        const groundEntity = new pc.Entity('Ground');
        groundEntity.addComponent('render', { type: 'box' });
        groundEntity.setLocalScale(config.size.w, 0.1, config.size.h);
        groundEntity.setPosition(0, -0.05, 0);

        // 套用地板材質
        const groundMat = new pc.StandardMaterial();
        groundMat.diffuse = new pc.Color(
            config.environment.groundColor[0],
            config.environment.groundColor[1],
            config.environment.groundColor[2]
        );
        groundMat.update();
        if (groundEntity.render) {
            groundEntity.render.material = groundMat;
        }

        parent.addChild(groundEntity);

        // 地板碰撞體
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
            config.size.w / 2,
            0.05,
            config.size.h / 2
        );
        groundColliderDesc.setTranslation(0, -0.05, 0);
        const groundCollider = this.physicsWorld.createCollider(groundColliderDesc);
        this.mapColliders.push(groundCollider);
    }

    /**
     * 建立單個積木
     */
    private createBlock(block: MapBlock, parent: pc.Entity): void {
        const entity = new pc.Entity(block.id || `Block_${block.type}`);

        // 視覺組件
        let renderType: string;
        switch (block.type) {
            case 'cylinder':
                renderType = 'cylinder';
                break;
            case 'ramp':
            case 'box':
            default:
                renderType = 'box';
                break;
        }

        entity.addComponent('render', { type: renderType });

        // 位置、旋轉、縮放
        entity.setPosition(block.position[0], block.position[1], block.position[2]);
        entity.setLocalScale(block.scale[0], block.scale[1], block.scale[2]);

        if (block.rotation) {
            entity.setEulerAngles(block.rotation[0], block.rotation[1], block.rotation[2]);
        }

        // 套用材質
        const material = this.materials.get(block.material);
        if (material && entity.render) {
            entity.render.material = material;
        }

        parent.addChild(entity);

        // 物理碰撞體 (預設開啟)
        const isCollider = block.isCollider !== false;
        if (isCollider) {
            this.createBlockCollider(block);
        }
    }

    /**
     * 為積木建立物理碰撞體
     */
    private createBlockCollider(block: MapBlock): void {
        let colliderDesc: RAPIER.ColliderDesc;

        switch (block.type) {
            case 'cylinder':
                // Rapier cylinder: half-height, radius
                colliderDesc = RAPIER.ColliderDesc.cylinder(
                    block.scale[1] / 2,  // half-height
                    block.scale[0] / 2   // radius (assuming scale.x = diameter)
                );
                break;
            case 'ramp':
            case 'box':
            default:
                colliderDesc = RAPIER.ColliderDesc.cuboid(
                    block.scale[0] / 2,
                    block.scale[1] / 2,
                    block.scale[2] / 2
                );
                break;
        }

        // 設定位置
        colliderDesc.setTranslation(
            block.position[0],
            block.position[1],
            block.position[2]
        );

        // 設定旋轉 (如果有)
        if (block.rotation) {
            const q = new pc.Quat().setFromEulerAngles(
                block.rotation[0],
                block.rotation[1],
                block.rotation[2]
            );
            colliderDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        }

        const collider = this.physicsWorld.createCollider(colliderDesc);
        this.mapColliders.push(collider);
    }

    /**
     * 解析邏輯實體
     */
    private parseEntities(entities: MapEntity[]): void {
        for (const entity of entities) {
            switch (entity.type) {
                case 'spawn_point':
                    this.spawnPoints.push({
                        team: entity.team || 'neutral',
                        position: {
                            x: entity.position[0],
                            y: entity.position[1],
                            z: entity.position[2]
                        },
                        rotation: entity.rotation ? {
                            x: entity.rotation[0],
                            y: entity.rotation[1],
                            z: entity.rotation[2]
                        } : undefined
                    });
                    break;
                // TODO: 處理其他實體類型 (tower, creep_camp)
            }
        }
    }

    /**
     * 取得指定隊伍的出生點
     */
    getSpawnPoints(team?: 'red' | 'blue' | 'neutral'): SpawnPoint[] {
        if (!team) {
            return [...this.spawnPoints];
        }
        return this.spawnPoints.filter(sp => sp.team === team);
    }

    /**
     * 取得當前地圖配置
     */
    getCurrentMapConfig(): MapConfig | null {
        return this.currentMapConfig;
    }

    /**
     * 取得地圖邊界
     */
    getMapBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
        if (!this.currentMapConfig) return null;
        const halfW = this.currentMapConfig.size.w / 2;
        const halfH = this.currentMapConfig.size.h / 2;
        return {
            minX: -halfW,
            maxX: halfW,
            minZ: -halfH,
            maxZ: halfH
        };
    }
}
