/**
 * ProvenanceManager - 戰局主權存封與數位指紋 (v26.0328)
 * 負責為關鍵戰局事件產生符合 C2PA 精神的段落級雜湊憑證，並持久化至 IndexedDB。
 */
export class ProvenanceManager {
    private static instance: ProvenanceManager;
    private dbName = 'WebDotaProvenanceDB';
    private db: IDBDatabase | null = null;
    private manifestStore: Array<{
        id: string,
        frame: number,
        timestamp: string,
        eventType: string,
        payloadHash: string,
        signature: string
    }> = [];

    private constructor() {
        this.initDB();
    }

    private async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e: any) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('manifests')) {
                    db.createObjectStore('manifests', { keyPath: 'id' });
                }
            };
            request.onsuccess = (e: any) => {
                this.db = e.target.result;
                console.log(`[Provenance] IndexedDB 初始化成功`);
                resolve(true);
            };
            request.onerror = (e) => reject(e);
        });
    }

    public static getInstance(): ProvenanceManager {
        if (!ProvenanceManager.instance) {
            ProvenanceManager.instance = new ProvenanceManager();
        }
        return ProvenanceManager.instance;
    }

    /**
     * 為戰局事件產生數位指紋 (Causal Fingerprint)
     */
    public async recordEvent(frame: number, eventType: string, payload: any) {
        const timestamp = new Date().toISOString();
        const rawPayload = JSON.stringify(payload);
        
        // 執行 SHA-256 雜湊
        const msgUint8 = new TextEncoder().encode(rawPayload);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const manifest = {
            id: crypto.randomUUID(),
            frame,
            timestamp,
            eventType,
            payloadHash,
            signature: `sig_${payloadHash.substring(0, 8)}`
        };

        this.manifestStore.push(manifest);
        console.log(`[Provenance] 事件存證成功: ${eventType} @ Frame ${frame} | Hash: ${payloadHash.substring(0, 16)}...`);
        
        await this.syncToIndexedDB(manifest);
    }

    private async syncToIndexedDB(manifest: any) {
        if (!this.db) return;
        const transaction = this.db.transaction(['manifests'], 'readwrite');
        const store = transaction.objectStore('manifests');
        store.add(manifest);
    }

    public getManifestStore() {
        return this.manifestStore;
    }
}
