<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'max-w-5xl h-[90vh]', overlay: { base: 'z-[1100]' }, wrapper: { base: 'z-[1100]' } }">
    <template #content>
      <UCard :ui="{ body: 'p-0 overflow-hidden flex flex-col', header: 'bg-indigo-50 dark:bg-indigo-950/20 p-4' }" class="h-full flex flex-col">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon :name="mode === 'create' ? 'i-heroicons-plus' : 'i-heroicons-pencil'" class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <h2 class="text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                {{ mode === 'create' ? 'Create Firm' : `Edit: ${formData.name}` }}
              </h2>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="closeModal"
            />
          </div>
        </template>

        <UTabs :items="tabItems" v-model="activeTab" class="w-full" :ui="{ list: 'rounded-none border-b border-gray-200 dark:border-gray-800' }" />

        <div class="flex-1 overflow-y-auto p-6 min-h-0">
          <!-- BASIC INFO TAB -->
          <div v-if="activeTab === 'basic'" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UFormField label="Firm Name" required>
                <UInput v-model="formData.name" placeholder="e.g. Acme Pvt Ltd" />
              </UFormField>
              <UFormField label="Legal Name">
                <UInput v-model="formData.legal_name" placeholder="Full legal entity name" />
              </UFormField>
            </div>

            <UFormField label="Quick GST Fetch" :help="'Enter primary GSTIN and fetch to auto-fill name, PAN & first location'">
              <div class="flex gap-2">
                <UInput
                  v-model="gstFetchInput"
                  placeholder="22AAAAA0000A1Z5"
                  maxlength="15"
                  class="flex-1"
                  @input="gstFetchInput = gstFetchInput.toUpperCase()"
                />
                <UButton
                  :loading="gstFetching"
                  icon="i-heroicons-magnifying-glass"
                  @click="triggerGstFetch"
                >
                  Fetch
                </UButton>
              </div>
            </UFormField>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UFormField label="Code">
                <UInput v-model="formData.code" placeholder="e.g. ACME" />
              </UFormField>
              <UFormField label="Status">
                <USelect v-model="formData.status" :options="statusOptions" />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UFormField label="Business Type">
                <UInput v-model="formData.business_type" placeholder="e.g. Retail" />
              </UFormField>
              <UFormField label="Industry Type">
                <UInput v-model="formData.industry_type" placeholder="e.g. Healthcare" />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UFormField label="Establishment Year">
                <UInput v-model.number="formData.establishment_year" type="number" placeholder="e.g. 2005" />
              </UFormField>
              <UFormField label="Employee Count">
                <UInput v-model.number="formData.employee_count" type="number" placeholder="e.g. 50" />
              </UFormField>
            </div>

            <UFormField label="Description">
              <UTextarea v-model="formData.description" placeholder="Brief description" />
            </UFormField>
          </div>

          <!-- LOCATION & CONTACT TAB -->
          <div v-if="activeTab === 'location'" class="space-y-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-bold text-sm">GST Registrations & Business Locations</h3>
                <p class="text-xs text-gray-500 mt-1">Each GSTIN is bound to one address (PPOB/APOB)</p>
              </div>
              <UButton
                size="sm"
                icon="i-heroicons-plus"
                @click="addLocation"
              >
                Add Location
              </UButton>
            </div>

            <div class="space-y-4">
              <div
                v-for="(loc, idx) in formData.locations"
                :key="idx"
                class="border rounded-lg p-4"
                :class="loc.is_default ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-800'"
              >
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <URadioGroup v-model="defaultLocationIdx" :options="[{ value: idx, label: 'Set as Default' }]" />
                    <UBadge v-if="loc.is_default" color="indigo" variant="subtle">Default</UBadge>
                  </div>
                  <UButton
                    v-if="formData.locations.length > 1"
                    color="red"
                    variant="ghost"
                    size="sm"
                    icon="i-heroicons-trash-20-solid"
                    @click="removeLocation(idx)"
                  />
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="GSTIN" required>
                    <UInput
                      v-model="loc.gst_number"
                      placeholder="27AABCD1234A1Z5"
                      maxlength="15"
                      class="uppercase font-mono"
                      @input="onGstinInput(idx)"
                    />
                  </UFormField>
                  <div class="flex gap-2 items-end">
                    <UButton
                      :loading="gstFetching"
                      size="sm"
                      icon="i-heroicons-magnifying-glass"
                      @click="triggerLocFetch(idx)"
                    >
                      Fetch Address
                    </UButton>
                  </div>
                </div>

                <div v-if="loc._fetched" class="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-400 flex items-center gap-2">
                  <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
                  Address auto-filled from GST registry
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <UFormField label="Address" class="md:col-span-2">
                    <UInput v-model="loc.address" placeholder="Street, locality, building name" />
                  </UFormField>
                  <UFormField label="City / District">
                    <UInput v-model="loc.city" placeholder="e.g. Mumbai" />
                  </UFormField>
                  <UFormField label="Pincode">
                    <UInput v-model="loc.pincode" placeholder="e.g. 400069" maxlength="6" />
                  </UFormField>
                  <UFormField label="State">
                    <UInput v-model="loc.state" placeholder="e.g. Maharashtra" />
                  </UFormField>
                  <UFormField label="State Code">
                    <UInput v-model="loc.state_code" placeholder="27" maxlength="2" class="font-mono" />
                  </UFormField>
                  <UFormField label="Registration Type">
                    <USelect v-model="loc.registration_type" :options="registrationTypeOptions" />
                  </UFormField>
                </div>
              </div>
            </div>

            <div class="border-t border-gray-200 dark:border-gray-800 my-4"></div>

            <div class="space-y-4">
              <h3 class="font-bold text-sm">Contact Information</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Primary Phone">
                  <UInput v-model="formData.phone_number" placeholder="+91 XXXXX XXXXX" />
                </UFormField>
                <UFormField label="Secondary Phone">
                  <UInput v-model="formData.secondary_phone" placeholder="+91 XXXXX XXXXX" />
                </UFormField>
                <UFormField label="Email">
                  <UInput v-model="formData.email" type="email" placeholder="firm@example.com" />
                </UFormField>
                <UFormField label="Website">
                  <UInput v-model="formData.website" placeholder="https://example.com" />
                </UFormField>
              </div>
            </div>
          </div>

          <!-- COMPLIANCE TAB -->
          <div v-if="activeTab === 'compliance'" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="PAN Number">
                <UInput v-model="formData.pan_number" placeholder="ABCDE1234F" />
              </UFormField>
              <UFormField label="CIN Number">
                <UInput v-model="formData.cin_number" placeholder="U12345MH2005PTC123456" />
              </UFormField>
              <UFormField label="Registration Number">
                <UInput v-model="formData.registration_number" placeholder="Reg. number" />
              </UFormField>
              <UFormField label="Registration Date">
                <UInput v-model="formData.registration_date" type="date" />
              </UFormField>
              <UFormField label="Tax ID">
                <UInput v-model="formData.tax_id" placeholder="Tax identification" />
              </UFormField>
              <UFormField label="VAT Number">
                <UInput v-model="formData.vat_number" placeholder="VAT registration" />
              </UFormField>
              <UFormField label="License Numbers" class="md:col-span-2">
                <UInput v-model="formData.license_numbers" placeholder="Trade / operating license numbers" />
              </UFormField>
              <UFormField label="Insurance Details" class="md:col-span-2">
                <UTextarea v-model="formData.insurance_details" placeholder="Insurance policy details" />
              </UFormField>
            </div>
          </div>

          <!-- FINANCIAL & SETTINGS TAB -->
          <div v-if="activeTab === 'financial'" class="space-y-6">
            <div>
              <h3 class="font-bold text-sm mb-4">Banking</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Bank Account Number">
                  <UInput v-model="formData.bank_account_number" placeholder="Account number" />
                </UFormField>
                <UFormField label="Bank Name">
                  <UInput v-model="formData.bank_name" placeholder="Bank name" />
                </UFormField>
                <UFormField label="Bank Branch">
                  <UInput v-model="formData.bank_branch" placeholder="Branch name" />
                </UFormField>
                <UFormField label="IFSC Code">
                  <UInput v-model="formData.ifsc_code" placeholder="IFSC" />
                </UFormField>
                <UFormField label="Payment Terms" class="md:col-span-2">
                  <UInput v-model="formData.payment_terms" placeholder="e.g. Net 30" />
                </UFormField>
              </div>
            </div>

            <div class="border-t border-gray-200 dark:border-gray-800 my-4"></div>

            <div>
              <h3 class="font-bold text-sm mb-4">Settings</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Currency">
                  <USelect v-model="formData.currency" :options="currencyOptions" />
                </UFormField>
                <UFormField label="Timezone">
                  <USelect v-model="formData.timezone" :options="timezoneOptions" />
                </UFormField>
                <UFormField label="Fiscal Year Start">
                  <UInput v-model="formData.fiscal_year_start" placeholder="e.g. 01-04" />
                </UFormField>
                <UFormField label="Invoice Prefix">
                  <UInput v-model="formData.invoice_prefix" placeholder="e.g. INV-" />
                </UFormField>
                <UFormField label="Quote Prefix">
                  <UInput v-model="formData.quote_prefix" placeholder="e.g. QT-" />
                </UFormField>
                <UFormField label="PO Prefix">
                  <UInput v-model="formData.po_prefix" placeholder="e.g. PO-" />
                </UFormField>
                <UFormField label="Logo URL" class="md:col-span-2">
                  <UInput v-model="formData.logo_url" placeholder="https://..." />
                </UFormField>
                <UCheckbox v-model="formData.enable_e_invoice" label="Enable E-Invoice" />
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-between items-center">
          <div class="text-xs text-gray-400 uppercase tracking-widest font-bold">
            {{ mode === 'create' ? 'New Firm' : 'Edit Mode' }}
          </div>
          <div class="flex gap-3">
            <UButton variant="ghost" color="neutral" @click="closeModal">Cancel</UButton>
            <UButton color="indigo" icon="i-heroicons-check-circle" :loading="saving" @click="saveFirm">
              {{ mode === 'create' ? 'Create Firm' : 'Save Changes' }}
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create',
    validator: v => ['create', 'edit'].includes(v)
  },
  firmData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:isOpen', 'saved'])

