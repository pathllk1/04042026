<template>
  <div :class="className" v-bind="$attrs" ref="htmlContainer"></div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { sanitizeHtml } from '~/utils/sanitize';

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
  if (htmlContainer.value) {
    // Sanitize the HTML content
    let sanitizedHtml = sanitizeHtml(props.content);

    // Check if the content contains HTML tags or is just plain text with HTML entities
    if (props.content.includes('&lt;') && props.content.includes('&gt;')) {
      // If it contains HTML entities, decode them first
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = props.content;
      const decodedContent = tempDiv.textContent;

      // Then sanitize the decoded content
      sanitizedHtml = sanitizeHtml(decodedContent);
    }

    htmlContainer.value.innerHTML = sanitizedHtml;
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
