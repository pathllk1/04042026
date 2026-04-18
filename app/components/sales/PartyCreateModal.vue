<script setup>
/**
 * PartyCreateModal.vue
 * Create a new party with optional multi-GSTIN location support.
 * Location: app/components/sales/PartyCreateModal.vue
 *
 * Replaces: partyCreate.js → openCreatePartyModal()
 *
 * Props
 *   open  {boolean}  v-model:open
 *
 * Emits
 *   update:open
 *   saved  (partyData)  — parent pushes to state.parties and selects it
 *
 * POST /api/inventory/sales/parties       → useApiWithAuth().post()
 * POST /api/inventory/sales/gst-lookup    → via usePartyManager().fetchGSTDetails()
 */

import { INDIA_STATE_CODES }         from '~/composables/sales/useSalesState'
import { usePartyManager }            from '~/composables/sales/usePartyManager'
import useApiWithAuth                 from '~/composables/auth/useApiWithAuth'

const props = defineProps({
  open: { type: Boolean, required: true },
})

const emit = defineEmits(['update:open', 'saved'])

const { post }                                          = useApiWithAuth()
const { fetchingGst, fetchGSTDetails,
        extractPartyFieldsFromGSTData,
        extractLocationFieldsFromGSTData }              = usePartyManager()
const toast                                             = useToast()

// ── Form state ────────────────────────────────────────────────────────────────

const saving = ref(false)

const form = reactive({
  firm:       '',
  gstin:      '',
  contact:    '',
  pan:        '',
  addr:       '',
  state:      '',
  pin:        '',
  state_code: '',  // derived from GSTIN or state name
})

// ── Additional GST locations ──────────────────────────────────────────────────

const gstLocations = ref([])   // [{ gstin, state, address, pin, is_primary }]

function addGstLocation() {
  gstLocations.value.push({ gstin: '', state: '', address: '', pin: '', is_primary: false })
}

function removeGstLocation(idx) {
  gstLocations.value.splice(idx, 1)
}

function updateLocationField(idx, field, value) {
  gstLocations.value[idx][field] = value
}

function setPrimary(idx, checked) {
  gstLocations.value.forEach((loc, i) => {
    loc.is_primary = i === idx ? checked : false
  })
}

// ── GSTIN auto-derive ─────────────────────────────────────────────────────────

function onGstinInput(val) {
  form.gstin = val.toUpperCase()
  if (val.length >= 2 && /^\d{2}/.test(val)) {
    form.state_code = val.substring(0, 2)
  } else if (val.length < 2) {
    form.state_code = ''
  }
  if (val.length >= 12) {
    form.pan = val.substring(2, 12)
  }
}

function onStateInput(val) {
  // Only derive state_code from state name if GSTIN hasn't already set it
  if (form.gstin.length >= 2) return
  form.state_code = INDIA_STATE_CODES[val.trim().toLowerCase()] ?? ''
}

// ── GST lookup — primary party ────────────────────────────────────────────────

async function fetchPrimaryGST() {
  try {
    const data   = await fetchGSTDetails(form.gstin)
    const fields = extractPartyFieldsFromGSTData(data, form.gstin)
    if (!fields) {
      toast.add({ title: 'No valid company name found in API response.', color: 'error' })
      return
    }
    form.firm       = fields.firm
    form.addr       = fields.addr
    form.state      = fields.state
    form.pin        = fields.pin
    form.state_code = fields.stateCode
    form.pan        = fields.pan
    toast.add({ title: 'GST details fetched!', color: 'success' })
  } catch (err) {
    toast.add({ title: err.message || 'Failed to fetch GST details', color: 'error' })
  }
}

// ── GST lookup — additional location ─────────────────────────────────────────

const fetchingLocGst = ref({})   // { idx: true } while in-flight

