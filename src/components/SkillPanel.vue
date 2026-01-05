<script setup lang="ts">
import { computed, watch } from 'vue'
import SkillButton from './SkillButton.vue'

// Props
interface Props {
  skills: SkillData[]
  currentCooldowns: Map<string, number>
}

interface SkillData {
  id: string
  name: string
  icon: string
  cooldown: number
  type: 'normal' | 'ultimate' | 'basic'
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  skillPress: [skillId: string]
}>()

// Computed - 動態分配技能到按鈕位置
const basicSkill = computed(() => props.skills.find(s => s.type === 'basic'))
const ultimateSkill = computed(() => props.skills.find(s => s.type === 'ultimate'))
const normalSkills = computed(() => props.skills.filter(s => s.type === 'normal'))

// 分配 normal 技能到 Q, W, E 位置
const skill1 = computed(() => normalSkills.value[0] || null)
const skill2 = computed(() => normalSkills.value[1] || null)
const skill3 = computed(() => normalSkills.value[2] || null)

// Methods
const handleSkillPress = (skillId: string) => {
  emit('skillPress', skillId)
}

const getCooldown = (skillId: string): number => {
  return props.currentCooldowns.get(skillId) || 0
}

const isReady = (skillId: string): boolean => {
  return getCooldown(skillId) <= 0
}

// 監聽 skills 變化以便調試
watch(() => props.skills, (newSkills) => {
  console.log('[SkillPanel] Skills updated:', newSkills)
}, { immediate: true })
</script>

<template>
  <div class="skill-panel" v-if="skills.length > 0">
    <!-- 大招按鈕 (R / 4) -->
    <div class="ultimate-slot" v-if="ultimateSkill">
      <div class="key-hint">R / 4</div>
      <SkillButton
        :skill-id="ultimateSkill.id"
        :name="ultimateSkill.name"
        :icon="ultimateSkill.icon"
        :size="70"
        :cooldown="ultimateSkill.cooldown"
        :current-cooldown="getCooldown(ultimateSkill.id)"
        :is-ready="isReady(ultimateSkill.id)"
        @press="handleSkillPress(ultimateSkill.id)"
      />
    </div>
    
    <!-- 技能 1-3（弧形排列） -->
    <div class="skills-arc">
      <div class="skill-slot skill-1" v-if="skill1">
        <div class="key-hint">Q / 1</div>
        <SkillButton
          :skill-id="skill1.id"
          :name="skill1.name"
          :icon="skill1.icon"
          :size="60"
          :cooldown="skill1.cooldown"
          :current-cooldown="getCooldown(skill1.id)"
          :is-ready="isReady(skill1.id)"
          @press="handleSkillPress(skill1.id)"
        />
      </div>
      
      <div class="skill-slot skill-2" v-if="skill2">
        <div class="key-hint">W / 2</div>
        <SkillButton
          :skill-id="skill2.id"
          :name="skill2.name"
          :icon="skill2.icon"
          :size="60"
          :cooldown="skill2.cooldown"
          :current-cooldown="getCooldown(skill2.id)"
          :is-ready="isReady(skill2.id)"
          @press="handleSkillPress(skill2.id)"
        />
      </div>
      
      <div class="skill-slot skill-3" v-if="skill3">
        <div class="key-hint">E / 3</div>
        <SkillButton
          :skill-id="skill3.id"
          :name="skill3.name"
          :icon="skill3.icon"
          :size="60"
          :cooldown="skill3.cooldown"
          :current-cooldown="getCooldown(skill3.id)"
          :is-ready="isReady(skill3.id)"
          @press="handleSkillPress(skill3.id)"
        />
      </div>
    </div>
    
    <!-- 基本攻擊按鈕 (Space / 0) -->
    <div class="basic-slot" v-if="basicSkill">
      <div class="key-hint">Space / 0</div>
      <SkillButton
        :skill-id="basicSkill.id"
        :name="basicSkill.name"
        :icon="basicSkill.icon"
        :size="100"
        :cooldown="basicSkill.cooldown"
        :current-cooldown="getCooldown(basicSkill.id)"
        :is-ready="isReady(basicSkill.id)"
        @press="handleSkillPress(basicSkill.id)"
      />
    </div>
  </div>
  
  <!-- 無技能時的提示 -->
  <div class="skill-panel-empty" v-else>
    <span>載入技能中...</span>
  </div>
</template>

<style scoped>
.skill-panel {
  position: fixed;
  right: 20px;
  bottom: 40px;
  width: 320px;
  height: 320px;
  pointer-events: none; /* 讓底圖不阻擋點擊，按鈕自己有 pointer-events: auto */
  z-index: 100;
  
  /* 技能底板裝飾 */
  background: radial-gradient(circle at 100% 100%, rgba(30, 0, 60, 0.4) 0%, transparent 70%);
  border-radius: 100% 0 0 0;
  border-left: 1px solid rgba(255, 215, 0, 0.1);
  border-top: 1px solid rgba(255, 215, 0, 0.1);
}

.skill-panel-empty {
  position: fixed;
  right: 20px;
  bottom: 80px;
  padding: 15px 25px;
  background: var(--c-bg-panel);
  border: 1px solid var(--c-primary-dim);
  color: var(--c-text-gold);
  font-family: var(--font-heading);
  border-radius: 8px;
  z-index: 100;
  box-shadow: var(--shadow-glow);
  animation: fantasy-float 3s ease-in-out infinite;
}

.key-hint {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #aaa;
  background: rgba(0, 0, 0, 0.7);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

/* 大招 - 最上方 */
.ultimate-slot {
  position: absolute;
  bottom: 215px;
  right: 35px;
}

/* 技能圓弧排列 */
.skills-arc {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.skill-slot {
  position: absolute;
  pointer-events: auto;
}

/* 技能1（Q）- 籃板正上方 */
.skill-1 {
  bottom: 135px;
  right: 35px;
}

/* 技能2（W）- 籃板左上方 */
.skill-2 {
  bottom: 95px;
  right: 105px;
}

/* 技能3（E）- 籃板正左方 */
.skill-3 {
  bottom: 25px;
  right: 135px;
}

/* 籃板（基本攻擊）- 右下最大 */
.basic-slot {
  position: absolute;
  bottom: 15px;
  right: 15px;
  pointer-events: auto;
}
</style>
