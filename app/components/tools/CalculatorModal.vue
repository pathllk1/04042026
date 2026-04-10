<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[300] transition-opacity duration-300 ease-in-out">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ease-in-out scale-100">
      <button @click="closeModal" class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 transition-colors duration-200">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Calculator Selection Buttons -->
      <h1 class="text-2xl font-bold text-center mb-6 text-indigo-700">Calculators</h1>
      <div class="grid grid-cols-3 md:grid-cols-4 gap-2 mb-6">
        <button
          v-for="(calc, index) in calculators"
          :key="index"
          @click="openCalculator(calc.id)"
          class="p-2 rounded-lg shadow-md transition-all duration-300 text-white font-medium text-xs md:text-sm transform hover:scale-105"
          :class="getButtonColor(index)"
        >
          {{ calc.name }}
        </button>
      </div>

      <!-- Standard Calculator Modal -->
      <div v-if="activeCalculator === 'standard'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-gray-700">Standard Calculator</h2>

        <div class="mb-4 bg-gray-100 p-3 rounded-lg">
          <div class="text-right text-2xl font-mono h-10 mb-2 overflow-x-auto" ref="displayRef">{{ display || '0' }}</div>
          <div class="text-right text-sm text-gray-500 h-6 mb-2 overflow-x-auto">{{ calculation }}</div>
        </div>

        <div class="grid grid-cols-4 gap-2">
          <!-- First row -->
          <button @click="clearEntry" class="calc-btn bg-red-500 hover:bg-red-600">CE</button>
          <button @click="clearAll" class="calc-btn bg-red-500 hover:bg-red-600">C</button>
          <button @click="backspace" class="calc-btn bg-gray-500 hover:bg-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </button>
          <button @click="appendOperator('/')" class="calc-btn bg-indigo-500 hover:bg-indigo-600">÷</button>

          <!-- Second row -->
          <button @click="appendDigit('7')" class="calc-btn bg-blue-400 hover:bg-blue-500">7</button>
          <button @click="appendDigit('8')" class="calc-btn bg-blue-400 hover:bg-blue-500">8</button>
          <button @click="appendDigit('9')" class="calc-btn bg-blue-400 hover:bg-blue-500">9</button>
          <button @click="appendOperator('*')" class="calc-btn bg-indigo-500 hover:bg-indigo-600">×</button>

          <!-- Third row -->
          <button @click="appendDigit('4')" class="calc-btn bg-blue-400 hover:bg-blue-500">4</button>
          <button @click="appendDigit('5')" class="calc-btn bg-blue-400 hover:bg-blue-500">5</button>
          <button @click="appendDigit('6')" class="calc-btn bg-blue-400 hover:bg-blue-500">6</button>
          <button @click="appendOperator('-')" class="calc-btn bg-indigo-500 hover:bg-indigo-600">-</button>

          <!-- Fourth row -->
          <button @click="appendDigit('1')" class="calc-btn bg-blue-400 hover:bg-blue-500">1</button>
          <button @click="appendDigit('2')" class="calc-btn bg-blue-400 hover:bg-blue-500">2</button>
          <button @click="appendDigit('3')" class="calc-btn bg-blue-400 hover:bg-blue-500">3</button>
          <button @click="appendOperator('+')" class="calc-btn bg-indigo-500 hover:bg-indigo-600">+</button>

          <!-- Fifth row -->
          <button @click="toggleSign" class="calc-btn bg-blue-400 hover:bg-blue-500">±</button>
          <button @click="appendDigit('0')" class="calc-btn bg-blue-400 hover:bg-blue-500">0</button>
          <button @click="appendDecimal()" class="calc-btn bg-blue-400 hover:bg-blue-500">.</button>
          <button @click="calculate" class="calc-btn bg-green-500 hover:bg-green-600">=</button>
        </div>
      </div>

      <!-- Volume Calculator Modal -->
      <div v-if="activeCalculator === 'volume'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-purple-600">Volume Converter</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Value</label>
          <input type="number" v-model="volumeCalc.value" min="0" step="0.0001" class="w-full p-2 border rounded">
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">From</label>
            <select v-model="volumeCalc.from" class="w-full p-2 border rounded">
              <option v-for="unit in volumeUnits" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
          </div>

          <div>
            <label class="block text-gray-700 mb-2">To</label>
            <select v-model="volumeCalc.to" class="w-full p-2 border rounded">
              <option v-for="unit in volumeUnits" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="convertVolume" class="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition duration-300 transform hover:scale-105">
            Convert
          </button>

          <button @click="resetVolumeCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="volumeCalc.result !== null" class="mt-4 p-3 bg-purple-50 rounded">
          <h3 class="font-bold text-purple-700">Result:</h3>
          <p>{{ volumeCalc.value }} {{ getVolumeUnitLabel(volumeCalc.from) }} = {{ volumeCalc.result }} {{ getVolumeUnitLabel(volumeCalc.to) }}</p>
        </div>
      </div>

      <!-- Weight Calculator Modal -->
      <div v-if="activeCalculator === 'weight'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-amber-600">Weight Converter</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Value</label>
          <input type="number" v-model="weightCalc.value" min="0" step="0.0001" class="w-full p-2 border rounded">
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">From</label>
            <select v-model="weightCalc.from" class="w-full p-2 border rounded">
              <option v-for="unit in weightUnits" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
          </div>

          <div>
            <label class="block text-gray-700 mb-2">To</label>
            <select v-model="weightCalc.to" class="w-full p-2 border rounded">
              <option v-for="unit in weightUnits" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="convertWeight" class="flex-1 bg-amber-600 text-white py-2 rounded hover:bg-amber-700 transition duration-300 transform hover:scale-105">
            Convert
          </button>

          <button @click="resetWeightCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="weightCalc.result !== null" class="mt-4 p-3 bg-amber-50 rounded">
          <h3 class="font-bold text-amber-700">Result:</h3>
          <p>{{ weightCalc.value }} {{ getWeightUnitLabel(weightCalc.from) }} = {{ weightCalc.result }} {{ getWeightUnitLabel(weightCalc.to) }}</p>
        </div>
      </div>

      <!-- Date Calculator Modal -->
      <div v-if="activeCalculator === 'date'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-indigo-600">Date Calculator</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Operation</label>
          <div class="flex space-x-4">
            <label class="inline-flex items-center">
              <input type="radio" v-model="dateCalc.operation" value="add" class="form-radio text-indigo-600">
              <span class="ml-2">Add</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" v-model="dateCalc.operation" value="subtract" class="form-radio text-indigo-600">
              <span class="ml-2">Subtract</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" v-model="dateCalc.operation" value="difference" class="form-radio text-indigo-600">
              <span class="ml-2">Difference</span>
            </label>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Start Date</label>
          <input type="date" v-model="dateCalc.startDate" class="w-full p-2 border rounded">
        </div>

        <div v-if="dateCalc.operation === 'difference'" class="mb-4">
          <label class="block text-gray-700 mb-2">End Date</label>
          <input type="date" v-model="dateCalc.endDate" class="w-full p-2 border rounded">
        </div>

        <div v-else class="mb-4">
          <label class="block text-gray-700 mb-2">Duration</label>
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-gray-700 text-sm">Years</label>
              <input type="number" v-model="dateCalc.years" min="0" class="w-full p-2 border rounded">
            </div>
            <div>
              <label class="block text-gray-700 text-sm">Months</label>
              <input type="number" v-model="dateCalc.months" min="0" max="11" class="w-full p-2 border rounded">
            </div>
            <div>
              <label class="block text-gray-700 text-sm">Days</label>
              <input type="number" v-model="dateCalc.days" min="0" max="30" class="w-full p-2 border rounded">
            </div>
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="calculateDate" class="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition duration-300 transform hover:scale-105">
            Calculate
          </button>

          <button @click="resetDateCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="dateCalc.result" class="mt-4 p-3 bg-indigo-50 rounded">
          <h3 class="font-bold text-indigo-700">Result:</h3>
          <p>{{ dateCalc.result }}</p>
        </div>
      </div>

      <!-- Age Calculator Modal -->
      <div v-if="activeCalculator === 'age'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-green-600">Age Calculator</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Date of Birth</label>
          <input type="date" v-model="ageCalc.birthDate" class="w-full p-2 border rounded">
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">As of Date (default: today)</label>
          <input type="date" v-model="ageCalc.asOfDate" class="w-full p-2 border rounded">
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="calculateAge" class="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition duration-300 transform hover:scale-105">
            Calculate
          </button>

          <button @click="resetAgeCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="ageCalc.result" class="mt-4 p-3 bg-green-50 rounded">
          <h3 class="font-bold text-green-700">Result:</h3>
          <p>{{ ageCalc.result }}</p>
        </div>
      </div>

      <!-- Investment Calculator Modal -->
      <div v-if="activeCalculator === 'investment'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-purple-600">Investment Calculator</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">Initial Investment (₹)</label>
            <input type="number" v-model="investCalc.principal" min="0" class="w-full p-2 border rounded">
          </div>

          <div>
            <label class="block text-gray-700 mb-2">Annual Interest Rate (%)</label>
            <input type="number" v-model="investCalc.rate" min="0" step="0.01" class="w-full p-2 border rounded">
          </div>

          <div>
            <label class="block text-gray-700 mb-2">Time Period (Years)</label>
            <input type="number" v-model="investCalc.years" min="1" class="w-full p-2 border rounded">
          </div>

          <div>
            <label class="block text-gray-700 mb-2">Compounding Frequency</label>
            <select v-model="investCalc.frequency" class="w-full p-2 border rounded">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label class="block text-gray-700 mb-2">Additional Contribution (₹)</label>
            <input type="number" v-model="investCalc.contribution" min="0" class="w-full p-2 border rounded">
          </div>

          <div>
            <label class="block text-gray-700 mb-2">Contribution Frequency</label>
            <select v-model="investCalc.contributionFrequency" class="w-full p-2 border rounded">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="calculateInvestment" class="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition duration-300 transform hover:scale-105">
            Calculate
          </button>

          <button @click="resetInvestmentCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="investCalc.result" class="mt-4">
          <div class="p-3 bg-purple-50 rounded mb-4">
            <h3 class="font-bold text-purple-700">Summary:</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              <div class="p-2 bg-white rounded shadow">
                <p class="text-sm text-gray-600">Total Investment</p>
                <p class="font-bold">₹{{ investCalc.result.totalInvestment.toFixed(2) }}</p>
              </div>
              <div class="p-2 bg-white rounded shadow">
                <p class="text-sm text-gray-600">Interest Earned</p>
                <p class="font-bold">₹{{ investCalc.result && investCalc.result.interestEarned ? investCalc.result.interestEarned.toFixed(2) : '0.00' }}</p>
              </div>
              <div class="p-2 bg-white rounded shadow">
                <p class="text-sm text-gray-600">Final Value</p>
                <p class="font-bold">₹{{ investCalc.result && investCalc.result.finalValue ? investCalc.result.finalValue.toFixed(2) : '0.00' }}</p>
              </div>
            </div>
          </div>

          <h3 class="font-bold text-purple-700 mb-2">Year-by-Year Breakdown:</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full bg-white border">
              <thead>
                <tr>
                  <th class="py-2 px-4 border-b">Year</th>
                  <th class="py-2 px-4 border-b">Starting Balance</th>
                  <th class="py-2 px-4 border-b">Contributions</th>
                  <th class="py-2 px-4 border-b">Interest Earned</th>
                  <th class="py-2 px-4 border-b">Ending Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(year, index) in investCalc.result.yearlyBreakdown" :key="index" class="hover:bg-gray-50">
                  <td class="py-2 px-4 border-b">{{ year.year }}</td>
                  <td class="py-2 px-4 border-b">₹{{ year.startBalance.toFixed(2) }}</td>
                  <td class="py-2 px-4 border-b">₹{{ year.contributions.toFixed(2) }}</td>
                  <td class="py-2 px-4 border-b">₹{{ year.interest.toFixed(2) }}</td>
                  <td class="py-2 px-4 border-b">₹{{ year.endBalance.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Loan Calculator Modal -->
      <div v-if="activeCalculator === 'loan'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-blue-600">Loan Calculator</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">Loan Amount (₹)</label>
            <input type="number" v-model="loanCalc.principal" min="0" class="w-full p-2 border rounded">
          </div>

          <div>
            <label class="block text-gray-700 mb-2">Interest Rate (% per annum)</label>
            <input type="number" v-model="loanCalc.rate" min="0" step="0.01" class="w-full p-2 border rounded">
          </div>

          <div>
            <label class="block text-gray-700 mb-2">Loan Term (Years)</label>
            <input type="number" v-model="loanCalc.years" min="1" class="w-full p-2 border rounded">
          </div>

          <div>
            <label class="block text-gray-700 mb-2">Interest Type</label>
            <select v-model="loanCalc.type" class="w-full p-2 border rounded">
              <option value="simple">Simple Interest</option>
              <option value="reducing">Reducing Balance</option>
            </select>
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="calculateLoan" class="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition duration-300 transform hover:scale-105">
            Calculate
          </button>

          <button @click="resetLoanCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="loanCalc.result" class="mt-4">
          <div class="p-3 bg-blue-50 rounded mb-4">
            <h3 class="font-bold text-blue-700">Summary:</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              <div class="p-2 bg-white rounded shadow">
                <p class="text-sm text-gray-600">Principal Amount</p>
                <p class="font-bold">₹{{ loanCalc.principal ? loanCalc.principal.toFixed(2) : '0.00' }}</p>
              </div>
              <div class="p-2 bg-white rounded shadow">
                <p class="text-sm text-gray-600">Total Interest</p>
                <p class="font-bold">₹{{ loanCalc.result && loanCalc.result.totalInterest ? loanCalc.result.totalInterest.toFixed(2) : '0.00' }}</p>
              </div>
              <div class="p-2 bg-white rounded shadow">
                <p class="text-sm text-gray-600">Total Payment</p>
                <p class="font-bold">₹{{ loanCalc.result && loanCalc.result.totalPayment ? loanCalc.result.totalPayment.toFixed(2) : '0.00' }}</p>
              </div>
            </div>
            <div v-if="loanCalc.type === 'reducing' && loanCalc.result && loanCalc.result.emi" class="mt-2">
              <p class="text-sm text-gray-600">Monthly EMI: <span class="font-bold">₹{{ loanCalc.result.emi.toFixed(2) }}</span></p>
            </div>
          </div>

          <div v-if="loanCalc.type === 'reducing'">
            <h3 class="font-bold text-blue-700 mb-2">Amortization Schedule:</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full bg-white border">
                <thead>
                  <tr>
                    <th class="py-2 px-4 border-b">Month</th>
                    <th class="py-2 px-4 border-b">Payment</th>
                    <th class="py-2 px-4 border-b">Principal</th>
                    <th class="py-2 px-4 border-b">Interest</th>
                    <th class="py-2 px-4 border-b">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(payment, index) in loanCalc.result.schedule" :key="index" class="hover:bg-gray-50">
                    <td class="py-2 px-4 border-b">{{ payment ? payment.month : '' }}</td>
                    <td class="py-2 px-4 border-b">₹{{ payment && payment.payment ? payment.payment.toFixed(2) : '0.00' }}</td>
                    <td class="py-2 px-4 border-b">₹{{ payment && payment.principal ? payment.principal.toFixed(2) : '0.00' }}</td>
                    <td class="py-2 px-4 border-b">₹{{ payment && payment.interest ? payment.interest.toFixed(2) : '0.00' }}</td>
                    <td class="py-2 px-4 border-b">₹{{ payment && payment.balance ? payment.balance.toFixed(2) : '0.00' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Length Calculator Modal -->
      <div v-if="activeCalculator === 'length'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-teal-600">Length Converter</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Value</label>
          <input type="number" v-model="lengthCalc.value" min="0" step="0.0001" class="w-full p-2 border rounded">
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">From</label>
            <select v-model="lengthCalc.from" class="w-full p-2 border rounded">
              <option v-for="unit in lengthUnits" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
          </div>

          <div>
            <label class="block text-gray-700 mb-2">To</label>
            <select v-model="lengthCalc.to" class="w-full p-2 border rounded">
              <option v-for="unit in lengthUnits" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
          </div>
        </div>

        <div class="flex space-x-2">
          <button @click="convertLength" class="flex-1 bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition duration-300 transform hover:scale-105">
            Convert
          </button>

          <button @click="resetLengthCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="lengthCalc.result !== null" class="mt-4 p-3 bg-teal-50 rounded">
          <h3 class="font-bold text-teal-700">Result:</h3>
          <p>{{ lengthCalc.value }} {{ getLengthUnitLabel(lengthCalc.from) }} = {{ lengthCalc.result }} {{ getLengthUnitLabel(lengthCalc.to) }}</p>
        </div>
      </div>

      <!-- Percentage Calculator Modal -->
      <div v-if="activeCalculator === 'percentage'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-indigo-600">Percentage Calculator</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Calculation Type</label>
          <div class="flex space-x-4">
            <label class="inline-flex items-center">
              <input type="radio" v-model="percentCalc.type" value="percentage" class="form-radio text-indigo-600">
              <span class="ml-2">Find Percentage</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" v-model="percentCalc.type" value="increase" class="form-radio text-indigo-600">
              <span class="ml-2">Percentage Increase</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" v-model="percentCalc.type" value="decrease" class="form-radio text-indigo-600">
              <span class="ml-2">Percentage Decrease</span>
            </label>
          </div>
        </div>

        <div v-if="percentCalc.type === 'percentage'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">Value</label>
            <input type="number" v-model="percentCalc.value" min="0" step="0.01" class="w-full p-2 border rounded">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">Total</label>
            <input type="number" v-model="percentCalc.total" min="0" step="0.01" class="w-full p-2 border rounded">
          </div>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">Original Value</label>
            <input type="number" v-model="percentCalc.originalValue" min="0" step="0.01" class="w-full p-2 border rounded">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">New Value</label>
            <input type="number" v-model="percentCalc.newValue" min="0" step="0.01" class="w-full p-2 border rounded">
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="calculatePercentage" class="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition duration-300 transform hover:scale-105">
            Calculate
          </button>
          <button @click="resetPercentageCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="percentCalc.result !== null" class="mt-4 p-3 bg-indigo-50 rounded">
          <h3 class="font-bold text-indigo-700">Result:</h3>
          <p>{{ percentCalc.result }}</p>
        </div>
      </div>

      <!-- Discount Calculator Modal -->
      <div v-if="activeCalculator === 'discount'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-green-600">Discount Calculator</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">Original Price (₹)</label>
            <input type="number" v-model="discountCalc.originalPrice" min="0" step="0.01" class="w-full p-2 border rounded">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">Discount (%)</label>
            <input type="number" v-model="discountCalc.discountPercent" min="0" max="100" step="0.01" class="w-full p-2 border rounded">
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="calculateDiscount" class="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition duration-300 transform hover:scale-105">
            Calculate
          </button>
          <button @click="resetDiscountCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="discountCalc.result" class="mt-4 p-3 bg-green-50 rounded">
          <h3 class="font-bold text-green-700">Results:</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div class="p-2 bg-white rounded shadow">
              <p class="text-sm text-gray-600">Discount Amount</p>
              <p class="font-bold">₹{{ discountCalc.result.discountAmount.toFixed(2) }}</p>
            </div>
            <div class="p-2 bg-white rounded shadow">
              <p class="text-sm text-gray-600">Final Price</p>
              <p class="font-bold">₹{{ discountCalc.result.finalPrice.toFixed(2) }}</p>
            </div>
            <div class="p-2 bg-white rounded shadow">
              <p class="text-sm text-gray-600">You Save</p>
              <p class="font-bold">₹{{ discountCalc.result.youSave.toFixed(2) }} ({{ discountCalc.discountPercent }}%)</p>
            </div>
          </div>
        </div>
      </div>

      <!-- GST Calculator Modal -->
      <div v-if="activeCalculator === 'gst'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-purple-600">GST Calculator</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Calculation Type</label>
          <div class="flex space-x-4">
            <label class="inline-flex items-center">
              <input type="radio" v-model="gstCalc.type" value="exclusive" class="form-radio text-purple-600">
              <span class="ml-2">Add GST (Exclusive)</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" v-model="gstCalc.type" value="inclusive" class="form-radio text-purple-600">
              <span class="ml-2">Extract GST (Inclusive)</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">{{ gstCalc.type === 'exclusive' ? 'Original Amount (₹)' : 'Amount with GST (₹)' }}</label>
            <input type="number" v-model="gstCalc.amount" min="0" step="0.01" class="w-full p-2 border rounded">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">GST Rate (%)</label>
            <select v-model="gstCalc.rate" class="w-full p-2 border rounded">
              <option value="0">0% (Exempt)</option>
              <option value="3">3% (Special Rate)</option>
              <option value="5">5% (Lower Rate)</option>
              <option value="12">12% (Standard Rate)</option>
              <option value="18">18% (Standard Rate)</option>
              <option value="28">28% (Higher Rate)</option>
            </select>
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="calculateGST" class="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition duration-300 transform hover:scale-105">
            Calculate
          </button>
          <button @click="resetGSTCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="gstCalc.result" class="mt-4 p-3 bg-purple-50 rounded">
          <h3 class="font-bold text-purple-700">Results:</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div class="p-2 bg-white rounded shadow">
              <p class="text-sm text-gray-600">{{ gstCalc.type === 'exclusive' ? 'Original Amount' : 'Amount without GST' }}</p>
              <p class="font-bold">₹{{ gstCalc.result.originalAmount.toFixed(2) }}</p>
            </div>
            <div class="p-2 bg-white rounded shadow">
              <p class="text-sm text-gray-600">GST Amount ({{ gstCalc.rate }}%)</p>
              <p class="font-bold">₹{{ gstCalc.result.gstAmount.toFixed(2) }}</p>
            </div>
            <div class="p-2 bg-white rounded shadow">
              <p class="text-sm text-gray-600">{{ gstCalc.type === 'exclusive' ? 'Final Amount with GST' : 'Amount with GST' }}</p>
              <p class="font-bold">₹{{ gstCalc.result.finalAmount.toFixed(2) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Currency Converter Modal -->
      <div v-if="activeCalculator === 'currency'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-blue-600">Currency Converter</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Amount</label>
          <input type="number" v-model="currencyCalc.amount" min="0" step="0.01" class="w-full p-2 border rounded">
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">From</label>
            <select v-model="currencyCalc.from" class="w-full p-2 border rounded">
              <option v-for="currency in currencies" :key="currency.code" :value="currency.code">{{ currency.name }} ({{ currency.code }})</option>
            </select>
          </div>
          <div>
            <label class="block text-gray-700 mb-2">To</label>
            <select v-model="currencyCalc.to" class="w-full p-2 border rounded">
              <option v-for="currency in currencies" :key="currency.code" :value="currency.code">{{ currency.name }} ({{ currency.code }})</option>
            </select>
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="convertCurrency" class="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition duration-300 transform hover:scale-105">
            Convert
          </button>
          <button @click="refreshExchangeRates" class="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition duration-300 transform hover:scale-105">
            <span class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Rates
            </span>
          </button>
          <button @click="resetCurrencyCalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="currencyCalc.loading" class="mt-4 p-3 bg-blue-50 rounded flex items-center justify-center">
          <svg class="animate-spin h-5 w-5 mr-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading exchange rates...</span>
        </div>

        <div v-else-if="currencyCalc.error" class="mt-4 p-3 bg-red-50 rounded">
          <h3 class="font-bold text-red-700">Error:</h3>
          <p>{{ currencyCalc.error }}</p>
          <p class="text-sm mt-2">Using fallback exchange rates for now.</p>
        </div>

        <div v-else-if="currencyCalc.result !== null" class="mt-4 p-3 bg-blue-50 rounded">
          <h3 class="font-bold text-blue-700">Result:</h3>
          <p>{{ currencyCalc.amount }} {{ currencyCalc.from }} = {{ currencyCalc.result }} {{ currencyCalc.to }}</p>
          <p class="text-sm text-gray-500 mt-2">Exchange rate: 1 {{ currencyCalc.from }} = {{ currencyCalc.rate }} {{ currencyCalc.to }}</p>
          <p v-if="currencyCalc.lastUpdated" class="text-xs text-gray-500 mt-1">
            Rates last updated: {{ new Date(currencyCalc.lastUpdated).toLocaleString() }}
          </p>
        </div>
      </div>

      <!-- BMI Calculator Modal -->
      <div v-if="activeCalculator === 'bmi'" class="animate-fadeIn">
        <h2 class="text-2xl font-bold mb-4 text-teal-600">BMI Calculator</h2>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Unit System</label>
          <div class="flex space-x-4">
            <label class="inline-flex items-center">
              <input type="radio" v-model="bmiCalc.unit" value="metric" class="form-radio text-teal-600">
              <span class="ml-2">Metric (kg, cm)</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" v-model="bmiCalc.unit" value="imperial" class="form-radio text-teal-600">
              <span class="ml-2">Imperial (lb, in)</span>
            </label>
          </div>
        </div>

        <div v-if="bmiCalc.unit === 'metric'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">Weight (kg)</label>
            <input type="number" v-model="bmiCalc.weightKg" min="0" step="0.1" class="w-full p-2 border rounded">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">Height (cm)</label>
            <input type="number" v-model="bmiCalc.heightCm" min="0" step="0.1" class="w-full p-2 border rounded">
          </div>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-700 mb-2">Weight (lb)</label>
            <input type="number" v-model="bmiCalc.weightLb" min="0" step="0.1" class="w-full p-2 border rounded">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">Height (in)</label>
            <input type="number" v-model="bmiCalc.heightIn" min="0" step="0.1" class="w-full p-2 border rounded">
          </div>
        </div>

        <div class="flex space-x-2 mb-4">
          <button @click="calculateBMI" class="flex-1 bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition duration-300 transform hover:scale-105">
            Calculate
          </button>
          <button @click="resetBMICalc" class="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600 transition duration-300 transform hover:scale-105">
            Reset
          </button>
        </div>

        <div v-if="bmiCalc.result" class="mt-4 p-3 bg-teal-50 rounded">
          <h3 class="font-bold text-teal-700">Results:</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div class="p-2 bg-white rounded shadow">
              <p class="text-sm text-gray-600">Your BMI</p>
              <p class="font-bold">{{ bmiCalc.result.bmi.toFixed(1) }}</p>
            </div>
            <div class="p-2 bg-white rounded shadow">
              <p class="text-sm text-gray-600">Category</p>
              <p class="font-bold" :class="getBMICategoryColor(bmiCalc.result.category)">{{ bmiCalc.result.category }}</p>
            </div>
          </div>
          <div class="mt-4">
            <p class="text-sm text-gray-600">Healthy weight range for your height:</p>
            <p class="font-bold">{{ bmiCalc.result.healthyRange }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

// Calculator state
const display = ref('0');
const calculation = ref('');
const lastNumber = ref('');
const operator = ref('');
const clearNext = ref(false);
const displayRef = ref(null);
// Define activeCalculator ref
const activeCalculator = ref(null);

// Calculator functions
const appendDigit = (digit) => {
  if (clearNext.value) {
    display.value = digit;
    clearNext.value = false;
  } else {
    display.value = display.value === '0' ? digit : display.value + digit;
  }
};

const appendOperator = (op) => {
  if (operator.value && lastNumber.value) {
    display.value = '0.';
  }
  lastNumber.value = display.value;
  operator.value = op;
  calculation.value = `${lastNumber.value} ${op}`;
  clearNext.value = true;
};

const appendDecimal = () => {
  if (!display.value.includes('.')) {
    display.value += '.';
  }
};

const calculate = () => {
  if (!operator.value || !lastNumber.value) return;

  const num1 = parseFloat(lastNumber.value);
  const num2 = parseFloat(display.value);
  let result = 0;

  switch (operator.value) {
    case '+':
      result = num1 + num2;
      break;
    case '-':
      result = num1 - num2;
      break;
    case '*':
      result = num1 * num2;
      break;
    case '/':
      result = num2 !== 0 ? num1 / num2 : 'Error';
      break;
  }

  calculation.value = `${lastNumber.value} ${operator.value} ${display.value} =`;
  display.value = result.toString();
  lastNumber.value = '';
  operator.value = '';
  clearNext.value = true;
};

const clearAll = () => {
  display.value = '0';
  calculation.value = '';
  lastNumber.value = '';
  operator.value = '';
  clearNext.value = false;
};

const clearEntry = () => {
  display.value = '0';
};

const backspace = () => {
  display.value = display.value.length > 1 ? display.value.slice(0, -1) : '0';
};

const toggleSign = () => {
  display.value = (parseFloat(display.value) * -1).toString();
};

// Add keyboard event handler
const handleKeydown = (event)=> {
  // Only prevent default for calculator-related keys
  if (/^[0-9+\-*/.=,]$/.test(event.key.toLowerCase()) || event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault()
  }

  const key = event.key.toLowerCase()

  // Handle numeric keys (0-9)
  if (/^[0-9]$/.test(key)) {
    appendDigit(key)
  }
  // Handle operators
  else if (['+', '-', '*', '/'].includes(key)) {
    appendOperator(key)
  }
  // Handle decimal point
  else if (key === '.' || key === ',') {
    appendDecimal()
  }
  // Handle equals and enter
  else if (key === '=' || key === 'enter') {
    calculate()
  }
  // Handle escape key
  else if (key === 'escape') {
    closeModal()
  }
  // Handle backspace
  else if (key === 'backspace') {
    backspace()
  }
}




// Add event listener when calculator is active
watch(() => activeCalculator.value, (newValue) => {
  if (newValue === 'standard') {
    window.addEventListener('keydown', handleKeydown);
  } else {
    window.removeEventListener('keydown', handleKeydown);
  }
});

// Clean up event listener on component unmount
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
});

// List of calculators
const calculators = [
  { id: 'standard', name: 'Standard Calculator' },
  { id: 'percentage', name: 'Percentage Calculator' },
  { id: 'discount', name: 'Discount Calculator' },
  { id: 'gst', name: 'GST Calculator' },
  { id: 'currency', name: 'Currency Converter' },
  { id: 'bmi', name: 'BMI Calculator' },
  { id: 'volume', name: 'Volume Calculator' },
  { id: 'date', name: 'Date Calculator' },
  { id: 'age', name: 'Age Calculator' },
  { id: 'investment', name: 'Investment Calculator' },
  { id: 'loan', name: 'Loan Calculator' },
  { id: 'length', name: 'Length Converter' }
];

// Button colors
const buttonColors = [
  'bg-indigo-500 hover:bg-indigo-600',
  'bg-green-500 hover:bg-green-600',
  'bg-purple-500 hover:bg-purple-600',
  'bg-blue-500 hover:bg-blue-600',
  'bg-teal-500 hover:bg-teal-600',
];

// Get button color based on index
const getButtonColor = (index) => {
  return buttonColors[index % buttonColors.length];
};

// Open calculator
const openCalculator = (id) => {
  activeCalculator.value = id;
};

// Close calculator
const closeModal = () => {
  emit('close');
  // Reset active calculator when modal is closed
  activeCalculator.value = null;
};

// Date Calculator
const dateCalc = ref({
  operation: 'add',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  years: 0,
  months: 0,
  days: 0,
  result: null
});

const calculateDate = () => {
  if (!dateCalc.value.startDate) {
    alert('Please enter a start date');
    return;
  }

  const startDate = new Date(dateCalc.value.startDate);

  if (dateCalc.value.operation === 'difference') {
    if (!dateCalc.value.endDate) {
      alert('Please enter an end date');
      return;
    }

    const endDate = new Date(dateCalc.value.endDate);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Calculate years, months, and days
    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    let days = endDate.getDate() - startDate.getDate();

    if (days < 0) {
      months -= 1;
      // Get the last day of the previous month
      const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
      days += lastDayOfMonth;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    dateCalc.value.result = `${years} years, ${months} months, ${days} days (${diffDays} total days)`;
  } else {
    const resultDate = new Date(startDate);

    if (dateCalc.value.operation === 'add') {
      resultDate.setFullYear(resultDate.getFullYear() + parseInt(dateCalc.value.years || 0));
      resultDate.setMonth(resultDate.getMonth() + parseInt(dateCalc.value.months || 0));
      resultDate.setDate(resultDate.getDate() + parseInt(dateCalc.value.days || 0));
    } else { // subtract
      resultDate.setFullYear(resultDate.getFullYear() - parseInt(dateCalc.value.years || 0));
      resultDate.setMonth(resultDate.getMonth() - parseInt(dateCalc.value.months || 0));
      resultDate.setDate(resultDate.getDate() - parseInt(dateCalc.value.days || 0));
    }

    dateCalc.value.result = resultDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
};

const resetDateCalc = () => {
  dateCalc.value = {
    operation: 'add',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    years: 0,
    months: 0,
    days: 0,
    result: null
  };
};

// Age Calculator
const ageCalc = ref({
  birthDate: '',
  asOfDate: new Date().toISOString().split('T')[0],
  result: null
});

const calculateAge = () => {
  if (!ageCalc.value.birthDate) {
    alert('Please enter a birth date');
    return;
  }

  const birthDate = new Date(ageCalc.value.birthDate);
  const asOfDate = ageCalc.value.asOfDate ? new Date(ageCalc.value.asOfDate) : new Date();

  // Calculate years, months, and days
  let years = asOfDate.getFullYear() - birthDate.getFullYear();
  let months = asOfDate.getMonth() - birthDate.getMonth();
  let days = asOfDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    // Get the last day of the previous month
    const lastDayOfMonth = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 0).getDate();
    days += lastDayOfMonth;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  ageCalc.value.result = `${years} years, ${months} months, ${days} days`;
};

const resetAgeCalc = () => {
  ageCalc.value = {
    birthDate: '',
    asOfDate: new Date().toISOString().split('T')[0],
    result: null
  };
};

// Investment Calculator
const investCalc = ref({
  principal: 10000,
  rate: 8,
  years: 5,
  frequency: 'yearly',
  contribution: 1000,
  contributionFrequency: 'monthly',
  result: null
});

const calculateInvestment = () => {
  if (!investCalc.value.principal || !investCalc.value.rate || !investCalc.value.years) {
    alert('Please fill in all required fields');
    return;
  }

  const principal = parseFloat(investCalc.value.principal);
  const rate = parseFloat(investCalc.value.rate) / 100;
  const years = parseInt(investCalc.value.years);
  const contribution = parseFloat(investCalc.value.contribution || 0);

  // Calculate number of times interest is compounded per year
  let n = 1; // Default: yearly
  switch (investCalc.value.frequency) {
    case 'daily':
      n = 365;
      break;
    case 'weekly':
      n = 52;
      break;
    case 'monthly':
      n = 12;
      break;
    case 'quarterly':
      n = 4;
      break;
  }

  // Calculate number of contributions per year
  let contributionsPerYear = 0;
  switch (investCalc.value.contributionFrequency) {
    case 'monthly':
      contributionsPerYear = 12;
      break;
    case 'quarterly':
      contributionsPerYear = 4;
      break;
    case 'yearly':
      contributionsPerYear = 1;
      break;
  }

  // Calculate total contributions over the investment period
  const totalContributions = contribution * contributionsPerYear * years;

  // Calculate compound interest with regular contributions
  let balance = principal;
  const yearlyBreakdown = [];

  for (let year = 1; year <= years; year++) {
    const startBalance = balance;
    const yearlyContribution = contribution * contributionsPerYear;

    // Calculate interest for the year
    const interest = balance * Math.pow(1 + rate/n, n) - balance;

    // Add contributions
    balance += yearlyContribution;

    // Add interest
    balance += interest;

    yearlyBreakdown.push({
      year,
      startBalance,
      contributions: yearlyContribution,
      interest,
      endBalance: balance
    });
  }

  investCalc.value.result = {
    totalInvestment: principal + totalContributions,
    interestEarned: balance - principal - totalContributions,
    finalValue: balance,
    yearlyBreakdown
  };
};

const resetInvestmentCalc = () => {
  investCalc.value = {
    principal: 10000,
    rate: 8,
    years: 5,
    frequency: 'yearly',
    contribution: 1000,
    contributionFrequency: 'monthly',
    result: null
  };
};

// Loan Calculator
const loanCalc = ref({
  principal: 100000,
  rate: 10,
  years: 5,
  type: 'reducing',
  result: null
});

const calculateLoan = () => {
  if (!loanCalc.value.principal || !loanCalc.value.rate || !loanCalc.value.years) {
    alert('Please fill in all required fields');
    return;
  }

  const principal = parseFloat(loanCalc.value.principal);
  const rate = parseFloat(loanCalc.value.rate) / 100;
  const years = parseInt(loanCalc.value.years);
  const months = years * 12;

  if (loanCalc.value.type === 'simple') {
    // Simple interest calculation
    const interest = principal * rate * years;
    const totalPayment = principal + interest;

    loanCalc.value.result = {
      totalInterest: interest,
      totalPayment: totalPayment
    };
  } else {
    // Reducing balance (EMI) calculation
    const monthlyRate = rate / 12;
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);

    let balance = principal;
    let totalInterest = 0;
    const schedule = [];

    for (let month = 1; month <= months; month++) {
      const interest = balance * monthlyRate;
      const principalPaid = emi - interest;

      balance -= principalPaid;
      totalInterest += interest;

      // Add to schedule (limit to first 24 months for performance)
      if (month <= 24) {
        schedule.push({
          month,
          payment: emi,
          principal: principalPaid,
          interest,
          balance: balance > 0 ? balance : 0
        });
      }
    }

    loanCalc.value.result = {
      emi,
      totalInterest,
      totalPayment: principal + totalInterest,
      schedule
    };
  }
};

const resetLoanCalc = () => {
  loanCalc.value = {
    principal: 100000,
    rate: 10,
    years: 5,
    type: 'reducing',
    result: null
  };
};

// Volume Calculator
const volumeUnits = [
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'l', label: 'Liters (l)' },
  { value: 'gal', label: 'Gallons (gal)' },
  { value: 'qt', label: 'Quarts (qt)' },
  { value: 'pt', label: 'Pints (pt)' },
  { value: 'cup', label: 'Cups (cup)' },
  { value: 'oz', label: 'Fluid Ounces (oz)' },
  { value: 'tbsp', label: 'Tablespoons (tbsp)' },
  { value: 'tsp', label: 'Teaspoons (tsp)' }
];

const volumeCalc = ref({
  value: 1,
  from: 'l',
  to: 'gal',
  result: null
});

const getVolumeUnitLabel = (value) => {
  const unit = volumeUnits.find(u => u.value === value);
  return unit ? unit.label : value;
};

const convertVolume = () => {
  if (!volumeCalc.value.value) {
    alert('Please enter a value');
    return;
  }

  const value = parseFloat(volumeCalc.value.value);
  const from = volumeCalc.value.from;
  const to = volumeCalc.value.to;

  // Convert to liters first (base unit)
  let liters = 0;

  switch (from) {
    case 'ml':
      liters = value / 1000;
      break;
    case 'l':
      liters = value;
      break;
    case 'gal':
      liters = value * 3.78541;
      break;
    case 'qt':
      liters = value * 0.946353;
      break;
    case 'pt':
      liters = value * 0.473176;
      break;
    case 'cup':
      liters = value * 0.236588;
      break;
    case 'oz':
      liters = value * 0.0295735;
      break;
    case 'tbsp':
      liters = value * 0.0147868;
      break;
    case 'tsp':
      liters = value * 0.00492892;
      break;
  }

  // Convert from liters to target unit
  let result = 0;

  switch (to) {
    case 'ml':
      result = liters * 1000;
      break;
    case 'l':
      result = liters;
      break;
    case 'gal':
      result = liters / 3.78541;
      break;
    case 'qt':
      result = liters / 0.946353;
      break;
    case 'pt':
      result = liters / 0.473176;
      break;
    case 'cup':
      result = liters / 0.236588;
      break;
    case 'oz':
      result = liters / 0.0295735;
      break;
    case 'tbsp':
      result = liters / 0.0147868;
      break;
    case 'tsp':
      result = liters / 0.00492892;
      break;
  }

  volumeCalc.value.result = result;
};

const resetVolumeCalc = () => {
  volumeCalc.value = {
    value: 1,
    from: 'l',
    to: 'gal',
    result: null
  };
};

// Length Calculator
const lengthUnits = [
  { value: 'mm', label: 'Millimeters (mm)' },
  { value: 'cm', label: 'Centimeters (cm)' },
  { value: 'm', label: 'Meters (m)' },
  { value: 'km', label: 'Kilometers (km)' },
  { value: 'in', label: 'Inches (in)' },
  { value: 'ft', label: 'Feet (ft)' },
  { value: 'yd', label: 'Yards (yd)' },
  { value: 'mi', label: 'Miles (mi)' }
];

const lengthCalc = ref({
  value: 1,
  from: 'm',
  to: 'ft',
  result: null
});

const getLengthUnitLabel = (value) => {
  const unit = lengthUnits.find(u => u.value === value);
  return unit ? unit.label : value;
};

const convertLength = () => {
  if (!lengthCalc.value.value) {
    alert('Please enter a value');
    return;
  }

  const value = parseFloat(lengthCalc.value.value);
  const from = lengthCalc.value.from;
  const to = lengthCalc.value.to;

  // Convert to meters first (base unit)
  let meters = 0;

  switch (from) {
    case 'mm':
      meters = value / 1000;
      break;
    case 'cm':
      meters = value / 100;
      break;
    case 'm':
      meters = value;
      break;
    case 'km':
      meters = value * 1000;
      break;
    case 'in':
      meters = value * 0.0254;
      break;
    case 'ft':
      meters = value * 0.3048;
      break;
    case 'yd':
      meters = value * 0.9144;
      break;
    case 'mi':
      meters = value * 1609.34;
      break;
  }

  // Convert from meters to target unit
  let result = 0;

  switch (to) {
    case 'mm':
      result = meters * 1000;
      break;
    case 'cm':
      result = meters * 100;
      break;
    case 'm':
      result = meters;
      break;
    case 'km':
      result = meters / 1000;
      break;
    case 'in':
      result = meters / 0.0254;
      break;
    case 'ft':
      result = meters / 0.3048;
      break;
    case 'yd':
      result = meters / 0.9144;
      break;
    case 'mi':
      result = meters / 1609.34;
      break;
  }

  lengthCalc.value.result = result.toFixed(4);
};

const resetLengthCalc = () => {
  lengthCalc.value = {
    value: 1,
    from: 'm',
    to: 'ft',
    result: null
  };
};

// Percentage Calculator
const percentCalc = ref({
  type: 'percentage',
  value: 0,
  total: 0,
  originalValue: 0,
  newValue: 0,
  result: null
});

const calculatePercentage = () => {
  if (percentCalc.value.type === 'percentage') {
    if (!percentCalc.value.value || !percentCalc.value.total) {
      alert('Please enter both value and total');
      return;
    }

    const value = parseFloat(percentCalc.value.value);
    const total = parseFloat(percentCalc.value.total);
    const percentage = (value / total) * 100;

    percentCalc.value.result = `${value} is ${percentage.toFixed(2)}% of ${total}`;
  } else {
    if (!percentCalc.value.originalValue || !percentCalc.value.newValue) {
      alert('Please enter both original and new values');
      return;
    }

    const originalValue = parseFloat(percentCalc.value.originalValue);
    const newValue = parseFloat(percentCalc.value.newValue);
    const difference = newValue - originalValue;
    const percentageChange = (difference / originalValue) * 100;

    if (percentCalc.value.type === 'increase') {
      percentCalc.value.result = `The increase from ${originalValue} to ${newValue} is ${Math.abs(percentageChange).toFixed(2)}%`;
    } else {
      percentCalc.value.result = `The decrease from ${originalValue} to ${newValue} is ${Math.abs(percentageChange).toFixed(2)}%`;
    }
  }
};

const resetPercentageCalc = () => {
  percentCalc.value = {
    type: 'percentage',
    value: 0,
    total: 0,
    originalValue: 0,
    newValue: 0,
    result: null
  };
};

// Discount Calculator
const discountCalc = ref({
  originalPrice: 1000,
  discountPercent: 10,
  result: null
});

const calculateDiscount = () => {
  if (!discountCalc.value.originalPrice) {
    alert('Please enter the original price');
    return;
  }

  const originalPrice = parseFloat(discountCalc.value.originalPrice);
  const discountPercent = parseFloat(discountCalc.value.discountPercent || 0);
  const discountAmount = (originalPrice * discountPercent) / 100;
  const finalPrice = originalPrice - discountAmount;

  discountCalc.value.result = {
    discountAmount,
    finalPrice,
    youSave: discountAmount
  };
};

const resetDiscountCalc = () => {
  discountCalc.value = {
    originalPrice: 1000,
    discountPercent: 10,
    result: null
  };
};

// GST Calculator
const gstCalc = ref({
  type: 'exclusive',
  amount: 1000,
  rate: '18',
  result: null
});

const calculateGST = () => {
  if (!gstCalc.value.amount) {
    alert('Please enter an amount');
    return;
  }

  const amount = parseFloat(gstCalc.value.amount);
  const rate = parseFloat(gstCalc.value.rate);

  if (gstCalc.value.type === 'exclusive') {
    // Add GST to amount
    const gstAmount = (amount * rate) / 100;
    const finalAmount = amount + gstAmount;

    gstCalc.value.result = {
      originalAmount: amount,
      gstAmount,
      finalAmount
    };
  } else {
    // Extract GST from amount
    const originalAmount = amount / (1 + (rate / 100));
    const gstAmount = amount - originalAmount;

    gstCalc.value.result = {
      originalAmount,
      gstAmount,
      finalAmount: amount
    };
  }
};

const resetGSTCalc = () => {
  gstCalc.value = {
    type: 'exclusive',
    amount: 1000,
    rate: '18',
    result: null
  };
};

// Currency Converter
const currencies = [
  { code: 'INR', name: 'Indian Rupee', rate: 1 },
  { code: 'USD', name: 'US Dollar', rate: 0.012 },
  { code: 'EUR', name: 'Euro', rate: 0.011 },
  { code: 'GBP', name: 'British Pound', rate: 0.0095 },
  { code: 'JPY', name: 'Japanese Yen', rate: 1.78 },
  { code: 'AUD', name: 'Australian Dollar', rate: 0.018 },
  { code: 'CAD', name: 'Canadian Dollar', rate: 0.016 },
  { code: 'SGD', name: 'Singapore Dollar', rate: 0.016 },
  { code: 'AED', name: 'UAE Dirham', rate: 0.044 }
];

// Create a copy of the original rates for fallback
const fallbackRates = currencies.map(c => ({ ...c }));

const currencyCalc = ref({
  amount: 1000,
  from: 'INR',
  to: 'USD',
  result: null,
  rate: null,
  loading: false,
  error: null,
  lastUpdated: null
});

// Function to fetch real-time exchange rates
const fetchExchangeRates = async () => {
  currencyCalc.value.loading = true;
  currencyCalc.value.error = null;

  try {
    // Using ExchangeRate-API's free endpoint
    const response = await fetch('https://open.er-api.com/v6/latest/USD');

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.rates) {
      // Update our currency rates based on the API response
      currencies.forEach(currency => {
        if (data.rates[currency.code]) {
          // Convert all rates to be relative to USD (which is 1)
          if (currency.code === 'USD') {
            currency.rate = 1;
          } else {
            currency.rate = data.rates[currency.code];
          }
        }
      });

      currencyCalc.value.lastUpdated = new Date().toISOString();
      console.log('Exchange rates updated successfully');
    } else {
      throw new Error('Invalid API response format');
    }
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    currencyCalc.value.error = `Failed to fetch current exchange rates: ${error.message}`;

    // Restore fallback rates
    currencies.forEach((currency, index) => {
      currency.rate = fallbackRates[index].rate;
    });
  } finally {
    currencyCalc.value.loading = false;
  }
};

// Function to refresh exchange rates manually
const refreshExchangeRates = () => {
  fetchExchangeRates();
};

const convertCurrency = () => {
  if (!currencyCalc.value.amount) {
    alert('Please enter an amount');
    return;
  }

  const amount = parseFloat(currencyCalc.value.amount);
  const fromCurrency = currencies.find(c => c.code === currencyCalc.value.from);
  const toCurrency = currencies.find(c => c.code === currencyCalc.value.to);

  if (!fromCurrency || !toCurrency) {
    alert('Invalid currency selection');
    return;
  }

  // For API-based rates, we can directly convert using the rates
  // since they're all relative to USD
  const fromRate = fromCurrency.rate;
  const toRate = toCurrency.rate;

  // Calculate the conversion
  const result = amount * (toRate / fromRate);

  // Calculate the exchange rate
  const rate = toRate / fromRate;

  currencyCalc.value.result = result.toFixed(2);
  currencyCalc.value.rate = rate.toFixed(4);
};

const resetCurrencyCalc = () => {
  currencyCalc.value = {
    amount: 1000,
    from: 'INR',
    to: 'USD',
    result: null,
    rate: null,
    loading: false,
    error: null,
    lastUpdated: currencyCalc.value.lastUpdated
  };
};

// Fetch exchange rates when the calculator is first opened
onMounted(() => {
  // Fetch exchange rates when the component is mounted
  fetchExchangeRates();
});

// BMI Calculator
const bmiCalc = ref({
  unit: 'metric',
  weightKg: 70,
  heightCm: 170,
  weightLb: 154,
  heightIn: 67,
  result: null
});

const calculateBMI = () => {
  let bmi = 0;
  let heightM = 0;
  let weightKg = 0;

  if (bmiCalc.value.unit === 'metric') {
    if (!bmiCalc.value.weightKg || !bmiCalc.value.heightCm) {
      alert('Please enter both weight and height');
      return;
    }

    weightKg = parseFloat(bmiCalc.value.weightKg);
    heightM = parseFloat(bmiCalc.value.heightCm) / 100; // Convert cm to m
  } else {
    if (!bmiCalc.value.weightLb || !bmiCalc.value.heightIn) {
      alert('Please enter both weight and height');
      return;
    }

    weightKg = parseFloat(bmiCalc.value.weightLb) * 0.453592; // Convert lb to kg
    heightM = parseFloat(bmiCalc.value.heightIn) * 0.0254; // Convert in to m
  }

  // Calculate BMI
  bmi = weightKg / (heightM * heightM);

  // Determine BMI category
  let category = '';
  if (bmi < 18.5) {
    category = 'Underweight';
  } else if (bmi < 25) {
    category = 'Normal weight';
  } else if (bmi < 30) {
    category = 'Overweight';
  } else {
    category = 'Obese';
  }

  // Calculate healthy weight range
  const minWeight = 18.5 * (heightM * heightM);
  const maxWeight = 24.9 * (heightM * heightM);

  let healthyRange = '';
  if (bmiCalc.value.unit === 'metric') {
    healthyRange = `${minWeight.toFixed(1)} - ${maxWeight.toFixed(1)} kg`;
  } else {
    const minWeightLb = minWeight * 2.20462;
    const maxWeightLb = maxWeight * 2.20462;
    healthyRange = `${minWeightLb.toFixed(1)} - ${maxWeightLb.toFixed(1)} lb`;
  }

  bmiCalc.value.result = {
    bmi,
    category,
    healthyRange
  };
};

const getBMICategoryColor = (category) => {
  switch (category) {
    case 'Underweight':
      return 'text-blue-600';
    case 'Normal weight':
      return 'text-green-600';
    case 'Overweight':
      return 'text-orange-600';
    case 'Obese':
      return 'text-red-600';
    default:
      return '';
  }
};

const resetBMICalc = () => {
  bmiCalc.value = {
    unit: 'metric',
    weightKg: 70,
    heightCm: 170,
    weightLb: 154,
    heightIn: 67,
    result: null
  };
};
</script>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>