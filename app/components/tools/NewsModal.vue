<template>
  <UModal
    :open="isOpen"
    @update:open="emit('close')"
    :ui="{
      content: 'max-w-4xl max-h-[90vh] overflow-hidden',
      overlay: { base: 'z-[99999]' },
      wrapper: { base: 'z-[99999]' }
    }"
  >
    <template #content>
      <div class="bg-white rounded-lg shadow-xl w-full h-full overflow-hidden flex flex-col relative">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex justify-between items-center shrink-0">
          <h2 class="text-xl font-bold text-white flex items-center">
            <UIcon name="i-lucide-newspaper" class="mr-2" />
            Global News Pulse
          </h2>
          <button @click="emit('close')" class="text-white hover:bg-white/20 p-1 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Topic Tabs -->
        <div class="flex border-b overflow-x-auto bg-gray-50 shrink-0 hide-scrollbar">
          <button
            v-for="topic in newsTopics"
            :key="topic.id"
            @click="activeTopic = topic.id"
            class="px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-300 border-b-2"
            :class="activeTopic === topic.id 
              ? 'text-indigo-600 border-indigo-600 bg-white' 
              : 'text-gray-500 border-transparent hover:text-indigo-400 hover:bg-gray-100'"
          >
            {{ topic.name }}
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 bg-gray-50 relative">
          <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p class="text-gray-500 font-medium animate-pulse">Fetching latest headlines...</p>
          </div>

          <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <UIcon name="i-lucide-alert-circle" class="mr-2 text-xl" />
            <span>{{ error }}</span>
            <button @click="fetchNews" class="ml-auto underline text-sm font-bold">Retry</button>
          </div>

          <div v-else class="grid gap-6">
            <div 
              v-for="(item, index) in newsItems" 
              :key="index"
              class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 group"
            >
              <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">
                  {{ item.source }}
                </span>
                <span class="text-[10px] text-gray-400 font-bold">
                  {{ formatDate(item.pubDate) }}
                </span>
              </div>
              
              <h3 class="text-base font-bold text-gray-900 mb-2 leading-snug group-hover:text-indigo-600 transition-colors">
                <a :href="item.link" target="_blank" class="hover:underline">{{ item.title }}</a>
              </h3>
              
              <div class="text-xs text-gray-600 line-clamp-4 leading-relaxed news-description" v-html="item.description"></div>
              
              <div class="mt-4 flex items-center justify-end">
                <a 
                  :href="item.link" 
                  target="_blank"
                  class="inline-flex items-center text-[10px] font-black text-indigo-600 uppercase tracking-tighter hover:tracking-normal transition-all"
                >
                  Read Full Article
                  <UIcon name="i-lucide-arrow-right" class="ml-1 text-sm" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 bg-white border-t flex justify-between items-center shrink-0">
          <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Powered by Google News RSS</p>
          <button @click="fetchNews" class="text-indigo-600 hover:text-indigo-800 flex items-center text-xs font-black uppercase tracking-tighter">
            <UIcon name="i-lucide-refresh-cw" class="mr-1" :class="{ 'animate-spin': isLoading }" />
            Refresh
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

const newsItems = ref([]);
const isLoading = ref(false);
const error = ref(null);
const activeTopic = ref('indian-politics');

const newsTopics = [
  { id: 'indian-politics', name: '🇮🇳 Indian Politics' },
  { id: 'world-politics', name: '🌍 World Politics' },
  { id: 'indian-stock-market', name: '📈 Stock Market' },
  { id: 'indian-finance', name: '💰 Finance' },
  { id: 'it-tech', name: '💻 IT & Tech' }
];

const fetchNews = async () => {
  if (!props.isOpen) return;
  
  isLoading.value = true;
  error.value = null;
  
  try {
    const data = await $fetch('/api/news/rss', {
      query: { topic: activeTopic.value }
    });
    
    if (data.success) {
      newsItems.value = data.news;
    } else {
      throw new Error('Failed to fetch news');
    }
  } catch (err) {
    console.error('News Fetch Error:', err);
    error.value = 'Failed to load news. Please try again later.';
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    fetchNews();
  }
});

watch(activeTopic, () => {
  fetchNews();
});
</script>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Clean up Google News RSS HTML description */
.news-description :deep(ul), 
.news-description :deep(ol) {
  display: none;
}
</style>
