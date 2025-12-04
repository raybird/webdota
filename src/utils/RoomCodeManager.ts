/**
 * 短房間碼管理器
 * 將長的 PeerJS ID 映射到短碼 (6位數字/字母)
 */
export class RoomCodeManager {
    private static readonly CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // 排除容易混淆的 I/O/0/1
    private static readonly CODE_LENGTH = 6

    // 本地緩存：短碼 -> 完整 ID
    private static codeToIdMap: Map<string, string> = new Map()
    private static idToCodeMap: Map<string, string> = new Map()

    /**
     * 生成短房間碼
     */
    static generateCode(): string {
        let code = ''
        for (let i = 0; i < this.CODE_LENGTH; i++) {
            code += this.CHARS.charAt(Math.floor(Math.random() * this.CHARS.length))
        }
        return code
    }

    /**
     * 為 PeerJS ID 創建短碼
     */
    static createCodeForId(peerId: string): string {
        // 檢查是否已有映射
        if (this.idToCodeMap.has(peerId)) {
            return this.idToCodeMap.get(peerId)!
        }

        // 生成新短碼
        let code = this.generateCode()

        // 確保唯一性
        while (this.codeToIdMap.has(code)) {
            code = this.generateCode()
        }

        // 儲存映射
        this.codeToIdMap.set(code, peerId)
        this.idToCodeMap.set(peerId, code)

        console.log(`[RoomCode] Created code ${code} for ${peerId.substring(0, 8)}...`)
        return code
    }

    /**
     * 根據短碼獲取完整 ID
     */
    static getIdFromCode(code: string): string | undefined {
        return this.codeToIdMap.get(code.toUpperCase())
    }

    /**
     * 根據完整 ID 獲取短碼
     */
    static getCodeFromId(peerId: string): string | undefined {
        return this.idToCodeMap.get(peerId)
    }

    /**
     * 註冊外部收到的短碼映射
     */
    static registerMapping(code: string, peerId: string) {
        this.codeToIdMap.set(code.toUpperCase(), peerId)
        this.idToCodeMap.set(peerId, code.toUpperCase())
    }

    /**
     * 清除映射
     */
    static clear() {
        this.codeToIdMap.clear()
        this.idToCodeMap.clear()
    }
}
