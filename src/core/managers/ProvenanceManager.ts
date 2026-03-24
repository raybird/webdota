/**
 * ProvenanceManager - 戰局主權存封與數位指紋 (v26.0325)
 * 負責為關鍵戰局事件產生符合 C2PA 精神的段落級雜湊憑證。
 */
export class ProvenanceManager {
    private static instance: ProvenanceManager;
    private manifestStore: Array<{
        id: string,
        frame: number,
        timestamp: string,
        eventType: string,
        payloadHash: string,
        signature: string // 模擬簽名
    }> = [];

    private constructor() {}

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
        
        // 觸發物理存儲 (預演未來向 RWA 鏈上錨定)
        this.syncToLocalArchive(manifest);
    }

    private syncToLocalArchive(manifest: any) {
        const key = `WEBDOTA_PROVENANCE_${manifest.id}`;
        localStorage.setItem(key, JSON.stringify(manifest));
    }

    public getManifestStore() {
        return this.manifestStore;
    }
}