const isOpen = computed({
  get: () => props.isOpen,
  set: (value) => emit('update:isOpen', value)
})

const activeTab = ref('basic')
const saving = ref(false)
const gstFetching = ref(false)
const gstFetchInput = ref('')
const pendingFetchIdx = ref(-1)

const tabItems = [
  { label: 'Basic Info', icon: 'i-heroicons-information-circle', value: 'basic' },
  { label: 'Location & Contact', icon: 'i-heroicons-map-pin', value: 'location' },
  { label: 'Compliance', icon: 'i-heroicons-document-check', value: 'compliance' },
  { label: 'Financial & Settings', icon: 'i-heroicons-cog-6-tooth', value: 'financial' }
]

const statusOptions = [
  { label: 'Approved', value: 'approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Rejected', value: 'rejected' }
]

const registrationTypeOptions = [
  { label: 'PPOB', value: 'PPOB' },
  { label: 'APOB', value: 'APOB' }
]

const currencyOptions = [
  { label: 'INR — Indian Rupee', value: 'INR' },
  { label: 'USD — US Dollar', value: 'USD' },
  { label: 'EUR — Euro', value: 'EUR' },
  { label: 'GBP — British Pound', value: 'GBP' }
]

const timezoneOptions = [
  { label: 'Asia/Kolkata (IST)', value: 'Asia/Kolkata' },
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'Europe/London', value: 'Europe/London' }
]

