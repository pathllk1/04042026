<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300]" @click.self="closeModal">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h2 class="text-xl font-bold">Professional PDF Tools</h2>
          <span class="bg-white bg-opacity-20 px-2 py-1 rounded text-xs">Multi-Provider</span>
        </div>
        <button @click="closeModal" class="text-white hover:text-gray-200 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-gray-200 bg-gray-50">
        <nav class="flex space-x-8 px-6">
          <button
            @click="activeTab = 'ilovepdf'"
            :class="[
              activeTab === 'ilovepdf'
                ? 'border-red-500 text-red-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-all duration-200 rounded-t-lg'
            ]"
          >
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>ILovePDF</span>
              <span class="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Free</span>
            </div>
          </button>
          <button
            @click="activeTab = 'adobe'"
            :class="[
              activeTab === 'adobe'
                ? 'border-blue-500 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-all duration-200 rounded-t-lg'
            ]"
          >
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Adobe PDF Services</span>
              <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Enterprise</span>
            </div>
          </button>
        </nav>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
        <!-- ILovePDF Tab -->
        <div v-if="activeTab === 'ilovepdf'">
          <!-- API Key Configuration -->
          <div v-if="!hasApiKey" class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div class="flex-1">
              <h3 class="text-sm font-medium text-yellow-800">API Key Required</h3>
              <p class="text-sm text-yellow-700 mt-1">
                To use PDF tools, you need an ILovePDF API key. Get your free API key from 
                <a href="https://developer.ilovepdf.com/" target="_blank" class="underline font-medium">ILovePDF Developer</a>
                (250 files/month free).
              </p>
              <div class="mt-3 flex space-x-2">
                <input
                  v-model="tempApiKey"
                  type="password"
                  placeholder="Enter your ILovePDF API key"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <button
                  @click="saveApiKey"
                  :disabled="!tempApiKey.trim()"
                  class="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- API Key Management (when key exists) -->
        <div v-else class="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm text-green-800 font-medium">API Key Configured</span>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="testCurrentApiKey"
                :disabled="isLoading"
                class="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
              >
                Test Key
              </button>
              <button
                @click="removeApiKey"
                class="text-xs text-red-600 hover:text-red-800 underline"
              >
                Remove Key
              </button>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="isLoading" class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">Processing...</span>
            <span class="text-sm text-gray-500">{{ progress }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div 
              class="bg-red-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 class="text-sm font-medium text-red-800">Error</h3>
              <p class="text-sm text-red-700 mt-1">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- PDF Tools Grid -->
        <div v-if="hasApiKey" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Compress PDF -->
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-center space-x-3 mb-3">
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <h3 class="font-medium text-gray-900">Compress PDF</h3>
                <p class="text-sm text-gray-500">Reduce file size</p>
              </div>
            </div>
            <input
              ref="compressInput"
              type="file"
              accept=".pdf"
              @change="handleCompressFile"
              class="hidden"
            />
            <button
              @click="$refs.compressInput.click()"
              :disabled="isLoading"
              class="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select PDF to Compress
            </button>
          </div>

          <!-- Merge PDFs -->
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-center space-x-3 mb-3">
              <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 class="font-medium text-gray-900">Merge PDFs</h3>
                <p class="text-sm text-gray-500">Combine multiple files</p>
              </div>
            </div>
            <input
              ref="mergeInput"
              type="file"
              accept=".pdf"
              multiple
              @change="handleMergeFiles"
              class="hidden"
            />
            <button
              @click="$refs.mergeInput.click()"
              :disabled="isLoading"
              class="w-full px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select PDFs to Merge
            </button>
          </div>



          <!-- PDF to JPG -->
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-center space-x-3 mb-3">
              <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 class="font-medium text-gray-900">PDF to JPG</h3>
                <p class="text-sm text-gray-500">Convert to images</p>
              </div>
            </div>
            <input
              ref="jpgInput"
              type="file"
              accept=".pdf"
              @change="handleConvertToJpg"
              class="hidden"
            />
            <button
              @click="$refs.jpgInput.click()"
              :disabled="isLoading"
              class="w-full px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Convert to JPG
            </button>
          </div>

          <!-- Split PDF -->
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-center space-x-3 mb-3">
              <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-1" />
                </svg>
              </div>
              <div>
                <h3 class="font-medium text-gray-900">Split PDF</h3>
                <p class="text-sm text-gray-500">Extract pages</p>
              </div>
            </div>
            <input
              ref="splitInput"
              type="file"
              accept=".pdf"
              @change="handleSplitFile"
              class="hidden"
            />
            <button
              @click="$refs.splitInput.click()"
              :disabled="isLoading"
              class="w-full px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select PDF to Split
            </button>
          </div>
        </div>

          <!-- Usage Info -->
          <div v-if="hasApiKey" class="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 class="text-sm font-medium text-gray-900 mb-2">Usage Information</h3>
            <ul class="text-sm text-gray-600 space-y-1">
              <li>• Free tier: 250 files per month</li>
              <li>• Maximum file size: 100MB per file</li>
              <li>• Available tools: Compress, Merge, PDF to JPG, Split PDF</li>
              <li>• Files are processed securely and deleted after 1 hour</li>
            </ul>
          </div>
        </div>

        <!-- Adobe PDF Services Tab -->
        <div v-if="activeTab === 'adobe'">
          <!-- Adobe Credentials Configuration -->
          <div v-if="!adobeHasCredentials" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div class="flex items-start space-x-3">
              <svg class="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div class="flex-1">
                <h3 class="text-sm font-medium text-blue-800">Adobe PDF Services Credentials Required</h3>
                <p class="text-sm text-blue-700 mt-1">
                  To use Adobe PDF Services, you need API credentials. Get your free credentials from
                  <a href="https://acrobatservices.adobe.com/dc-integration-creation-app-cdn/main.html" target="_blank" class="underline font-medium">Adobe Developer Console</a>
                  (500 transactions/month free).
                </p>
                <div class="mt-3 space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-blue-800 mb-1">Client ID</label>
                    <input
                      v-model="tempAdobeCredentials.clientId"
                      type="text"
                      placeholder="Enter your Client ID"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-blue-800 mb-1">Client Secret</label>
                    <input
                      v-model="tempAdobeCredentials.clientSecret"
                      type="password"
                      placeholder="Enter your Client Secret"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-blue-800 mb-1">Organization ID</label>
                    <input
                      v-model="tempAdobeCredentials.organizationId"
                      type="text"
                      placeholder="Enter your Organization ID"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div class="flex space-x-2">
                    <button
                      @click="saveAdobeCredentials"
                      :disabled="!canSaveAdobeCredentials"
                      class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Credentials
                    </button>
                    <button
                      @click="testAdobeCredentials"
                      :disabled="!canSaveAdobeCredentials || adobeIsLoading"
                      class="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Test Connection
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Adobe Credentials Management -->
          <div v-if="adobeHasCredentials" class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 class="text-sm font-medium text-green-800">Adobe PDF Services Connected</h3>
                  <p class="text-sm text-green-700">Enterprise-grade PDF processing ready</p>
                </div>
              </div>
              <div class="flex space-x-2">
                <button
                  @click="testAdobeCredentials"
                  :disabled="adobeIsLoading"
                  class="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  @click="removeAdobeCredentials"
                  class="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <!-- Adobe PDF Tools Grid -->
          <div v-if="adobeHasCredentials" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Create PDF -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">Create PDF</h3>
                  <p class="text-sm text-gray-500">From Word, Excel, PPT, HTML</p>
                </div>
              </div>
              <input
                ref="adobeCreateInput"
                type="file"
                accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.html,.htm,.txt,.rtf,.jpg,.jpeg,.png,.bmp,.tiff,.gif"
                @change="handleAdobeCreatePdf"
                class="hidden"
              />
              <button
                @click="$refs.adobeCreateInput.click()"
                :disabled="adobeIsLoading"
                class="w-full px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select File to Convert
              </button>
            </div>

            <!-- Export PDF -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">Export PDF</h3>
                  <p class="text-sm text-gray-500">To Word, Excel, PPT, Images</p>
                </div>
              </div>
              <div class="space-y-2">
                <select
                  v-model="selectedExportFormat"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="docx">Word (.docx)</option>
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="pptx">PowerPoint (.pptx)</option>
                  <option value="rtf">Rich Text (.rtf)</option>
                  <option value="jpeg">JPEG Images</option>
                  <option value="png">PNG Images</option>
                </select>
                <input
                  ref="adobeExportInput"
                  type="file"
                  accept=".pdf"
                  @change="handleAdobeExportPdf"
                  class="hidden"
                />
                <button
                  @click="$refs.adobeExportInput.click()"
                  :disabled="adobeIsLoading"
                  class="w-full px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select PDF to Export
                </button>
              </div>
            </div>

            <!-- Compress PDF -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">Compress PDF</h3>
                  <p class="text-sm text-gray-500">Reduce file size</p>
                </div>
              </div>
              <div class="space-y-2">
                <select
                  v-model="selectedCompressionLevel"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="LOW">Low Compression</option>
                  <option value="MEDIUM">Medium Compression</option>
                  <option value="HIGH">High Compression</option>
                </select>
                <input
                  ref="adobeCompressInput"
                  type="file"
                  accept=".pdf"
                  @change="handleAdobeCompressPdf"
                  class="hidden"
                />
                <button
                  @click="$refs.adobeCompressInput.click()"
                  :disabled="adobeIsLoading"
                  class="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select PDF to Compress
                </button>
              </div>
            </div>

            <!-- Combine PDFs -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">Combine PDFs</h3>
                  <p class="text-sm text-gray-500">Merge multiple files</p>
                </div>
              </div>
              <input
                ref="adobeCombineInput"
                type="file"
                accept=".pdf"
                multiple
                @change="handleAdobeCombinePdfs"
                class="hidden"
              />
              <button
                @click="$refs.adobeCombineInput.click()"
                :disabled="adobeIsLoading"
                class="w-full px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select PDFs to Combine
              </button>
            </div>

            <!-- OCR PDF -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">OCR PDF</h3>
                  <p class="text-sm text-gray-500">Make scanned PDFs searchable</p>
                </div>
              </div>
              <div class="space-y-2">
                <select
                  v-model="selectedOcrLanguage"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="it-IT">Italian</option>
                  <option value="pt-BR">Portuguese</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="ko-KR">Korean</option>
                  <option value="zh-CN">Chinese (Simplified)</option>
                </select>
                <input
                  ref="adobeOcrInput"
                  type="file"
                  accept=".pdf"
                  @change="handleAdobeOcrPdf"
                  class="hidden"
                />
                <button
                  @click="$refs.adobeOcrInput.click()"
                  :disabled="adobeIsLoading"
                  class="w-full px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select PDF for OCR
                </button>
              </div>
            </div>

            <!-- Protect PDF -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">Protect PDF</h3>
                  <p class="text-sm text-gray-500">Add password protection</p>
                </div>
              </div>
              <div class="space-y-2">
                <input
                  v-model="pdfPassword"
                  type="password"
                  placeholder="Enter password for PDF"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <input
                  ref="adobeProtectInput"
                  type="file"
                  accept=".pdf"
                  @change="handleAdobeProtectPdf"
                  class="hidden"
                />
                <button
                  @click="$refs.adobeProtectInput.click()"
                  :disabled="adobeIsLoading || !pdfPassword.trim()"
                  class="w-full px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select PDF to Protect
                </button>
              </div>
            </div>

            <!-- Split PDF -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-1" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">Split PDF</h3>
                  <p class="text-sm text-gray-500">Extract pages</p>
                </div>
              </div>
              <input
                ref="adobeSplitInput"
                type="file"
                accept=".pdf"
                @change="handleAdobeSplitPdf"
                class="hidden"
              />
              <button
                @click="$refs.adobeSplitInput.click()"
                :disabled="adobeIsLoading"
                class="w-full px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select PDF to Split
              </button>
            </div>

            <!-- Extract PDF -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">Extract Content</h3>
                  <p class="text-sm text-gray-500">Extract text, images, tables</p>
                </div>
              </div>
              <input
                ref="adobeExtractInput"
                type="file"
                accept=".pdf"
                @change="handleAdobeExtractPdf"
                class="hidden"
              />
              <button
                @click="$refs.adobeExtractInput.click()"
                :disabled="adobeIsLoading"
                class="w-full px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select PDF to Extract
              </button>
            </div>

            <!-- Linearize PDF -->
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3 mb-3">
                <div class="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">Linearize PDF</h3>
                  <p class="text-sm text-gray-500">Optimize for fast web view</p>
                </div>
              </div>
              <input
                ref="adobeLinearizeInput"
                type="file"
                accept=".pdf"
                @change="handleAdobeLinearizePdf"
                class="hidden"
              />
              <button
                @click="$refs.adobeLinearizeInput.click()"
                :disabled="adobeIsLoading"
                class="w-full px-4 py-2 bg-pink-600 text-white rounded-md text-sm font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select PDF to Linearize
              </button>
            </div>
          </div>

          <!-- Adobe Usage Info -->
          <div v-if="adobeHasCredentials" class="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 class="text-sm font-medium text-blue-900 mb-2">Adobe PDF Services Information</h3>
            <ul class="text-sm text-blue-700 space-y-1">
              <li>• Free tier: 500 document transactions per month</li>
              <li>• Maximum file size: 100MB per file</li>
              <li>• Enterprise-grade processing with AI-powered features</li>
              <li>• Available operations: Create, Export, Compress, Combine, OCR, Extract, Protect, Split</li>
              <li>• Secure processing with Adobe's enterprise infrastructure</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useILovePDF } from '~/composables/utils/useILovePDF'
import { useAdobePDF } from '~/composables/utils/useAdobePDF'
import useToast from '~/composables/ui/useToast'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['close'])

