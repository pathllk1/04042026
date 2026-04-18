<script setup>
/**
 * PartySelectionModal.vue
 * Party selection modal with search, balance display, and multi-GSTIN support.
 * Location: app/components/sales/PartySelectionModal.vue
 *
 * Replaces: partyModal.js → openPartyModal() + openGstinSelector()
 *
 * The original used two stacked modals (modal-backdrop + a re-render of
 * modal-content). Here we use a single UModal with an internal two-step
 * view — 'parties' → 'gstin-select' — controlled by a local ref.
 *
 * Props
 *   open   {boolean}  v-model:open
 *   state  {object}   shared reactive sales state (parties, historyCache, etc.)
 *
 * Emits
 *   update:open                  (false)
 *   select-party  (party, gstin, locationObj)
 *   create-party  ()
 */

import { getPartyId } from '~/utils/salesUtils'
import { usePartyManager } from '~/composables/sales/usePartyManager'

const props = defineProps({
  open:  { type: Boolean, required: true },
  state: { type: Object,  required: true },
})

const emit = defineEmits(['update:open', 'select-party', 'create-party'])

const { fetchPartyBalance } = usePartyManager()

// ── View state ───────────────────────────────────────────────────────────────
// 'parties'      — main party list
// 'gstin-select' — GSTIN picker for a multi-GSTIN party

const view         = ref('parties')
const pendingParty = ref(null)   // party waiting for GSTIN selection

// ── Search ───────────────────────────────────────────────────────────────────

const searchTerm = ref('')

const filteredParties = computed(() => {
  const term = searchTerm.value.toLowerCase().trim()
  if (!term) return props.state.parties
  return props.state.parties.filter(
    (p) =>
      p.firm.toLowerCase().includes(term) ||
      (p.gstin || '').toLowerCase().includes(term),
  )
})

// ── Balance cache ────────────────────────────────────────────────────────────
// Keyed by partyId — loaded lazily when the party list renders.

const balanceMap  = ref({})   // { partyId: { balance, balanceType, balanceFormatted } }
const loadingBals = ref({})   // { partyId: true } while in-flight

async function loadBalance(party) {
  const id = String(getPartyId(party))
  if (balanceMap.value[id] || loadingBals.value[id]) return

  loadingBals.value[id] = true
  balanceMap.value[id]  = await fetchPartyBalance(id)
  delete loadingBals.value[id]
}

// Load balances whenever filteredParties changes
watch(
  filteredParties,
  (parties) => parties.forEach(loadBalance),
  { immediate: true },
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function balanceColor(party) {
  const id  = String(getPartyId(party))
  const bal = balanceMap.value[id]
  if (!bal) return 'text-gray-600'
  return bal.balanceType === 'Debit'
    ? 'text-red-600'
    : bal.balanceType === 'Credit'
      ? 'text-green-600'
      : 'text-gray-600'
}

function balanceSymbol(party) {
  const id  = String(getPartyId(party))
  const bal = balanceMap.value[id]
  if (!bal) return '—'
  return bal.balanceType === 'Debit' ? '↑' : bal.balanceType === 'Credit' ? '↓' : '—'
}

// ── Party selection ───────────────────────────────────────────────────────────

function onPartyClick(party) {
  const hasMultiGst =
    Array.isArray(party.gstLocations) && party.gstLocations.length > 0

  if (hasMultiGst) {
    // Show the GSTIN picker step
    pendingParty.value = party
    view.value         = 'gstin-select'
  } else {
    // Single GSTIN — select directly
    const locationObj = {
      gstin:      party.gstin,
      state:      party.state,
      state_code: party.state_code,
      address:    party.addr,
      pincode:    party.pin,
      contact:    party.contact,
      is_primary: true,
    }
    confirmSelection(party, party.gstin, locationObj)
  }
}

function onGstinSelect(gstin) {
  const party    = pendingParty.value
  const location = party.gstLocations?.find((l) => l.gstin === gstin) || null
  confirmSelection(party, gstin, location)
}

function confirmSelection(party, gstin, locationObj) {
  props.state.selectedParty         = party
  props.state.selectedPartyGstin    = gstin
  props.state.selectedPartyLocation = locationObj
  props.state.historyCache          = {}

  emit('select-party', party, gstin, locationObj)
  emit('update:open', false)
}

// ── Reset on open ────────────────────────────────────────────────────────────

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      view.value         = 'parties'
      pendingParty.value = null
      searchTerm.value   = ''
    }
  },
)

// ── Misc ─────────────────────────────────────────────────────────────────────

function allGstins(party) {
  const locs = Array.isArray(party.gstLocations) ? party.gstLocations : []
  if (locs.length > 0) return locs
  if (party.gstin && party.gstin !== 'UNREGISTERED') {
    return [{
      gstin:      party.gstin,
      state:      party.state,
      address:    party.addr,
      city:       '',
      pincode:    party.pin,
      contact:    party.contact,
      is_primary: true,
      state_code: party.state_code,
      pan:        party.pan,
    }]
  }
  return []
}

