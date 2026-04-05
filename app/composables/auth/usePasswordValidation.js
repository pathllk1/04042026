// composables/usePasswordValidation.js
import { ref, computed } from 'vue'

export default function usePasswordValidation() {
  const password = ref('')
  const confirmPassword = ref('')
  const validationResult = ref(null)
  const isValidating = ref(false)

  // Debounced validation
  let validationTimeout = null

  const validatePassword = async (passwordValue = password.value, userInfo = null) => {
    if (!passwordValue) {
      validationResult.value = null
      return
    }

    isValidating.value = true

    // Clear previous timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout)
    }

    // Debounce validation by 500ms
    validationTimeout = setTimeout(async () => {
      try {
        const response = await $fetch('/api/auth/validate-password', {
          method: 'POST',
          body: {
            password: passwordValue,
            userInfo
          }
        })
        
        validationResult.value = response
      } catch (error) {
        console.error('Password validation error:', error)
        validationResult.value = {
          isValid: false,
          errors: ['Failed to validate password'],
          strength: 'weak',
          score: 0,
          feedback: []
        }
      } finally {
        isValidating.value = false
      }
    }, 500)
  }

  // Computed properties
  const isPasswordValid = computed(() => {
    return validationResult.value?.isValid || false
  })

  const passwordsMatch = computed(() => {
    if (!password.value || !confirmPassword.value) return true
    return password.value === confirmPassword.value
  })

  const canSubmit = computed(() => {
    return password.value && 
           confirmPassword.value && 
           passwordsMatch.value && 
           isPasswordValid.value &&
           !isValidating.value
  })

  const strengthColor = computed(() => {
    if (!validationResult.value) return 'gray'
    
    switch (validationResult.value.strength) {
      case 'weak': return 'red'
      case 'medium': return 'yellow'
      case 'strong': return 'green'
      default: return 'gray'
    }
  })

  const strengthText = computed(() => {
    if (!validationResult.value) return ''
    return validationResult.value.strength.charAt(0).toUpperCase() + 
           validationResult.value.strength.slice(1)
  })

  // Password requirements checker
  const requirements = computed(() => {
    if (!password.value) return []

    return [
      {
        text: 'At least 8 characters',
        met: password.value.length >= 8
      },
      {
        text: 'Contains uppercase letter',
        met: /[A-Z]/.test(password.value)
      },
      {
        text: 'Contains lowercase letter',
        met: /[a-z]/.test(password.value)
      },
      {
        text: 'Contains number',
        met: /\d/.test(password.value)
      },
      {
        text: 'Contains special character',
        met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password.value)
      }
    ]
  })

  const allRequirementsMet = computed(() => {
    return requirements.value.every(req => req.met)
  })

  // Reset function
  const reset = () => {
    password.value = ''
    confirmPassword.value = ''
    validationResult.value = null
    isValidating.value = false
    
    if (validationTimeout) {
      clearTimeout(validationTimeout)
      validationTimeout = null
    }
  }

  // Generate secure password
  const generateSecurePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    
    let newPassword = ''
    
    // Ensure at least one character from each set
    newPassword += uppercase[Math.floor(Math.random() * uppercase.length)]
    newPassword += lowercase[Math.floor(Math.random() * lowercase.length)]
    newPassword += numbers[Math.floor(Math.random() * numbers.length)]
    newPassword += special[Math.floor(Math.random() * special.length)]
    
    // Fill the rest randomly (total length 12)
    const allChars = uppercase + lowercase + numbers + special
    for (let i = 4; i < 12; i++) {
      newPassword += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // Shuffle the password
    const shuffled = newPassword.split('').sort(() => Math.random() - 0.5).join('')
    
    password.value = shuffled
    confirmPassword.value = shuffled
    
    // Validate the generated password
    validatePassword(shuffled)
    
    return shuffled
  }

  return {
    // Reactive data
    password,
    confirmPassword,
    validationResult,
    isValidating,
    
    // Computed properties
    isPasswordValid,
    passwordsMatch,
    canSubmit,
    strengthColor,
    strengthText,
    requirements,
    allRequirementsMet,
    
    // Methods
    validatePassword,
    reset,
    generateSecurePassword
  }
}