const GST_STATE_MAP = {
  '01':'Jammu & Kashmir', '02':'Himachal Pradesh', '03':'Punjab',
  '04':'Chandigarh', '05':'Uttarakhand', '06':'Haryana',
  '07':'Delhi', '08':'Rajasthan', '09':'Uttar Pradesh',
  '10':'Bihar', '11':'Sikkim', '12':'Arunachal Pradesh',
  '13':'Nagaland', '14':'Manipur', '15':'Mizoram',
  '16':'Tripura', '17':'Meghalaya', '18':'Assam',
  '19':'West Bengal', '20':'Jharkhand', '21':'Odisha',
  '22':'Chhattisgarh', '23':'Madhya Pradesh', '24':'Gujarat',
  '25':'Daman & Diu', '26':'Dadra & Nagar Haveli', '27':'Maharashtra',
  '28':'Andhra Pradesh (Old)', '29':'Karnataka', '30':'Goa',
  '31':'Lakshadweep', '32':'Kerala', '33':'Tamil Nadu',
  '34':'Puducherry', '35':'Andaman & Nicobar', '36':'Telangana',
  '37':'Andhra Pradesh', '38':'Ladakh',
  '97':'Other Territory', '99':'Centre Jurisdiction'
}

const defaultFormData = {
  name: '',
  legal_name: '',
  code: '',
  description: '',
  business_type: '',
  industry_type: '',
  establishment_year: null,
  employee_count: null,
  status: 'approved',
  phone_number: '',
  secondary_phone: '',
  email: '',
  website: '',
  pan_number: '',
  cin_number: '',
  registration_number: '',
  registration_date: '',
  tax_id: '',
  vat_number: '',
  license_numbers: '',
  insurance_details: '',
  bank_account_number: '',
  bank_name: '',
  bank_branch: '',
  ifsc_code: '',
  payment_terms: '',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  fiscal_year_start: '',
  invoice_prefix: '',
  quote_prefix: '',
  po_prefix: '',
  logo_url: '',
  enable_e_invoice: false,
  locations: [
    {
      gst_number: '',
      state_code: '',
      state: '',
      registration_type: 'PPOB',
      address: '',
      city: '',
      pincode: '',
      is_default: true,
      _fetched: false
    }
  ]
}

