# 角色控制與顏色同步問題修復

**建立日期**: 2025-12-07

## 問題描述

### 問題 1：兩邊控制同一個角色
用戶反饋 Host 和 Client 的輸入都控制同一個角色，而非各自控制自己的角色。

### 問題 2：角色顏色沒有同步
每個角色應該根據選擇的職業顯示不同顏色，但目前顏色沒有正確同步。

---

## 根因分析

### 問題 1：輸入 PlayerId 錯誤

**位置**: `GameEngine.setupEventListeners()` (line 137)

```typescript
private setupEventListeners() {
    // Network Events - 設置 playerId
    this.inputManager.setPlayerId(this.networkManager.peerId);
    // ...
}
```

**問題**:
1. `setupEventListeners()` 在 `GameEngine.init()` 時執行
2. 此時 `networkManager.peerId` 對於 **Client** 可能還沒設定完成
3. Client 的 `peerId` 是由 PeerJS 自動生成的隨機 ID，在 `Peer.on('open')` 回調中才設定
4. 但 `GameEngine.init()` 可能在 `Peer.on('open')` 之前執行

**結果**:
- Client 的 `inputManager.playerId` 可能是空字串或 Host 的 ID
- 所有輸入都被誤認為來自同一個玩家

**證據**:
- `RoomService.joinRoom()` 中設定 `roomStore.setMyPeerId(this.networkManager.peerId)`
- 但 `GameService.init()` → `GameEngine.init()` 的調用時機可能早於此

---

### 問題 2：CharacterStore 沒有同步

**位置**: `RoomService.onRoomState` (line 82-100)

```typescript
this.networkManager.onRoomState = (players) => {
    players.forEach(p => {
        // 只更新 roomStore
        this.roomStore.addPlayer({...})
        this.roomStore.updatePlayerCharacter(p.id, p.characterId)
        // ❌ 沒有更新 characterStore!
    })
}
```

**問題**:
1. `RoomService.onRoomState` 只更新 `roomStore`
2. 沒有同步更新 `characterStore`
3. `PlayerManager.spawnPlayer()` 從 `characterStore.getPlayerCharacter()` 獲取角色

**結果**:
- Client 端的 `characterStore` 沒有其他玩家的角色選擇
- `PlayerManager` 找不到角色資料，使用預設顏色

**資料流**:
```
Host 選角 → roomStore.connectedPlayers ✅
         → characterStore.playerCharacters ✅

Client 收 room_state → roomStore.connectedPlayers ✅
                     → characterStore.playerCharacters ❌ (缺少)

PlayerManager.spawnPlayer() → characterStore.getPlayerCharacter() → undefined
                           → 使用預設顏色
```

---

## 修復計畫

### 修復 1：確保 InputManager 使用正確的 PlayerId

**位置**: `GameEngine.startGame()`

**方案**: 在遊戲開始時（此時 peerId 已確定設定完成）重新設定 `inputManager.playerId`

```typescript
startGame() {
    // ... 其他初始化
    
    // 確保 InputManager 使用正確的 playerId
    this.inputManager.setPlayerId(this.networkManager.peerId);
    console.log('[GameEngine] Set inputManager playerId to:', this.networkManager.peerId);
    
    // ... 生成玩家
}
```

---

### 修復 2：在 onRoomState 中同步 CharacterStore

**位置**: `RoomService.initListeners()` 的 `onRoomState` 回調

**方案**: 當收到 `room_state` 時，同時更新 `characterStore`

```typescript
// 需要導入 useCharacterStore
private characterStore = useCharacterStore()

this.networkManager.onRoomState = (players) => {
    players.forEach(p => {
        // 更新 roomStore (現有)
        // ...
        
        // 新增：同步更新 characterStore
        if (p.characterId) {
            this.characterStore.setPlayerCharacter(p.id, p.characterId)
        }
    })
}
```

---

### 修復 3：添加更多調試日誌

在關鍵位置添加日誌以便追蹤問題：

1. `InputManager.collectInput()` - 記錄 `playerId`
2. `GameEngine.processInputs()` - 記錄正在處理的 `input.playerId`
3. `PlayerManager.spawnPlayer()` - 記錄獲取到的 `characterId`

---

## 驗證步驟

1. Host 建立房間，選擇角色
2. Client 加入房間，選擇不同角色
3. 觀察 Console 日誌：
   - `[GameEngine] Set inputManager playerId to: XXX` (兩邊 ID 應不同)
   - `[PlayerManager] Spawned player XXX with character YYY` (角色 ID 應對應選擇)
4. 測試移動：Host 和 Client 各自移動，應該控制不同角色
5. 測試顏色：兩個角色應該有各自職業的顏色

---

## 相關檔案

- `src/core/GameEngine.ts` - 遊戲引擎，處理輸入和玩家生成
- `src/core/managers/InputManager.ts` - 輸入管理器
- `src/core/managers/PlayerManager.ts` - 玩家管理器
- `src/services/RoomService.ts` - 房間服務，處理網路同步
- `src/stores/characterStore.ts` - 角色選擇狀態
- `src/stores/roomStore.ts` - 房間狀態
