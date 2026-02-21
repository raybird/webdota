<script setup lang="ts">
import { computed } from 'vue'
import { useCharacterStore } from '../../stores/characterStore'
import { CharacterService } from '../../services/CharacterService'
import { getAllCharacters, getCharacter } from '../../data/characters'

// 我們不需要 props，因為狀態由 store 管理
// 我們也不需要 emit，因為 service 會處理選擇邏輯

const characterStore = useCharacterStore()
// 這裡我們假設 CharacterService 會被注入或全局可用，或者我們直接實例化它？
// 為了保持一致性，我們應該從 props 傳入 service，或者使用依賴注入
// 但為了簡單起見，我們可以在這裡使用 store，而實際的選擇動作可能需要 service
// 讓我們假設父組件會提供 service，或者我們直接在這裡使用 store 的 action (如果 store action 足夠的話)
// 但 CharacterService 負責網路同步，所以我們應該調用 Service。

// 為了避免在這裡實例化 Service (因為它需要 NetworkManager)，
// 最佳做法是讓父組件 (WaitingRoom) 傳入 Service，或者使用 Provide/Inject。
// 這裡我們暫時使用 inject 或者假設父組件傳遞了 selectCharacter 方法
// 或者更簡單：我們讓這個組件只負責 UI，透過 emit 通知父組件選擇了角色

// 修正：WaitingRoom 已經引入了 CharacterSelector，但沒有傳遞 service。
// 讓我們修改 WaitingRoom 傳遞 service，或者使用 inject。
// 為了簡單，我們使用 inject 'characterService'

import { inject } from 'vue'
const characterService = inject<CharacterService>('characterService')

const characters = getAllCharacters()
const selectedId = computed(() => characterStore.selectedCharacterId)
const selectedCharacter = computed(() => getCharacter(selectedId.value))

const selectCharacter = (id: string) => {
  if (characterService) {
    characterService.selectCharacter(id)
  } else {
    console.error('CharacterService not found')
  }
}
</script>

<template>
  <div class="character-selector">
    <h3>選擇角色</h3>
    
    <div class="char-grid">
      <div 
        v-for="char in characters" 
        :key="char.id"
        class="char-card"
        :class="{ selected: selectedId === char.id }"
        @click="selectCharacter(char.id)"
      >
        <div class="char-icon" :style="{ backgroundColor: char.appearance.color }">
          {{ char.icon }}
        </div>
        <div class="char-name">{{ char.name }}</div>
        <div class="char-check" v-if="selectedId === char.id">✓</div>
      </div>
    </div>

    <div v-if="selectedCharacter" class="char-info">
      <h4>{{ selectedCharacter.name }}</h4>
      <p class="char-desc">{{ selectedCharacter.description }}</p>
      
      <div class="char-stats">
        <div class="stat-row">
          <span>生命</span>
          <div class="stat-bar">
            <div class="stat-fill" :style="{ width: (selectedCharacter.baseStats.maxHp / 200 * 100) + '%', background: '#ff4444' }"></div>
          </div>
        </div>
        <div class="stat-row">
          <span>速度</span>
          <div class="stat-bar">
            <div class="stat-fill" :style="{ width: (selectedCharacter.baseStats.moveSpeed / 10 * 100) + '%', background: '#44ff44' }"></div>
          </div>
        </div>
        <div class="stat-row">
          <span>攻擊</span>
          <div class="stat-bar">
            <div class="stat-fill" :style="{ width: (selectedCharacter.baseStats.attackPower / 20 * 100) + '%', background: '#4444ff' }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-selector {
  background: var(--c-bg-panel);
  backdrop-filter: blur(12px);
  padding: 1rem;
  border-radius: 8px;
  border: var(--border-glass);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

h3 {
  margin: 0 0 0.8rem;
  text-align: center;
  font-size: 1.2rem;
  color: var(--c-primary);
  text-shadow: 0 0 10px var(--c-secondary);
  letter-spacing: 2px;
}

.char-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
  margin-bottom: 1rem;
  overflow-y: auto;
  max-height: 150px;
  padding: 0.5rem;
}

.char-card {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  text-align: center;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 70px;
}

.char-card:hover {
  background: rgba(124, 58, 237, 0.1);
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 5px 15px rgba(124, 58, 237, 0.4);
  border-color: rgba(167, 139, 250, 0.5);
  z-index: 2;
}

.char-card.selected {
  border-color: var(--c-primary);
  background: rgba(124, 58, 237, 0.2);
  box-shadow: inset 0 0 15px rgba(124, 58, 237, 0.4), 0 0 15px rgba(124, 58, 237, 0.4);
}

.char-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  margin: 0 auto 0.4rem;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  border: 2px solid rgba(255,255,255,0.1);
}

.char-name {
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--c-text-main);
}

.char-check {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--c-primary);
  color: white;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px var(--c-primary);
  border: 2px solid #0F0F23;
}

.char-info {
  background: rgba(0, 0, 0, 0.4);
  padding: 1rem;
  border-radius: 8px;
  flex: 1;
  overflow: auto;
  border: 1px solid rgba(255,255,255,0.05);
}

.char-info h4 {
  margin: 0 0 0.5rem;
  color: var(--c-secondary);
  font-size: 1.2rem;
  text-shadow: 0 0 8px var(--c-secondary-dark);
  letter-spacing: 1px;
}

.char-desc {
  font-size: 0.85rem;
  color: var(--c-text-muted);
  margin-bottom: 1rem;
  line-height: 1.5;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.8rem;
  font-size: 0.85rem;
  color: var(--c-text-main);
  font-weight: 500;
}

.stat-row span {
  width: 40px;
}

.stat-bar {
  flex: 1;
  height: 8px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
}

.stat-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
}

.stat-fill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shine 2s infinite;
}

@keyframes shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 手機版優化 */
@media (max-width: 768px) {
  .character-selector {
    padding: 0.5rem;
  }
}
</style>