const formData = ref(JSON.parse(JSON.stringify(defaultFormData)))

const defaultLocationIdx = computed({
  get: () => formData.value.locations.findIndex(l => l.is_default),
  set: (idx) => {
    formData.value.locations.forEach((l, i) => {
      l.is_default = i === idx
    })
  }
})

const deriveStateFromGstin = (gstin) => {
  if (!gstin || gstin.length < 2) return { state_code: '', state: '' }
  const code = gstin.substring(0, 2)
  return { state_code: code, state: GST_STATE_MAP[code] || '' }
}

const onGstinInput = (idx) => {
  const loc = formData.value.locations[idx]
  loc.gst_number = loc.gst_number.toUpperCase()
  loc._fetched = false

  if (loc.gst_number.length === 15) {
    const derived = deriveStateFromGstin(loc.gst_number)
    loc.state_code = derived.state_code
    loc.state = derived.state

    if (!formData.value.pan_number) {
      formData.value.pan_number = loc.gst_number.substring(2, 12)
    }
  }
}

const addLocation = () => {
  formData.value.locations.push({
    gst_number: '',
    state_code: '',
    state: '',
    registration_type: 'PPOB',
    address: '',
    city: '',
    pincode: '',
    is_default: false,
    _fetched: false
  })
}

const removeLocation = (idx) => {
  if (formData.value.locations.length > 1) {
    formData.value.locations.splice(idx, 1)
    if (!formData.value.locations.some(l => l.is_default)) {
      formData.value.locations[0].is_default = true
    }
  }
}

const triggerGstFetch = async () => {
  if (gstFetchInput.value.length !== 15) {
    alert('Invalid GSTIN — must be 15 characters')
    return
  }
  pendingFetchIdx.value = -1
  await fetchGstDetails(gstFetchInput.value)
}

const triggerLocFetch = async (idx) => {
  const gstin = formData.value.locations[idx].gst_number
  if (gstin.length !== 15) {
    alert('Enter a 15-character GSTIN first')
    return
  }
  pendingFetchIdx.value = idx
  await fetchGstDetails(gstin)
}

const fetchGstDetails = async (gstin) => {
  gstFetching.value = true
  try {
    const response = await fetch(`/api/gst/fetch?gstin=${gstin}`)
    if (!response.ok) throw new Error('Failed to fetch GST details')
    const result = await response.json()
    
    if (result.success && result.data) {
      populateGstFields(result.data)
    } else {
      throw new Error(result.message || 'Invalid GST data')
    }
  } catch (error) {
    console.error('GST fetch error:', error)
    alert('Could not fetch GST details. Please enter manually.')
  } finally {
    gstFetching.value = false
  }
}

