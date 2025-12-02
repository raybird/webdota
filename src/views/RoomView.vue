<script setup lang="ts">
import { RoomService } from '../services/RoomService'
import { GameService } from '../services/GameService'
import WaitingRoom from '../components/room/WaitingRoom.vue'

defineProps<{
  roomService: RoomService
  gameService: GameService
}>()
</script>

<template>
  <div class="room-view">
    <WaitingRoom 
      :room-service="roomService" 
      :game-service="gameService" 
    />
  </div>
</template>

<style scoped>
.room-view {
  width: 100%;
  height: 100%;
}
</style>
