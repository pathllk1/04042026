<script setup>
/**
 * ColFilterBtn.vue
 * Excel-style column filter button with Teleport'd dropdown.
 * Location: app/components/inventory/ColFilterBtn.vue
 *
 * Props
 *   col        string   Column key
 *   label      string   Column label shown in dropdown header
 *   type       string   'text' | 'choice' | 'number'
 *   allValues  array    All unique values from the full dataset
 *   modelValue          Current filter: Set|null (text) or {min,max}|null (number)
 *   active     boolean  Whether a filter is currently applied on this column
 *
 * Emits
 *   update:modelValue  new filter state
 *   apply
 *   clear
 */

const props = defineProps({
  col:        { type: String,  required: true },
  label:      { type: String,  required: true },
  type:       { type: String,  default: 'text' },
  allValues:  { type: Array,   default: () => [] },
  modelValue: { default: null },
  active:     { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'apply', 'clear'])

// ── Dropdown visibility + position ────────────────────────────────────────────

const isOpen        = ref(false)
const dropdownStyle = ref({ top: '0px', left: '0px' })
const btnEl         = ref(null)   // template ref on the trigger button

function openDropdown() {
  initDraft()
  isOpen.value = true
  nextTick(() => {
    if (!btnEl.value) return
    const rect = btnEl.value.getBoundingClientRect()
    const ddW  = 256    // w-64
    const ddH  = 384    // max-h-96
    let top    = rect.bottom + 6
    let left   = rect.left
    if (top  + ddH > window.innerHeight - 16) top  = Math.max(8, rect.top - ddH - 6)
    if (left + ddW > window.innerWidth  - 16) left = Math.max(8, window.innerWidth - ddW - 16)
    dropdownStyle.value = { top: top + 'px', left: left + 'px', position: 'fixed', zIndex: 9999 }
  })
}

// ── Draft state ───────────────────────────────────────────────────────────────

const numMin      = ref('')
const numMax      = ref('')
const checkedSet  = ref(new Set())
const searchQuery = ref('')

function initDraft() {
  searchQuery.value = ''
  if (props.type === 'number') {
    numMin.value = props.modelValue?.min ?? ''
    numMax.value = props.modelValue?.max ?? ''
  } else {
    const cur = props.modelValue
    checkedSet.value = cur instanceof Set
      ? new Set(cur)
      : new Set(props.allValues.map(String))
  }
}

// ── Computed ──────────────────────────────────────────────────────────────────

const filteredValues = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.allValues
  return props.allValues.filter(v => String(v).toLowerCase().includes(q))
})

const selectAllChecked = computed(() => {
  const vis = filteredValues.value
  return vis.length > 0 && vis.every(v => checkedSet.value.has(String(v)))
})

const selectAllIndeterminate = computed(() => {
  const vis = filteredValues.value
  const cnt = vis.filter(v => checkedSet.value.has(String(v))).length
  return cnt > 0 && cnt < vis.length
})

// ── Checkbox helpers ──────────────────────────────────────────────────────────

function toggleAll(checked) {
  const next = new Set(checkedSet.value)
  filteredValues.value.forEach(v => {
    if (checked) next.add(String(v))
    else         next.delete(String(v))
  })
  checkedSet.value = next
}

function toggleOne(val, checked) {
  const next = new Set(checkedSet.value)
  if (checked) next.add(String(val))
  else         next.delete(String(val))
  checkedSet.value = next
}

// ── Apply / clear ─────────────────────────────────────────────────────────────

function applyFilter() {
  let newState = null

  if (props.type === 'number') {
    const min = numMin.value.trim()
    const max = numMax.value.trim()
    newState = (min === '' && max === '') ? null : { min, max }
  } else {
    const all     = props.allValues.map(String)
    const checked = all.filter(v => checkedSet.value.has(v))
    newState = checked.length === all.length
      ? null
      : new Set(checked)
  }

  emit('update:modelValue', newState)
  emit('apply')
  isOpen.value = false
}

function clearFilter() {
  emit('update:modelValue', null)
  emit('clear')
  isOpen.value = false
}
</script>