const populateGstFields = (gstData) => {
  if (!gstData) {
    return
  }

  const data = gstData.data || gstData

  const ppob = data.place_of_business_principal?.address
  const derived = deriveStateFromGstin(data.gstin || '')

  const fullAddr = ppob
    ? [ppob.door_num, ppob.building_name, ppob.street, ppob.location]
        .filter(Boolean)
        .join(', ')
    : ''
  const city = ppob?.city || ppob?.district || ''
  const pincode = ppob?.pin_code || ''

  if (pendingFetchIdx.value >= 0) {
    const idx = pendingFetchIdx.value
    const loc = formData.value.locations[idx]
    if (data.gstin) loc.gst_number = data.gstin
    if (derived.state_code) loc.state_code = derived.state_code
    if (derived.state) loc.state = derived.state
    if (fullAddr) loc.address = fullAddr
    if (city) loc.city = city
    if (pincode) loc.pincode = pincode
    loc._fetched = true
    pendingFetchIdx.value = -1
    return
  }

  if (data.legal_name) formData.value.legal_name = data.legal_name
  if (data.trade_name) formData.value.name = data.trade_name
  if (data.gstin) formData.value.pan_number = data.gstin.substring(2, 12)
  
  if (data.business_activity_nature && Array.isArray(data.business_activity_nature)) {
    formData.value.business_type = data.business_activity_nature[0] || ''
    formData.value.industry_type = data.business_activity_nature.join(', ')
  }
  
  if (data.business_constitution) {
    formData.value.business_type = data.business_constitution
  }
  
  if (data.registration_date) {
    const regDate = new Date(data.registration_date)
    if (!isNaN(regDate.getTime())) {
      formData.value.registration_date = regDate.toISOString().split('T')[0]
      const year = regDate.getFullYear()
      if (!formData.value.establishment_year) {
        formData.value.establishment_year = year
      }
    }
  }

  if (data.gstin) {
    const existIdx = formData.value.locations.findIndex(l => l.gst_number === data.gstin)
    const locData = {
      gst_number: data.gstin,
      state_code: derived.state_code,
      state: derived.state,
      registration_type: 'PPOB',
      address: fullAddr,
      city: city,
      pincode: pincode,
      _fetched: true
    }

    if (existIdx >= 0) {
      Object.assign(formData.value.locations[existIdx], locData)
    } else if (formData.value.locations.length === 1 && !formData.value.locations[0].gst_number) {
      locData.is_default = true
      Object.assign(formData.value.locations[0], locData)
    } else {
      formData.value.locations.push({ ...locData, is_default: false })
    }
  }
}

const saveFirm = async () => {
  if (!formData.value.name.trim()) {
    alert('Firm name is required')
    return
  }

  const validLocations = formData.value.locations.filter(l => l.gst_number.trim() || l.address.trim())
  if (validLocations.length === 0) {
    alert('At least one location with GSTIN or address is required')
    return
  }

  if (!validLocations.some(l => l.is_default)) {
    validLocations[0].is_default = true
  }

  const payload = {
    ...formData.value,
    locations: validLocations.map(l => ({
      gst_number: l.gst_number.trim(),
      state_code: l.state_code.trim(),
      state: l.state.trim(),
      registration_type: l.registration_type,
      address: l.address.trim(),
      city: l.city.trim(),
      pincode: l.pincode.trim(),
      is_default: l.is_default
    }))
  }

  saving.value = true
  try {
    const { put, post } = useApiWithAuth()
    const method = props.mode === 'create' ? post : put
    const url = props.mode === 'create' ? '/api/firms' : `/api/firms/${props.firmData._id}`

    const result = await method(url, payload)
    
    // If creating a new firm, assign it to the current user
    if (props.mode === 'create' && result.data?._id) {
      try {
        await put('/api/users/assign-firm', { firmId: result.data._id })
      } catch (assignErr) {
        console.error('Warning: Could not assign firm to user:', assignErr)
        // Don't fail the save - firm was created successfully
      }
    }
    
    emit('saved')
    closeModal()
  } catch (error) {
    console.error('Error saving firm:', error)
    alert('Failed to save firm. Please try again.')
  } finally {
    saving.value = false
  }
}

const closeModal = () => {
  isOpen.value = false
  formData.value = JSON.parse(JSON.stringify(defaultFormData))
  gstFetchInput.value = ''
  activeTab.value = 'basic'
}

watch(() => props.isOpen, (newVal) => {
  if (newVal && props.mode === 'edit' && props.firmData) {
    formData.value = {
      ...defaultFormData,
      ...props.firmData,
      locations: props.firmData.locations?.length
        ? props.firmData.locations.map(l => ({ ...l, _fetched: false }))
        : [{ ...defaultFormData.locations[0] }]
    }
  } else if (newVal && props.mode === 'create') {
    formData.value = JSON.parse(JSON.stringify(defaultFormData))
  }
})
</script>
