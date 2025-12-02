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
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  text-align: center;
}

.char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
  overflow-y: auto;
}

.char-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  text-align: center;
  position: relative;
  transition: all 0.2s;
}

.char-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.char-card.selected {
  border-color: #42b883;
  background: rgba(66, 184, 131, 0.1);
}

.char-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin: 0 auto 0.5rem;
}

.char-name {
  font-size: 0.9rem;
  font-weight: bold;
}

.char-check {
  position: absolute;
  top: 5px;
  right: 5px;
  background: #42b883;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.char-info {
  background: rgba(0, 0, 0, 0.2);
  padding: 1rem;
  border-radius: 8px;
  margin-top: auto;
}

.char-info h4 {
  margin: 0 0 0.5rem;
  color: #42b883;
}

.char-desc {
  font-size: 0.9rem;
  color: #aaa;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.stat-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  border-radius: 3px;
}
</style>
