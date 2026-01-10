<script setup lang="ts">
import { computed } from 'vue'
import { useRoomStore } from '../../stores/roomStore'
import { getCharacter } from '../../data/characters'

const props = defineProps<{
  players?: Array<{ id: string; isReady: boolean; characterId?: string; team?: 'red' | 'blue' | 'neutral' }>
  teamColor?: 'red' | 'blue'
  title?: string
}>()

const roomStore = useRoomStore()

const displayPlayers = computed(() => props.players || roomStore.connectedPlayers)
const myPeerId = computed(() => roomStore.myPeerId)

const getCharacterIcon = (characterId?: string) => {
  if (!characterId) return '👤'
  const character = getCharacter(characterId)
  return character?.icon || '👤'
}

const getCharacterName = (characterId?: string) => {
  if (!characterId) return '未選擇'
  const character = getCharacter(characterId)
  return character?.name || '未選擇'
}
</script>

<template>
  <div class="player-list" :class="teamColor">
    <h3 :style="{ color: teamColor === 'red' ? '#ff4444' : (teamColor === 'blue' ? '#4444ff' : '#ff0') }">
      {{ title || `已連線玩家 (${displayPlayers.length})` }}
    </h3>
    <div class="player-grid">
      <div 
        v-for="player in displayPlayers" 
        :key="player.id" 
        class="player-item"
        :class="{ 'is-me': player.id === myPeerId, 'is-ready': player.isReady }"
      >
        <div class="p-avatar">
          {{ getCharacterIcon(player.characterId) }}
        </div>
        <div class="p-info">
          <div class="p-name">
            {{ player.id === myPeerId ? '我' : player.id.substring(0, 6) }}
          </div>
          <div class="p-char-name">
            {{ getCharacterName(player.characterId) }}
          </div>
        </div>
        <div class="p-status">
          {{ player.isReady ? '已準備' : '準備中...' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-list {
  background: rgba(0, 0, 0, 0.4);
  padding: 1rem;
  border-radius: 8px;
  width: 100%;
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

.player-list.red {
  background: linear-gradient(180deg, rgba(50, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.4) 100%);
  border-color: rgba(255, 0, 0, 0.3);
}

.player-list.blue {
  background: linear-gradient(180deg, rgba(0, 0, 50, 0.6) 0%, rgba(0, 0, 0, 0.4) 100%);
  border-color: rgba(0, 0, 255, 0.3);
}

.player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.player-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.player-item.is-me {
  background: rgba(66, 184, 131, 0.2);
  border-color: #42b883;
}

.player-item.is-ready {
  border-color: #ffd700;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

.p-avatar {
  font-size: 2rem;
  background: rgba(0, 0, 0, 0.3);
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.p-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.p-name {
  font-weight: bold;
  color: #fff;
}

.p-char-name {
  font-size: 0.8rem;
  color: #aaa;
}

.p-status {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: #aaa;
}

.is-ready .p-status {
  background: #ffd700;
  color: #000;
  font-weight: bold;
}
</style>
