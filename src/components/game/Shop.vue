<template>
  <div class="shop-overlay" v-if="isShopOpen" @click.self="closeShop">
    <div class="shop-container">
      <!-- Header -->
      <div class="shop-header">
        <h2>🏪 商店</h2>
        <div class="gold-display">
          <span class="gold-icon">💰</span>
          <span class="gold-amount">{{ gold }}</span>
        </div>
        <button class="close-btn" @click="closeShop">✕</button>
      </div>

      <!-- Content -->
      <div class="shop-content">
        <!-- Item Grid -->
        <div class="item-grid">
          <div
            v-for="item in items"
            :key="item.id"
            class="item-card"
            :class="{ 'can-afford': gold >= item.cost, 'cannot-afford': gold < item.cost }"
            @click="buyItem(item)"
          >
            <div class="item-icon">{{ item.icon }}</div>
            <div class="item-info">
              <div class="item-name">{{ item.name }}</div>
              <div class="item-cost">
                <span class="gold-icon">💰</span>
                {{ item.cost }}
              </div>
            </div>
            <div class="item-stats">
              <span v-if="item.stats.attackPower" class="stat attack">⚔️ +{{ item.stats.attackPower }}</span>
              <span v-if="item.stats.maxHp" class="stat hp">❤️ +{{ item.stats.maxHp }}</span>
              <span v-if="item.stats.defense" class="stat defense">🛡️ +{{ item.stats.defense }}</span>
              <span v-if="item.stats.moveSpeed" class="stat speed">👟 +{{ item.stats.moveSpeed }}</span>
              <span v-if="item.stats.cooldownReduction" class="stat cdr">⏱️ -{{ Math.round((item.stats.cooldownReduction || 0) * 100) }}%</span>
            </div>
            <div class="item-desc">{{ item.description }}</div>
          </div>
        </div>

        <!-- Inventory -->
        <div class="inventory-section">
          <h3>📦 背包</h3>
          <div class="inventory-slots">
            <div
              v-for="(slot, index) in inventory"
              :key="index"
              class="inventory-slot"
              :class="{ empty: !slot }"
              @click="sellItem(index)"
            >
              <template v-if="slot">
                <span class="slot-icon">{{ slot.icon }}</span>
                <span class="slot-name">{{ slot.name }}</span>
              </template>
              <template v-else>
                <span class="empty-text">空</span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="shop-footer">
        <p class="hint">點擊物品購買 | 點擊背包物品出售 (50% 價格)</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import { getAllItems } from '../../data/items'
import type { Item } from '../../types/Item'
import type { GameService } from '../../services/GameService'

const gameStore = useGameStore()
const gameService = inject<GameService>('gameService')

const items = getAllItems()
const gold = computed(() => gameStore.gold)
const inventory = computed(() => gameStore.inventory)
const isShopOpen = computed(() => gameStore.isShopOpen)

function closeShop() {
  gameStore.closeShop()
}

function buyItem(item: Item) {
  if (gold.value < item.cost) {
    console.log('[Shop] Not enough gold')
    return
  }

  // 呼叫 GameService 購買物品
  if (gameService) {
    const success = gameService.buyItem(item.id)
    if (success) {
      console.log(`[Shop] Bought ${item.name}`)
    }
  }
}

function sellItem(index: number) {
  const item = inventory.value[index]
  if (!item) return

  if (gameService) {
    gameService.sellItem(index)
    console.log(`[Shop] Sold ${item.name}`)
  }
}
</script>

<style scoped>
.shop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.shop-container {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 2px solid #3a506b;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.shop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: linear-gradient(90deg, #2d4059 0%, #3a506b 100%);
  border-bottom: 1px solid #4a6572;
}

.shop-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.gold-display {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px 16px;
  border-radius: 20px;
}

.gold-icon {
  font-size: 1.2rem;
}

.gold-amount {
  font-size: 1.2rem;
  font-weight: bold;
  color: #ffd700;
}

.close-btn {
  background: rgba(255, 100, 100, 0.2);
  border: 1px solid #ff6464;
  color: #ff6464;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #ff6464;
  color: white;
}

.shop-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.item-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #3a506b;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.item-card.can-afford {
  border-color: #4caf50;
}

.item-card.can-afford:hover {
  background: rgba(76, 175, 80, 0.1);
  border-color: #81c784;
}

.item-card.cannot-afford {
  opacity: 0.6;
  border-color: #666;
}

.item-icon {
  font-size: 2rem;
  text-align: center;
  margin-bottom: 8px;
}

.item-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-name {
  font-weight: bold;
  color: #e0e0e0;
}

.item-cost {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #ffd700;
  font-weight: bold;
}

.item-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.stat {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
}

.stat.attack { color: #ff7043; }
.stat.hp { color: #ef5350; }
.stat.defense { color: #42a5f5; }
.stat.speed { color: #66bb6a; }
.stat.cdr { color: #ab47bc; }

.item-desc {
  font-size: 0.8rem;
  color: #888;
}

.inventory-section {
  border-top: 1px solid #3a506b;
  padding-top: 16px;
}

.inventory-section h3 {
  margin: 0 0 12px 0;
  color: #81c784;
}

.inventory-slots {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.inventory-slot {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #3a506b;
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.inventory-slot:hover:not(.empty) {
  border-color: #ff6464;
  background: rgba(255, 100, 100, 0.1);
}

.inventory-slot.empty {
  cursor: default;
}

.slot-icon {
  font-size: 1.5rem;
}

.slot-name {
  font-size: 0.7rem;
  color: #aaa;
  margin-top: 4px;
}

.empty-text {
  color: #555;
  font-size: 0.8rem;
}

.shop-footer {
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid #3a506b;
}

.hint {
  margin: 0;
  text-align: center;
  color: #888;
  font-size: 0.85rem;
}

/* Scrollbar */
.shop-content::-webkit-scrollbar {
  width: 8px;
}

.shop-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.shop-content::-webkit-scrollbar-thumb {
  background: #3a506b;
  border-radius: 4px;
}

/* Mobile Responsive */
@media (max-width: 600px) {
  .shop-container {
    width: 95%;
    max-height: 90vh;
  }

  .item-grid {
    grid-template-columns: 1fr;
  }

  .inventory-slots {
    grid-template-columns: repeat(3, 1fr);
  }

  .shop-header h2 {
    font-size: 1.2rem;
  }
}
</style>
