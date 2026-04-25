<script setup>
/**
 * PartyCard.vue
 * Displays the selected party with balance, bill-type badge, and action buttons.
 * Also shows an empty "Select Party" prompt when no party is selected.
 * Location: app/components/sales/PartyCard.vue
 *
 * Replaces: layoutRenderer.js → renderPartyCard()
 *
 * Props
 *   state         {object}   shared reactive sales state
 *   isReturnMode  {boolean}
 *
 * Emits
 *   change-party   ()  — open PartySelectionModal
 *   edit-party     ()  — open suppliers page in new tab
 */

import { ref, watch, computed } from 'vue'
import { getPartyId }       from '~/utils/salesUtils'
import { usePartyManager }  from '~/composables/sales/usePartyManager'

const props = defineProps({
  state:        { type: Object,  required: true },
  isReturnMode: { type: Boolean, default: false },
})

const emit = defineEmits(['change-party', 'edit-party'])

const { fetchPartyBalance } = usePartyManager()

// ── Balance ───────────────────────────────────────────────────────────────────

const balance        = ref(null)   // { balance, balanceType, balanceFormatted }
const loadingBalance = ref(false)

async function loadBalance() {
  const id = getPartyId(props.state.selectedParty)
  if (!id) { balance.value = null; return }

  loadingBalance.value = true
  balance.value        = await fetchPartyBalance(String(id))
  loadingBalance.value = false
}

// Reload balance when the selected party changes
watch(
  () => props.state.selectedParty,
  (party) => { if (party) loadBalance(); else balance.value = null },
  { immediate: true },
)

// ── Bill-type badge ───────────────────────────────────────────────────────────

const billTypeBadge = computed(() => {
  const bt = props.state.meta?.billType
  if (bt === 'intra-state') {
    return { label: 'Local', class: 'bg-green-100 text-green-800 border-green-200' }
  }
  if (bt === 'inter-state') {
    return { label: 'Out of State', class: 'bg-orange-100 text-orange-800 border-orange-200' }
  }
  return null
})

// ── Balance colour ────────────────────────────────────────────────────────────

const balanceClass = computed(() => {
  if (!balance.value) return 'bg-gray-100 text-gray-600 border-gray-200'
  return balance.value.balance >= 0
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-red-100 text-red-800 border-red-200'
})
</script>

<template>
  <!-- ── No party selected ─────────────────────────────────────────────────── -->
  <button
    v-if="!state.selectedParty"
    class="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg
           text-gray-400 hover:border-blue-400 hover:text-blue-600
           hover:bg-blue-50 transition-all flex flex-col items-center
           justify-center gap-2 group"
    @click="emit('change-party')"
  >
    <span class="text-2xl group-hover:scale-110 transition-transform font-light">+</span>
    <span class="text-xs font-semibold uppercase tracking-wide">Select Party</span>
  </button>

  <!-- ── Party card ─────────────────────────────────────────────────────────── -->
  <div
    v-else
    class="group bg-blue-50 p-3 rounded border border-blue-200 shadow-sm"
  >

    <!-- Header row: firm name + action buttons -->
    <div class="flex justify-between items-start">
      <h3
        class="font-bold text-sm text-blue-900 truncate flex-1"
        :title="state.selectedParty.supply"
      >
        {{ state.selectedParty.supply }}
      </h3>

      <div v-if="!isReturnMode" class="flex gap-1.5 ml-2 shrink-0">
        <!-- Edit party -->
        <UButton
          icon="i-lucide-pencil"
          color="success"
          variant="ghost"
          size="xs"
          title="Edit Party"
          @click="emit('edit-party')"
        />
        <!-- Change party -->
        <UButton
          icon="i-lucide-refresh-cw"
          color="primary"
          variant="ghost"
          size="xs"
          title="Change Party"
          @click="emit('change-party')"
        />
      </div>
    </div>

    <!-- Address -->
    <p class="text-[11px] text-gray-600 truncate mt-1">
      {{ state.selectedPartyLocation?.address || state.selectedParty.addr || '' }}
    </p>

    <!-- GSTIN + bill-type badge -->
    <div class="flex items-center gap-2 mt-2 flex-wrap">
      <span class="bg-blue-100 text-blue-800 text-[10px] font-mono
                   px-2 py-0.5 rounded border border-blue-200">
        GST: {{ state.selectedPartyGstin || state.selectedParty.gstin || '' }}
      </span>

      <span
        v-if="billTypeBadge"
        class="text-[10px] font-bold px-2 py-0.5 rounded border"
        :class="billTypeBadge.class"
        :title="billTypeBadge.label === 'Local'
          ? 'Same state — CGST + SGST applies'
          : 'Different state — IGST applies'"
      >
        {{ billTypeBadge.label }}
      </span>
    </div>

    <!-- Balance -->
    <div class="flex items-center gap-2 mt-2">
      <span
        v-if="loadingBalance"
        class="text-[10px] text-gray-400"
      >
        Loading balance…
      </span>
      <span
        v-else-if="balance"
        class="text-[10px] font-mono px-2 py-0.5 rounded border"
        :class="balanceClass"
      >
        BAL: {{ balance.balanceType }} {{ balance.balanceFormatted }}
      </span>
    </div>

  </div>
</template>