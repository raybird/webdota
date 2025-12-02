<template>
  <div class="character-selector-overlay">
    <div class="character-selector">
      <h2 class="title">選擇你的角色</h2>
      
      <div class="character-grid">
        <div
          v-for="character in characters"
          :key="character.id"
          class="character-card"
          :class="{ selected: selectedId === character.id }"
          @click="selectCharacter(character.id)"
        >
          <div class="character-icon" :style="{ backgroundColor: character.appearance.color }">
            {{ character.icon }}
          </div>
          <div class="character-name">{{ character.name }}</div>
          <div class="character-check" v-if="selectedId === character.id">✓</div>
        </div>
      </div>
      
      <div v-if="selectedCharacter" class="character-info">
        <h3>{{ selectedCharacter.name }}</h3>
        <p class="description">{{ selectedCharacter.description }}</p>
        <div class="stats">
          <div class="stat">
            <span class="label">血量:</span>
            <span class="value">{{ selectedCharacter.baseStats.maxHp }}</span>
          </div>
          <div class="stat">
            <span class="label">速度:</span>
            <span class="value">{{ selectedCharacter.baseStats.moveSpeed }}</span>
          </div>
          <div class="stat">
            <span class="label">攻擊:</span>
            <span class="value">{{ selectedCharacter.baseStats.attackPower }}</span>
          </div>
        </div>
      </div>
      
      <button class="confirm-button" @click="confirmSelection">
        確認選擇
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getAllCharacters, getCharacter } from '../data/characters';
import { DEFAULT_CHARACTER_ID } from '../types/Character';
import type { Character } from '../types/Character';

const emit = defineEmits<{
  confirm: [characterId: string]
}>();

const props = defineProps<{
  initialCharacterId?: string
}>();

const characters = ref<Character[]>(getAllCharacters());
const selectedId = ref<string>(props.initialCharacterId || DEFAULT_CHARACTER_ID);

const selectedCharacter = computed(() => {
  return getCharacter(selectedId.value);
});

function selectCharacter(id: string) {
  selectedId.value = id;
}

function confirmSelection() {
  emit('confirm', selectedId.value);
}

// 鍵盤導航支援
function handleKeydown(event: KeyboardEvent) {
  const currentIndex = characters.value.findIndex(c => c.id === selectedId.value);
  
  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
    event.preventDefault();
    const newIndex = (currentIndex - 1 + characters.value.length) % characters.value.length;
    selectedId.value = characters.value[newIndex]!.id;
  } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
    event.preventDefault();
    const newIndex = (currentIndex + 1) % characters.value.length;
    selectedId.value = characters.value[newIndex]!.id;
  } else if (event.key === 'Enter') {
    event.preventDefault();
    confirmSelection();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.character-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.character-selector {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 20px;
  padding: 40px;
  max-width: 800px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.title {
  text-align: center;
  font-size: 32px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 30px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.character-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  text-align: center;
}

.character-card:hover {
  transform: translateY(-5px);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.character-card.selected {
  border-color: #4CAF50;
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
  background: rgba(76, 175, 80, 0.1);
}

.character-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  margin: 0 auto 15px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.character-name {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
}

.character-check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 30px;
  height: 30px;
  background: #4CAF50;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-weight: bold;
}

.character-info {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.character-info h3 {
  color: #fff;
  font-size: 24px;
  margin-bottom: 10px;
}

.description {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 15px;
  line-height: 1.5;
}

.stats {
  display: flex;
  gap: 20px;
}

.stat {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px;
  border-radius: 8px;
  text-align: center;
}

.stat .label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-bottom: 5px;
}

.stat .value {
  display: block;
  color: #fff;
  font-size: 20px;
  font-weight: bold;
}

.confirm-button {
  width: 100%;
  padding: 15px;
  font-size: 18px;
  font-weight: bold;
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
}

.confirm-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5);
}

.confirm-button:active {
  transform: translateY(0);
}

/* 手機響應式 */
@media (max-width: 768px) {
  .character-selector {
    padding: 20px;
  }
  
  .title {
    font-size: 24px;
  }
  
  .character-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .character-card {
    display: flex;
    align-items: center;
    text-align: left;
    padding: 15px;
  }
  
  .character-icon {
    width: 60px;
    height: 60px;
    font-size: 30px;
    margin: 0 15px 0 0;
  }
  
  .stats {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