// Tab state
const activeTab = ref('ilovepdf')

// ILovePDF Composable
const {
  isLoading,
  error,
  progress,
  hasApiKey,
  getApiKey,
  setApiKey,
  testApiKey,
  compressPdf,
  mergePdfs,
  convertPdfToJpg,
  splitPdf
} = useILovePDF()

// Adobe PDF Composable
const {
  isLoading: adobeIsLoading,
  error: adobeError,
  progress: adobeProgress,
  credentials: adobeCredentials,
  hasCredentials: adobeHasCredentials,
  saveCredentials: saveAdobeCredentialsInternal,
  clearCredentials: clearAdobeCredentials,
  testCredentials: testAdobeCredentialsInternal,
  initializeCredentials: initializeAdobeCredentials,
  createPdf: adobeCreatePdf,
  exportPdf: adobeExportPdf,
  compressPdf: adobeCompressPdf,
  combinePdfs: adobeCombinePdfs,
  ocrPdf: adobeOcrPdf,
  protectPdf: adobeProtectPdf,
  splitPdf: adobeSplitPdf,
  linearizePdf: adobeLinearizePdf,
  extractPdf: adobeExtractPdf
} = useAdobePDF()

const { success, error: showError } = useToast()

// Local state
const tempApiKey = ref('')
const tempAdobeCredentials = ref({
  clientId: '',
  clientSecret: '',
  organizationId: ''
})