<template>
  <div class="relative inline-flex">

    <!-- Trigger button -->
    <button
      ref="btnEl"
      type="button"
      class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
             hover:bg-white/20 transition relative"
      :class="active ? 'text-amber-300' : 'text-white opacity-60 hover:opacity-100'"
      :title="`Filter ${label}`"
      @click.stop="openDropdown"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="w-3 h-3"
      >
        <path
          fill-rule="evenodd"
          d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z"
          clip-rule="evenodd"
        />
      </svg>
      <span
        v-if="active"
        class="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full
               text-[8px] font-bold text-gray-900 flex items-center justify-center"
      >!</span>
    </button>

    <!-- Teleport'd dropdown -->
    <Teleport to="body">
      <!-- Click-outside backdrop -->
      <div
        v-if="isOpen"
        class="fixed inset-0"
        style="z-index: 9998"
        @click="isOpen = false"
      />

      <!-- Dropdown panel -->
      <div
        v-if="isOpen"
        class="w-64 max-h-96 flex flex-col overflow-hidden bg-white
               border border-gray-200 rounded-xl
               shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)]"
        :style="dropdownStyle"
        @click.stop
      >
        <!-- Header -->
        <div class="flex flex-shrink-0 items-center justify-between
                    px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <span class="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
            {{ label }}
          </span>
          <button
            type="button"
            class="w-5 h-5 flex items-center justify-center rounded text-gray-400
                   hover:text-gray-700 hover:bg-gray-200 transition"
            @click="isOpen = false"
          >
            <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto flex-1 px-2 py-2">

          <!-- NUMBER range -->
          <template v-if="type === 'number'">
            <p class="text-[10px] text-gray-400 uppercase tracking-wide px-0.5 mb-1.5">
              Filter by range
            </p>
            <div class="flex gap-2">
              <div class="flex-1 min-w-0">
                <label class="block text-[10px] text-gray-500 mb-0.5">Min</label>
                <input
                  v-model="numMin"
                  type="number"
                  placeholder="0"
                  class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                />
              </div>
              <div class="flex-1 min-w-0">
                <label class="block text-[10px] text-gray-500 mb-0.5">Max</label>
                <input
                  v-model="numMax"
                  type="number"
                  placeholder="Any"
                  class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                />
              </div>
            </div>
          </template>

          <!-- TEXT / CHOICE checkbox list -->
          <template v-else>
            <div class="relative mb-1.5">
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="`Search ${label}…`"
                class="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white
                       focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              />
              <UIcon
                name="i-lucide-search"
                class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                       text-gray-400 pointer-events-none"
              />
            </div>

            <div class="border-b border-gray-100 pb-1 mb-1">
              <label class="flex items-center gap-2 px-1 py-1 rounded cursor-pointer
                            select-none hover:bg-gray-50 w-full">
                <input
                  type="checkbox"
                  class="w-3.5 h-3.5 flex-shrink-0 cursor-pointer accent-emerald-600"
                  :checked="selectAllChecked"
                  :indeterminate="selectAllIndeterminate"
                  @change="toggleAll($event.target.checked)"
                />
                <span class="text-xs font-semibold text-gray-700">Select All</span>
                <span class="ml-auto text-[10px] text-gray-400">{{ filteredValues.length }}</span>
              </label>
            </div>

            <div class="flex flex-col gap-px">
              <label
                v-for="val in filteredValues"
                :key="val"
                class="flex items-center gap-2 px-1 py-1 rounded cursor-pointer
                       select-none hover:bg-gray-50 w-full"
              >
                <input
                  type="checkbox"
                  class="w-3.5 h-3.5 flex-shrink-0 cursor-pointer accent-emerald-600"
                  :checked="checkedSet.has(String(val))"
                  @change="toggleOne(val, $event.target.checked)"
                />
                <span
                  class="text-xs text-gray-800 min-w-0 flex-1 truncate"
                  :title="String(val)"
                >{{ val }}</span>
              </label>

              <p
                v-if="filteredValues.length === 0"
                class="text-[11px] text-gray-400 text-center py-3"
              >
                No values found
              </p>
            </div>
          </template>

        </div>

        <!-- Footer -->
        <div class="flex flex-shrink-0 gap-2 px-3 py-2
                    border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            class="flex-1 py-1.5 text-[11px] font-semibold
                   bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
            @click="applyFilter"
          >
            Apply
          </button>
          <button
            type="button"
            class="flex-1 py-1.5 text-[11px] font-medium bg-white hover:bg-gray-50
                   text-gray-600 border border-gray-300 rounded-lg transition"
            @click="clearFilter"
          >
            Clear
          </button>
        </div>
      </div>
    </Teleport>

  </div>
</template>