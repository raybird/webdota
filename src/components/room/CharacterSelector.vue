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
  background: transparent;
  padding: 0;
  border: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: none;
}

h3 {
  margin: 0 0 1rem;
  text-align: center;
  font-size: 1.5rem;
  color: #fff;
  text-shadow: 0 0 15px var(--c-primary), 0 0 5px var(--c-primary);
  letter-spacing: 4px;
  text-transform: uppercase;
}

.char-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
  margin-bottom: 2rem;
  overflow-y: auto;
  max-height: 250px;
  padding: 1rem;
  scrollbar-width: thin;
  scrollbar-color: var(--c-primary) rgba(0,0,0,0.3);
}

.char-card {
  background: linear-gradient(145deg, rgba(30, 30, 40, 0.8), rgba(10, 10, 15, 0.9));
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem 0.5rem;
  cursor: pointer;
  text-align: center;
  position: relative;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  width: 110px;
  height: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(0,0,0,0.6);
}

.char-card:hover {
  background: rgba(124, 58, 237, 0.15);
  transform: translateY(-8px) scale(1.05);
  box-shadow: 0 12px 25px rgba(124, 58, 237, 0.5);
  border-color: rgba(167, 139, 250, 0.7);
  z-index: 2;
}

.char-card.selected {
  border-color: var(--c-primary);
  background: linear-gradient(145deg, rgba(50, 20, 80, 0.8), rgba(124, 58, 237, 0.3));
  box-shadow: inset 0 0 20px rgba(124, 58, 237, 0.5), 0 0 25px rgba(124, 58, 237, 0.6);
  transform: scale(1.08);
  z-index: 3;
}

.char-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  margin: 0 auto 0.8rem;
  box-shadow: 0 4px 15px rgba(0,0,0,0.8);
  border: 2px solid rgba(255,255,255,0.2);
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.char-card.selected .char-icon {
  border-color: #fff;
  box-shadow: 0 0 15px #fff;
}

.char-name {
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #fff;
  text-transform: uppercase;
}

.char-check {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--c-secondary);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 1rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 15px var(--c-secondary), 0 0 5px #fff;
  border: 2px solid #fff;
}

.char-info {
  background: linear-gradient(180deg, rgba(20, 15, 40, 0.8) 0%, rgba(10, 5, 20, 0.9) 100%);
  padding: 1.5rem 2rem;
  border-radius: 12px;
  border: 1px solid rgba(124, 58, 237, 0.3);
  box-shadow: 0 0 30px rgba(124, 58, 237, 0.15);
  margin: 0 auto;
  max-width: 600px;
  width: 100%;
}

.char-info h4 {
  margin: 0 0 0.8rem;
  color: #fff;
  font-size: 1.8rem;
  text-shadow: 0 0 10px var(--c-secondary);
  letter-spacing: 2px;
  text-transform: uppercase;
  text-align: center;
}

.char-desc {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 1.5rem;
  line-height: 1.6;
  text-align: center;
  font-style: italic;
}

.char-stats {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-row span {
  width: 60px;
  text-align: right;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

.stat-bar {
  flex: 1;
  height: 10px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.15);
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.8);
}

.stat-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 10px currentColor; /* glow matches background */
}

.stat-fill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
  animation: shine 2s infinite linear;
}

@keyframes shine {
  0% { transform: translateX(-100%) skewX(-15deg); }
  100% { transform: translateX(200%) skewX(-15deg); }
}

/* 手機版優化 */
@media (max-width: 768px) {
  .char-grid {
    gap: 0.8rem;
    max-height: 180px;
  }
  .char-card {
    width: 80px;
    height: 100px;
  }
  .char-icon {
    width: 36px;
    height: 36px;
    font-size: 1.2rem;
  }
  .char-info {
    padding: 1rem;
  }
}
</style>