// Adobe PDF options
const selectedExportFormat = ref('docx')
const selectedCompressionLevel = ref('MEDIUM')
const selectedOcrLanguage = ref('en-US')
const pdfPassword = ref('')

// Computed properties
const canSaveAdobeCredentials = computed(() => {
  return tempAdobeCredentials.value.clientId.trim() &&
         tempAdobeCredentials.value.clientSecret.trim() &&
         tempAdobeCredentials.value.organizationId.trim()
})

// Methods
const closeModal = () => {
  emit('close')
}

// ILovePDF Methods
const saveApiKey = () => {
  if (tempApiKey.value.trim()) {
    setApiKey(tempApiKey.value.trim())
    tempApiKey.value = ''
    success('API key saved successfully!')
  }
}

const removeApiKey = () => {
  if (confirm('Are you sure you want to remove your API key? You will need to re-enter it to use PDF tools.')) {
    setApiKey('')
    success('API key removed')
  }
}

const testCurrentApiKey = async () => {
  try {
    const result = await testApiKey()
    if (result.valid) {
      success(result.message)
    } else {
      showError(result.message)
    }
  } catch (err) {
    showError('Failed to test API key: ' + err.message)
  }
}

// Adobe PDF Methods
const saveAdobeCredentials = () => {
  if (canSaveAdobeCredentials.value) {
    const saved = saveAdobeCredentialsInternal(tempAdobeCredentials.value)
    if (saved) {
      tempAdobeCredentials.value = {
        clientId: '',
        clientSecret: '',
        organizationId: ''
      }
      success('Adobe PDF Services credentials saved successfully!')
    } else {
      showError('Failed to save Adobe PDF Services credentials')
    }
  }
}

