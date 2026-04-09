import { ref, computed, readonly } from 'vue'
import { useAIApi } from '~/composables/ai/useAIApi'

// Government EPF/ESIC rules state - STRICT POLICY: NO FALLBACK DATA
const epfEsicRules = ref({
  epf: null, // Will be populated only with real AI-fetched data
  esic: null, // Will be populated only with real AI-fetched data
  isLoading: false,
  lastFetched: null,
  error: null
})

// Load rules from localStorage on initialization
const loadStoredRules = () => {
  try {
    const stored = localStorage.getItem('epfEsicRules')
    if (stored) {
      const parsedRules = JSON.parse(stored)
      epfEsicRules.value = { ...epfEsicRules.value, ...parsedRules }
      console.log('✅ Loaded EPF/ESIC rules from localStorage:', {
        epfRate: parsedRules.epf?.employeeRate,
        esicRate: parsedRules.esic?.employeeRate,
        lastFetched: parsedRules.lastFetched
      })
    }
  } catch (error) {
    console.error('Error loading stored EPF/ESIC rules:', error)
  }
}

export const useEpfEsicRules = () => {
  // Get AI API composable
  const { makeAIRequest, isConfigured } = useAIApi()

  // Load stored rules only when explicitly requested (not automatically)
  const loadStoredRulesIfNeeded = () => {
    if (process.client && epfEsicRules.value.epf === null && epfEsicRules.value.esic === null) {
      loadStoredRules()
    }
  }

  // Fetch latest government rules using AI system
  const fetchLatestRules = async (forceUpdate = false, userGuidance = null) => {
    try {
      epfEsicRules.value.isLoading = true
      epfEsicRules.value.error = null

      console.log('🤖 Fetching EPF/ESIC rules using AI system...')

      // Check if AI is configured
      if (!isConfigured.value) {
        throw new Error('AI configuration required. Please configure your AI settings first.')
      }

      // Call the real AI system to fetch current government rules using dynamic AI API
      const response = await makeAIRequest('/api/ai/epf-esic-rules', {
        method: 'POST',
        body: { forceUpdate, userGuidance }
      })
      
      if (response.success && response.data) {
        epfEsicRules.value.epf = {
          ...epfEsicRules.value.epf,
          ...response.data.epf,
          lastUpdated: response.timestamp || new Date().toISOString(),
          source: `AI System - ${response.data.source || 'Unknown'}`
        }

        epfEsicRules.value.esic = {
          ...epfEsicRules.value.esic,
          ...response.data.esic,
          lastUpdated: response.timestamp || new Date().toISOString(),
          source: `AI System - ${response.data.source || 'Unknown'}`
        }

        epfEsicRules.value.lastFetched = response.timestamp || new Date().toISOString()

        // Store in localStorage for persistence
        localStorage.setItem('epfEsicRules', JSON.stringify(epfEsicRules.value))

        console.log('✅ EPF/ESIC rules updated successfully from AI system:', {
          epfRate: response.data.epf.employeeRate,
          esicRate: response.data.esic.employeeRate,
          confidence: response.data.confidence,
          source: response.data.source
        })
      } else {
        throw new Error(response.message || 'Failed to fetch EPF/ESIC rules from AI system')
      }
    } catch (error) {
      console.error('Error fetching EPF/ESIC rules:', error)
      epfEsicRules.value.error = error.message
    } finally {
      epfEsicRules.value.isLoading = false
    }
  }
  
  // Update rules directly from background job response
  const updateRulesDirectly = (rules) => {
    try {
      if (!rules || (!rules.epf && !rules.esic)) {
        throw new Error('Invalid rules data received')
      }
      
      epfEsicRules.value.isLoading = true
      
      // Update EPF rules if available
      if (rules.epf) {
        epfEsicRules.value.epf = {
          ...epfEsicRules.value.epf,
          ...rules.epf,
          lastUpdated: new Date().toISOString(),
          source: `AI System - ${rules.source || 'Background Job'}`
        }
      }
      
      // Update ESIC rules if available
      if (rules.esic) {
        epfEsicRules.value.esic = {
          ...epfEsicRules.value.esic,
          ...rules.esic,
          lastUpdated: new Date().toISOString(),
          source: `AI System - ${rules.source || 'Background Job'}`
        }
      }
      
      epfEsicRules.value.lastFetched = new Date().toISOString()
      
      // Store in localStorage for persistence
      localStorage.setItem('epfEsicRules', JSON.stringify(epfEsicRules.value))
      
      console.log('✅ EPF/ESIC rules updated directly from background job:', {
        epfRate: rules.epf?.employeeRate,
        esicRate: rules.esic?.employeeRate,
        source: rules.source || 'Background Job'
      })
    } catch (error) {
      console.error('Error updating EPF/ESIC rules directly:', error)
      epfEsicRules.value.error = error.message
    } finally {
      epfEsicRules.value.isLoading = false
    }
  }



  // Check if rules need updating (older than 24 hours)
  const needsUpdate = computed(() => {
    if (!epfEsicRules.value.lastFetched) return true
    
    const lastFetched = new Date(epfEsicRules.value.lastFetched)
    const now = new Date()
    const hoursDiff = (now - lastFetched) / (1000 * 60 * 60)
    
    return hoursDiff > 24 // Update if older than 24 hours
  })

  // Start background update only when explicitly called (for wages management)
  const startBackgroundUpdate = () => {
    // Load stored rules first
    loadStoredRulesIfNeeded()

    // Check if update is needed
    if (needsUpdate.value) {
      // Delay the fetch to not block UI
      setTimeout(() => {
        fetchLatestRules()
      }, 2000)
    }

    // Set up periodic updates (every 24 hours) - only when actively using wages
    setInterval(() => {
      if (needsUpdate.value) {
        fetchLatestRules()
      }
    }, 24 * 60 * 60 * 1000) // 24 hours
  }

  // Calculate EPF/ESIC with current rules
  const calculateWithCurrentRules = (grossSalary) => {
    const rules = epfEsicRules.value

    // Check if rules are available
    if (!rules.epf || !rules.esic) {
      console.warn('⚠️ EPF/ESIC rules not available for calculation. Please refresh rates from AI system.')
      return {
        epf: {
          applicableWage: 0,
          employee: 0,
          employerEpf: 0,
          employerEps: 0,
          edli: 0,
          adminCharges: 0,
          total: 0
        },
        esic: {
          applicableWage: 0,
          employee: 0,
          employer: 0,
          total: 0
        },
        totalEmployee: 0,
        totalEmployer: 0,
        grandTotal: 0,
        rulesAvailable: false
      }
    }

    // EPF Calculations
    const epfApplicableWage = Math.min(grossSalary, rules.epf.wageLimit)
    const employeeEpf = Math.min(
      Math.round(epfApplicableWage * rules.epf.employeeRate),
      rules.epf.maxEmployeeContribution
    )
    const employerEps = Math.min(
      Math.round(epfApplicableWage * rules.epf.employerEpsRate),
      rules.epf.maxEpsContribution
    )
    const employerEpf = Math.round(epfApplicableWage * rules.epf.employerEpfRate)
    const edli = Math.round(epfApplicableWage * rules.epf.edliRate)

    // EPF Admin Charges (paid by employer)
    const adminCharges = Math.min(
      Math.round(epfApplicableWage * (rules.epf.adminChargesRate || 0.0065)),
      rules.epf.maxAdminCharges || 75
    )

    // ESIC Calculations
    const esicApplicableWage = Math.min(grossSalary, rules.esic.wageLimit)
    const employeeEsic = Math.ceil(esicApplicableWage * rules.esic.employeeRate)
    const employerEsic = Math.ceil(esicApplicableWage * rules.esic.employerRate)

    return {
      epfApplicableWage,
      employeeEpf,
      employerEpf,
      employerEps,
      edli,
      adminCharges,
      totalEmployerEpfContribution: employerEps + employerEpf + adminCharges,
      totalEpfContribution: employeeEpf + employerEps + employerEpf + adminCharges,

      esicApplicableWage,
      employeeEsic,
      employerEsic,
      totalEsicContribution: employeeEsic + employerEsic,

      totalEmployeeDeduction: employeeEpf + employeeEsic,
      totalEmployerContribution: employerEps + employerEpf + employerEsic + edli + adminCharges,
      
      rulesUsed: {
        epfRates: {
          employee: rules.epf.employeeRate,
          employerEpf: rules.epf.employerEpfRate,
          employerEps: rules.epf.employerEpsRate,
          edli: rules.epf.edliRate,
          adminCharges: rules.epf.adminChargesRate || 0.0065
        },
        esicRates: {
          employee: rules.esic.employeeRate,
          employer: rules.esic.employerRate
        },
        limits: {
          epfWageLimit: rules.epf.wageLimit,
          esicWageLimit: rules.esic.wageLimit,
          maxAdminCharges: rules.epf.maxAdminCharges || 75
        },
        lastUpdated: rules.epf.lastUpdated
      },
      rulesAvailable: true
    }
  }

  // Get current rules summary
  const getCurrentRules = computed(() => ({
    epf: epfEsicRules.value.epf,
    esic: epfEsicRules.value.esic,
    isLoading: epfEsicRules.value.isLoading,
    error: epfEsicRules.value.error,
    needsUpdate: needsUpdate.value
  }))

  return {
    epfEsicRules: readonly(epfEsicRules),
    fetchLatestRules,
    updateRulesDirectly,
    startBackgroundUpdate,
    loadStoredRulesIfNeeded,
    calculateWithCurrentRules,
    getCurrentRules,
    needsUpdate
  }
}

// Note: Now using real AI system instead of simulation
// The AI system fetches current EPF/ESIC rules from government sources

// Note: Auto-start removed to prevent unnecessary loading on every page
// PF/ESIC rules will only be loaded when specifically needed in wages management
