<script setup lang="ts">
import { ref, computed } from 'vue'
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

// State
const comboMode = ref(false)
const comboSkillId = ref<string | null>(null)
const comboIcon = ref('💥')

// Computed
const basicSkill = computed(() => props.skills.find(s => s.id === 'basic'))
const skill1 = computed(() => props.skills.find(s => s.id === 'skill1'))
const skill2 = computed(() => props.skills.find(s => s.id === 'skill2'))
const skill3 = computed(() => props.skills.find(s => s.id === 'skill3'))
const ultimateSkill = computed(() => props.skills.find(s => s.id === 'ultimate'))

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

// 暴露方法給父元件呼叫
const activateComboMode = (comboSkill: string, icon: string) => {
  comboMode.value = true
  comboSkillId.value = comboSkill
  comboIcon.value = icon
}

const deactivateComboMode = () => {
  comboMode.value = false
  comboSkillId.value = null
}

defineExpose({
  activateComboMode,
  deactivateComboMode
})
</script>

<template>
  <div class="skill-panel">
    <!-- 大招按鈕（最上方） -->
    <div class="ultimate-slot" v-if="ultimateSkill">
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
    
    <!-- 基本攻擊按鈕（最大最下方） -->
    <div class="basic-slot" v-if="basicSkill">
      <SkillButton
        :skill-id="basicSkill.id"
        :name="basicSkill.name"
        :icon="basicSkill.icon"
        :size="100"
        :cooldown="basicSkill.cooldown"
        :current-cooldown="getCooldown(basicSkill.id)"
        :is-ready="isReady(basicSkill.id)"
        :is-combo-mode="comboMode"
        :combo-icon="comboIcon"
        @press="handleSkillPress(comboMode && comboSkillId ? comboSkillId : basicSkill.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.skill-panel {
  position: fixed;
  right: 20px;
  bottom: 40px;
  width: 280px;
  height: 420px;
  pointer-events: auto;
  z-index: 100;
}

/* 決勝三分（大招）- 加速正上方 */
.ultimate-slot {
  position: absolute;
  bottom: 215px;
  right: 35px;
}

/* 技能圓弧排列（緊密包圍籃板左上方） */
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

/* 加速1（突進）- 籃板正上方，微偏左 */
.skill-1 {
  bottom: 135px;
  right: 35px;
}

/* 檔拆2（震地）- 籃板左上方（夾在中間） */
.skill-2 {
  bottom: 95px;
  right: 105px;
}

/* 卡位3（格檔）- 籃板正左方，微偏下 */
.skill-3 {
  bottom: 25px;
  right: 135px;
}

/* 籃板4（基本攻擊）- 右下最大 */
.basic-slot {
  position: absolute;
  bottom: 15px;
  right: 15px;
  pointer-events: auto;
}
</style>