async function fetchLocationGST(idx) {
  const loc   = gstLocations.value[idx]
  const gstin = (loc.gstin || '').trim().toUpperCase()

  if (!gstin || gstin.length !== 15) {
    toast.add({ title: 'Please enter a valid 15-character GSTIN', color: 'error' })
    return
  }

  fetchingLocGst.value = { ...fetchingLocGst.value, [idx]: true }
  try {
    const data   = await fetchGSTDetails(gstin)
    const fields = extractLocationFieldsFromGSTData(data, gstin)
    gstLocations.value[idx].state   = fields.state
    gstLocations.value[idx].address = fields.address
    gstLocations.value[idx].pin     = fields.pin
    toast.add({ title: 'GST details fetched!', color: 'success' })
  } catch (err) {
    toast.add({ title: err.message || 'Failed to fetch GST details', color: 'error' })
  } finally {
    const updated = { ...fetchingLocGst.value }
    delete updated[idx]
    fetchingLocGst.value = updated
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function onSubmit() {
  if (!form.firm.trim()) {
    toast.add({ title: 'Firm name is required', color: 'error' })
    return
  }

  saving.value = true
  try {
    const payload = {
      firm:         form.firm.trim(),
      gstin:        form.gstin.trim() || 'UNREGISTERED',
      contact:      form.contact.trim() || undefined,
      pan:          form.pan.trim()     || undefined,
      addr:         form.addr.trim()    || undefined,
      state:        form.state.trim()   || undefined,
      supply:       form.state.trim()   || undefined,  // backend alias
      pin:          form.pin.trim()     || undefined,
      state_code:   form.state_code
        ? form.state_code.toString().padStart(2, '0')
        : null,
      gstLocations: gstLocations.value,
    }

    const result = await post('/api/inventory/sales/parties', payload)
    toast.add({ title: 'Party created successfully!', color: 'success' })
    emit('saved', result.data || result)
    emit('update:open', false)
  } catch (err) {
    toast.add({ title: 'Error creating party: ' + (err.message || 'Server error'), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── Reset on open ────────────────────────────────────────────────────────────

function resetForm() {
  Object.assign(form, {
    firm: '', gstin: '', contact: '', pan: '',
    addr: '', state: '', pin: '', state_code: '',
  })
  gstLocations.value = []
}

watch(() => props.open, (isOpen) => { if (isOpen) resetForm() })
</script>

<template>
  <UModal
    :open="open"
    :ui="{ width: 'max-w-xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div>
          <h3 class="font-bold text-sm text-white">Add New Party</h3>
          <p class="text-[10px] text-slate-400 mt-0.5">Fill in the details for the new party.</p>
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

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="p-4 space-y-3 overflow-y-auto max-h-[72vh]">

      <!-- Firm name -->
      <div>
        <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
          Firm Name *
        </label>
        <UInput v-model="form.firm" placeholder="e.g. M/S Global Enterprises" class="w-full" />
      </div>

      <!-- GSTIN + Fetch -->
      <div>
        <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
          GSTIN
        </label>
        <div class="flex gap-1">
          <UInput
            :model-value="form.gstin"
            placeholder="27ABCDE1234F1Z5"
            maxlength="15"
            class="flex-1 font-mono uppercase"
            @update:model-value="onGstinInput($event)"
          />
          <UButton
            label="Fetch"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="fetchingGst"
            :disabled="form.gstin.length !== 15"
            @click="fetchPrimaryGST"
          />
        </div>
      </div>

      <!-- Contact + PAN -->
      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Contact
          </label>
          <UInput v-model="form.contact" class="w-full" />
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
            PAN
          </label>
          <UInput v-model="form.pan" maxlength="10" class="w-full font-mono uppercase" />
        </div>
      </div>

      <!-- Address -->
      <div>
        <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
          Address
        </label>
        <UTextarea v-model="form.addr" :rows="2" class="w-full" />
      </div>

      <!-- State + Pincode -->
      <div class="grid grid-cols-3 gap-2.5">
        <div class="col-span-2">
          <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
            State *
          </label>
          <UInput
            :model-value="form.state"
            class="w-full"
            @update:model-value="val => { form.state = val; onStateInput(val) }"
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Pincode
          </label>
          <UInput v-model="form.pin" class="w-full" />
        </div>
      </div>

      <!-- ── Additional GST Locations ──────────────────────────────────────── -->
      <div class="pt-3 border-t border-slate-100">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Additional GST Locations
          </h4>
          <UButton
            label="+ Add"
            size="xs"
            color="primary"
            variant="outline"
            @click="addGstLocation"
          />
        </div>

        <div class="space-y-2">
          <!-- Empty hint -->
          <p
            v-if="gstLocations.length === 0"
            class="text-[10px] text-slate-400 italic text-center py-2"
          >
            No additional GST locations.
          </p>

          <!-- Location cards -->
          <div
            v-for="(loc, idx) in gstLocations"
            :key="idx"
            class="border border-slate-200 rounded-lg p-3 bg-slate-50 relative"
          >
            <!-- Remove button -->
            <UButton
              icon="i-lucide-x"
              color="error"
              variant="ghost"
              size="xs"
              class="absolute top-2 right-2"
              @click="removeGstLocation(idx)"
            />

            <div class="space-y-2 pr-6">

              <!-- GSTIN + Fetch -->
              <div class="flex gap-1">
                <div class="flex-1 min-w-0">
                  <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
                    GSTIN
                  </label>
                  <UInput
                    :model-value="loc.gstin"
                    maxlength="15"
                    class="w-full font-mono uppercase text-xs"
                    @update:model-value="val => updateLocationField(idx, 'gstin', val.toUpperCase())"
                  />
                </div>
                <div class="flex-shrink-0 self-end">
                  <UButton
                    label="Fetch"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    :loading="!!fetchingLocGst[idx]"
                    :disabled="(loc.gstin || '').length !== 15"
                    @click="fetchLocationGST(idx)"
                  />
                </div>
              </div>

              <!-- State + Pincode -->
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
                    State
                  </label>
                  <UInput
                    :model-value="loc.state"
                    class="w-full text-xs"
                    @update:model-value="val => updateLocationField(idx, 'state', val)"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
                    Pincode
                  </label>
                  <UInput
                    :model-value="loc.pin"
                    class="w-full text-xs"
                    @update:model-value="val => updateLocationField(idx, 'pin', val)"
                  />
                </div>
              </div>

              <!-- Address -->
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
                  Address
                </label>
                <UInput
                  :model-value="loc.address"
                  class="w-full text-xs"
                  @update:model-value="val => updateLocationField(idx, 'address', val)"
                />
              </div>

              <!-- Primary checkbox -->
              <label class="flex items-center gap-2 cursor-pointer">
                <UCheckbox
                  :model-value="loc.is_primary"
                  @update:model-value="val => setPrimary(idx, val)"
                />
                <span class="text-[10px] font-medium text-slate-600">Primary location</span>
              </label>

            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="saving"
          @click="$emit('update:open', false)"
        />
        <UButton
          label="Save Party"
          color="primary"
          :loading="saving"
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>