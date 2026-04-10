<template>
  <div :class="className" v-bind="$attrs" ref="htmlContainer"></div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  className: {
    type: String,
    default: ''
  }
});

const htmlContainer = ref(null);

// Function to update the HTML content safely
const updateHtml = () => {
  if (htmlContainer.value && props.content) {
    // Check if the content contains HTML entities
    let processedContent = props.content;

    // If it contains HTML entities, decode them
    if (props.content.includes('&lt;') && props.content.includes('&gt;')) {
      // Create a temporary div to decode the HTML entities
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = props.content;

      // Get the decoded content
      processedContent = tempDiv.textContent || '';
    }

    // Set the content
    htmlContainer.value.innerHTML = processedContent;
  }
};

// Update the HTML when the component is mounted
onMounted(() => {
  updateHtml();
});

// Watch for changes to the content prop
watch(() => props.content, () => {
  updateHtml();
});
</script>

<style scoped>
/* Add any styling needed for the HTML container */
</style>