function gstinListLabel(party) {
  const locs = Array.isArray(party.gstLocations) ? party.gstLocations : []
  return locs.map((l) => l.gstin).join(', ')
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ width: 'max-w-3xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <!-- ════════════════════════════════════════════════════════════════════
         STEP 1 — Party list
    ═════════════════════════════════════════════════════════════════════ -->
    <template v-if="view === 'parties'">

      <!-- Header -->
      <template #header>
        <div class="flex items-center justify-between w-full gap-3">
          <h3 class="font-bold text-base text-gray-800 shrink-0">Select Party</h3>

          <div class="flex items-center gap-2 flex-1 justify-end">
            <!-- Search -->
            <UInput
              v-model="searchTerm"
              placeholder="Search firm name or GSTIN…"
              icon="i-lucide-search"
              size="sm"
              class="flex-1 max-w-sm"
              autofocus
            />

            <!-- New party -->
            <UButton
              icon="i-lucide-plus"
              label="New Party"
              size="sm"
              color="primary"
              @click="$emit('create-party'); $emit('update:open', false)"
            />

            <!-- Close -->
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="$emit('update:open', false)"
            />
          </div>
        </div>
      </template>

      <!-- Body -->
      <div class="p-3 grid gap-2 bg-gray-50 max-h-[65vh] overflow-y-auto">

        <!-- Empty state -->
        <div
          v-if="filteredParties.length === 0"
          class="flex flex-col items-center justify-center py-12 text-gray-300"
        >
          <UIcon name="i-lucide-users" class="w-10 h-10 mb-2" />
          <p class="text-sm text-gray-400 italic">No parties found. Create a new one.</p>
        </div>

        <!-- Party cards -->
        <div
          v-for="party in filteredParties"
          :key="getPartyId(party)"
          class="border border-gray-200 p-3 rounded-xl hover:border-blue-400
                 hover:shadow-md cursor-pointer flex justify-between items-center
                 transition-all bg-white group"
          @click="onPartyClick(party)"
        >
          <div class="min-w-0 flex-1">

            <!-- Firm name -->
            <div class="font-bold text-blue-900 text-sm group-hover:text-blue-700 truncate">
              {{ party.firm }}
            </div>

            <!-- GSTIN badges -->
            <div class="flex items-center flex-wrap gap-1.5 mt-1">
              <span
                v-if="Array.isArray(party.gstLocations) && party.gstLocations.length > 0"
                class="text-[10px] font-mono bg-blue-50 px-1.5 py-0.5 rounded
                       border border-blue-200 text-blue-600 font-bold"
              >
                Multi-GST ({{ party.gstLocations.length }})
              </span>
              <span
                v-else
                class="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded
                       border border-gray-200 text-gray-600"
              >
                {{ party.gstin }}
              </span>
              <span class="text-[10px] text-gray-400">{{ party.state }}</span>
            </div>

            <!-- Address -->
            <div class="text-[10px] text-gray-400 mt-1 truncate max-w-xs">
              {{ party.addr }}
            </div>

            <!-- Multi-GSTIN list -->
            <div
              v-if="Array.isArray(party.gstLocations) && party.gstLocations.length > 0"
              class="text-[9px] text-gray-500 mt-1 font-mono"
            >
              GSTINs: {{ gstinListLabel(party) }}
            </div>

            <!-- Balance -->
            <div class="mt-2 flex items-center gap-2">
              <span class="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Balance:</span>
              <span
                v-if="loadingBals[String(getPartyId(party))]"
                class="text-[9px] text-gray-400"
              >Loading…</span>
              <span
                v-else-if="balanceMap[String(getPartyId(party))]"
                class="font-mono font-bold text-[9px]"
                :class="balanceColor(party)"
              >
                ₹{{ Math.abs(balanceMap[String(getPartyId(party))].balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                {{ balanceSymbol(party) }}
                {{ balanceMap[String(getPartyId(party))].balanceType }}
              </span>
            </div>

          </div>

          <!-- Arrow -->
          <span class="shrink-0 text-[10px] font-bold bg-blue-50 text-blue-600
                       border border-blue-100 px-2.5 py-1 rounded-full
                       opacity-0 group-hover:opacity-100 transition-all ml-3">
            SELECT →
          </span>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════════════════
         STEP 2 — GSTIN selector (multi-GSTIN parties)
    ═════════════════════════════════════════════════════════════════════ -->
    <template v-else-if="view === 'gstin-select'">

      <!-- Header -->
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="view = 'parties'"
            />
            <h3 class="font-bold text-base text-gray-800">
              Select GST Location
              <span class="text-gray-400 font-normal text-sm ml-1">
                ({{ allGstins(pendingParty).length }})
              </span>
            </h3>
          </div>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="$emit('update:open', false)"
          />
        </div>
      </template>

      <!-- GSTIN cards -->
      <div class="flex-1 overflow-y-auto p-3 grid gap-2 bg-gray-50 max-h-[65vh]">
        <div
          v-for="(loc, idx) in allGstins(pendingParty)"
          :key="idx"
          class="border border-gray-200 p-3 rounded-xl hover:border-blue-400
                 hover:shadow-md cursor-pointer flex justify-between items-center
                 transition-all bg-white group"
          @click="onGstinSelect(loc.gstin)"
        >
          <div class="min-w-0 flex-1">
            <div class="font-bold text-blue-900 text-sm group-hover:text-blue-700">
              {{ loc.gstin }}
            </div>
            <div class="text-[10px] text-gray-500 mt-1">{{ loc.state }}</div>
            <div class="text-[10px] text-gray-400 mt-1">{{ loc.address }}</div>
            <span
              v-if="loc.is_primary"
              class="text-[9px] font-bold text-green-600 mt-1 inline-block"
            >
              ★ Primary
            </span>
          </div>

          <span class="shrink-0 text-[10px] font-bold bg-blue-50 text-blue-600
                       border border-blue-100 px-2.5 py-1 rounded-full
                       opacity-0 group-hover:opacity-100 transition-all ml-3">
            SELECT →
          </span>
        </div>
      </div>

    </template>
  </UModal>
</template>