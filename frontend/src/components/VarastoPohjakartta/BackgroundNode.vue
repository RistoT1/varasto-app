<script setup>
import { ref } from 'vue'

const props = defineProps({ data: Object })

const resolvedSrc = ref('/images/warehouse-map.jpg')

const img = new Image()
img.src = props.data.src
img.onload = () => { resolvedSrc.value = props.data.src }
</script>

<template>
  <div
    class="bg-node"
    :style="{
      width: data.width + 'px',
      height: data.height + 'px',
      backgroundImage: `url(${resolvedSrc})`,
    }"
  />
</template>

<style scoped>
.bg-node {
  background-size: contain;
  background-repeat: no-repeat;
  background-position: top left;
  pointer-events: none;
}
</style>