const removeAdobeCredentials = () => {
  if (confirm('Are you sure you want to remove your Adobe PDF Services credentials?')) {
    clearAdobeCredentials()
    success('Adobe PDF Services credentials removed')
  }
}

const testAdobeCredentials = async () => {
  try {
    const result = await testAdobeCredentialsInternal()
    if (result.valid) {
      success(result.message)
    } else {
      showError(result.message)
    }
  } catch (err) {
    showError('Failed to test Adobe PDF Services credentials: ' + err.message)
  }
}

// ILovePDF File handlers
const handleCompressFile = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await compressPdf(file)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleMergeFiles = async (event) => {
  const files = Array.from(event.target.files)
  if (files.length < 2) {
    showError('Please select at least 2 PDF files to merge')
    return
  }

  try {
    const result = await mergePdfs(files)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleConvertToJpg = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await convertPdfToJpg(file)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleSplitFile = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await splitPdf(file)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

// Adobe PDF File handlers
const handleAdobeCreatePdf = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await adobeCreatePdf(file)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleAdobeExportPdf = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await adobeExportPdf(file, selectedExportFormat.value)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleAdobeCompressPdf = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await adobeCompressPdf(file, selectedCompressionLevel.value)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleAdobeCombinePdfs = async (event) => {
  const files = Array.from(event.target.files)
  if (files.length < 2) {
    showError('Please select at least 2 PDF files to combine')
    return
  }

  try {
    const result = await adobeCombinePdfs(files)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleAdobeOcrPdf = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await adobeOcrPdf(file, selectedOcrLanguage.value)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleAdobeProtectPdf = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  if (!pdfPassword.value.trim()) {
    showError('Please enter a password to protect the PDF')
    return
  }

  try {
    const result = await adobeProtectPdf(file, pdfPassword.value)
    success(result.message)
    pdfPassword.value = '' // Clear password after use
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleAdobeSplitPdf = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await adobeSplitPdf(file)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleAdobeExtractPdf = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await adobeExtractPdf(file, { includeStyling: true, getCharBounds: false })
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

const handleAdobeLinearizePdf = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await adobeLinearizePdf(file)
    success(result.message)
  } catch (err) {
    showError(err.message)
  }

  // Clear input
  event.target.value = ''
}

// Initialize
onMounted(() => {
  // Initialize Adobe PDF credentials on client-side
  initializeAdobeCredentials()

  // Pre-fill ILovePDF API key if it exists
  const existingKey = getApiKey()
  if (existingKey) {
    tempApiKey.value = existingKey
  }

  // Pre-fill Adobe credentials if they exist
  if (adobeHasCredentials.value) {
    // Don't pre-fill for security reasons, just show they exist
  }
})
</script>

<style scoped>
/* Custom scrollbar for modal content */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
