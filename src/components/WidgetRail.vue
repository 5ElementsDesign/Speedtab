<script setup lang="ts">
import WeatherWidget from '@/components/WeatherWidget.vue'
import type { WidgetSettings } from '@/types/widgets'
import { computed } from 'vue'

const props = defineProps<{
  settings: WidgetSettings
  maxWidth: number | null
}>()

const emit = defineEmits<{
  configure: []
}>()

const showRail = computed(() => props.settings.rail_enabled)
const showWeatherWidget = computed(() => props.settings.weather.enabled)
const railStyle = computed<Record<string, string>>(() => {
  if (!props.maxWidth || props.maxWidth <= 0) {
    return { maxWidth: '100%' }
  }
  return { maxWidth: `${props.maxWidth}px` }
})
const railCenterStyle = computed<Record<string, string>>(() => ({
  justifyContent: props.settings.rail_align === 'center'
    ? 'center'
    : props.settings.rail_align === 'right'
      ? 'flex-end'
      : 'flex-start',
}))
</script>

<template>
  <section v-if="showRail" class="st-widget-rail" aria-label="Widgets">
    <div class="st-widget-rail-inner" :style="railStyle">
      <div class="st-widget-rail-center" :style="railCenterStyle">
        <WeatherWidget
          v-if="showWeatherWidget"
          :config="settings.weather"
          @configure="emit('configure')"
        />
        <div v-else class="st-widget-rail-placeholder" aria-hidden="true"></div>
      </div>
    </div>
  </section>
</template>
