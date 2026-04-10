<template>
  <div class="custom-text-editor">
    <!-- Formatting Toolbar -->
    <div class="formatting-toolbar bg-gray-100 border border-gray-300 rounded-t-md p-2 flex flex-wrap gap-1">
      <!-- Text Formatting -->
      <div class="toolbar-group flex items-center border-r border-gray-300 pr-2 mr-2">
        <button
          type="button"
          @click="applyFormat('bold')"
          class="toolbar-btn"
          title="Bold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-2 3.5A4 4 0 0 1 18 15a4 4 0 0 1-4 4H6V4m4 5.5h3a1.5 1.5 0 0 0 0-3h-3v3m0 9h4a1.5 1.5 0 0 0 0-3h-4v3z"/>
          </svg>
        </button>
        <button
          type="button"
          @click="applyFormat('italic')"
          class="toolbar-btn"
          title="Italic"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M10 5v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V5h-8z"/>
          </svg>
        </button>
        <button
          type="button"
          @click="applyFormat('underline')"
          class="toolbar-btn"
          title="Underline"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M5 21h14v-2H5v2m7-4a6 6 0 0 0 6-6V3h-2.5v8a3.5 3.5 0 0 1-3.5 3.5A3.5 3.5 0 0 1 8.5 11V3H6v8a6 6 0 0 0 6 6z"/>
          </svg>
        </button>
        <button
          type="button"
          @click="insertCodeBlock"
          class="toolbar-btn"
          title="Code Block"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8,3A2,2 0 0,0 6,5V9A2,2 0 0,1 4,11A2,2 0 0,1 6,13V17A2,2 0 0,0 8,19H10V21H8A4,4 0 0,1 4,17V13A2,2 0 0,0 2,11A2,2 0 0,0 4,9V5A4,4 0 0,1 8,1H10V3M16,1A4,4 0 0,1 20,5V9A2,2 0 0,0 22,11A2,2 0 0,0 20,13V17A4,4 0 0,1 16,21H14V19H16A2,2 0 0,0 18,17V13A2,2 0 0,1 20,11A2,2 0 0,1 18,9V5A2,2 0 0,0 16,3H14V1H16Z" />
          </svg>
        </button>
      </div>

      <!-- Alignment -->
      <div class="toolbar-group flex items-center border-r border-gray-300 pr-2 mr-2">
        <button
          type="button"
          @click="applyFormat('align', 'left')"
          class="toolbar-btn"
          title="Align Left"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 3h18v2H3V3m0 4h12v2H3V7m0 4h18v2H3v-2m0 4h12v2H3v-2m0 4h18v2H3v-2z"/>
          </svg>
        </button>
        <button
          type="button"
          @click="applyFormat('align', 'center')"
          class="toolbar-btn"
          title="Align Center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 3h18v2H3V3m3 4h12v2H6V7m-3 4h18v2H3v-2m3 4h12v2H6v-2m-3 4h18v2H3v-2z"/>
          </svg>
        </button>
        <button
          type="button"
          @click="applyFormat('align', 'right')"
          class="toolbar-btn"
          title="Align Right"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 3h18v2H3V3m6 4h12v2H9V7m-6 4h18v2H3v-2m6 4h12v2H9v-2m-6 4h18v2H3v-2z"/>
          </svg>
        </button>
        <button
          type="button"
          @click="applyFormat('align', 'justify')"
          class="toolbar-btn"
          title="Justify"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 3h18v2H3V3m0 4h18v2H3V7m0 4h18v2H3v-2m0 4h18v2H3v-2m0 4h18v2H3v-2z"/>
          </svg>
        </button>
      </div>

      <!-- Vertical Alignment -->
      <div class="toolbar-group flex items-center border-r border-gray-300 pr-2 mr-2">
        <button
          type="button"
          @click="applyFormat('valign', 'top')"
          class="toolbar-btn"
          title="Align Top"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8 11h3v10h2V11h3l-4-4-4 4M4 3h16v2H4V3z"/>
          </svg>
        </button>
        <button
          type="button"
          @click="applyFormat('valign', 'middle')"
          class="toolbar-btn"
          title="Align Middle"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M13 9V3h-2v6H8l4 4 4-4h-3m-9 7h16v2H4v-2m5 5h3v-3h2v3h3l-4 4-4-4z"/>
          </svg>
        </button>
        <button
          type="button"
          @click="applyFormat('valign', 'bottom')"
          class="toolbar-btn"
          title="Align Bottom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M16 13h-3V3h-2v10H8l4 4 4-4M4 19h16v2H4v-2z"/>
          </svg>
        </button>
      </div>

      <!-- Colors -->
      <div class="toolbar-group flex items-center border-r border-gray-300 pr-2 mr-2">
        <div class="relative">
          <button
            type="button"
            @click="toggleColorPicker('text')"
            class="toolbar-btn flex items-center"
            title="Text Color"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M9.62 12L12 5.67 14.37 12M11 3L5.5 17h2.25l1.12-3h6.25l1.13 3h2.25L13 3h-2z"/>
            </svg>
            <div class="color-preview ml-1 w-4 h-4 rounded-full border border-gray-300" :style="{ backgroundColor: textColor }"></div>
          </button>
          <div v-if="showTextColorPicker" class="color-picker absolute top-full left-0 mt-1 p-3 bg-white border border-gray-300 rounded-md shadow-lg z-10" style="width: 380px;">
            <div class="grid grid-cols-10 gap-1.5">
              <div
                v-for="color in colorOptions"
                :key="color"
                class="color-option w-6 h-6 rounded-full cursor-pointer transition-transform duration-200 hover:scale-110"
                :style="{ backgroundColor: color }"
                @click="selectColor('text', color)"
              ></div>
            </div>
            <div class="mt-3 flex items-center">
              <label class="block text-sm font-medium text-gray-700 mr-2">Custom:</label>
              <input
                type="color"
                v-model="customTextColor"
                class="w-8 h-8 rounded cursor-pointer border-0"
                @change="selectColor('text', customTextColor)"
              />
            </div>
          </div>
        </div>

        <div class="relative ml-1">
          <button
            type="button"
            @click="toggleColorPicker('background')"
            class="toolbar-btn flex items-center"
            title="Background Color"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 11.5s-2 2.17-2 3.5a2 2 0 0 0 2 2 2 2 0 0 0 2-2c0-1.33-2-3.5-2-3.5M5.21 10L10 5.21 14.79 10m1.77-1.06L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.56-.59 1.53 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.59.59-1.56 0-2.12z"/>
            </svg>
            <div class="color-preview ml-1 w-4 h-4 rounded-full border border-gray-300" :style="{ backgroundColor: backgroundColor }"></div>
          </button>
          <div v-if="showBackgroundColorPicker" class="color-picker absolute top-full left-0 mt-1 p-3 bg-white border border-gray-300 rounded-md shadow-lg z-10" style="width: 380px;">
            <div class="grid grid-cols-10 gap-1.5">
              <div
                v-for="color in colorOptions"
                :key="color"
                class="color-option w-6 h-6 rounded-full cursor-pointer transition-transform duration-200 hover:scale-110"
                :style="{ backgroundColor: color }"
                @click="selectColor('background', color)"
              ></div>
            </div>
            <div class="mt-3 flex items-center">
              <label class="block text-sm font-medium text-gray-700 mr-2">Custom:</label>
              <input
                type="color"
                v-model="customBackgroundColor"
                class="w-8 h-8 rounded cursor-pointer border-0"
                @change="selectColor('background', customBackgroundColor)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Font Selection -->
      <div class="toolbar-group flex items-center border-r border-gray-300 pr-2 mr-2">
        <select
          v-model="selectedFont"
          @change="applyFormat('font', selectedFont)"
          class="toolbar-select"
          title="Font Family"
        >
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
          <option value="Impact, sans-serif">Impact</option>
        </select>
      </div>

      <!-- Font Size -->
      <div class="toolbar-group flex items-center border-r border-gray-300 pr-2 mr-2">
        <select
          v-model="selectedFontSize"
          @change="applyFormat('fontSize', selectedFontSize)"
          class="toolbar-select"
          title="Font Size"
        >
          <option value="8pt">8pt</option>
          <option value="10pt">10pt</option>
          <option value="12pt">12pt</option>
          <option value="14pt">14pt</option>
          <option value="16pt">16pt</option>
          <option value="18pt">18pt</option>
          <option value="24pt">24pt</option>
          <option value="36pt">36pt</option>
        </select>
      </div>

      <!-- Line and Paragraph Spacing -->
      <div class="toolbar-group flex items-center border-r border-gray-300 pr-2 mr-2">
        <select
          v-model="selectedLineHeight"
          @change="applyFormat('lineHeight', selectedLineHeight)"
          class="toolbar-select"
          title="Line Height"
        >
          <option value="1">Single</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">Double</option>
        </select>
      </div>

      <!-- Insert Table -->
      <div class="toolbar-group flex items-center">
        <div class="relative">
          <button
            type="button"
            @click="toggleTableCreator"
            class="toolbar-btn"
            title="Insert Table"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m0 4v4h6V8H5m8 0v4h6V8h-6m-8 6v4h6v-4H5m8 0v4h6v-4h-6z"/>
            </svg>
          </button>
          <div v-if="showTableCreator" class="table-creator absolute top-full left-0 mt-1 p-3 bg-white border border-gray-300 rounded-md shadow-lg z-10">
            <div class="flex items-center mb-3">
              <div class="mr-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">Rows</label>
                <input type="number" v-model.number="tableRows" min="1" max="10" class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Columns</label>
                <input type="number" v-model.number="tableColumns" min="1" max="10" class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
            </div>
            <button
              type="button"
              @click="insertTable"
              class="w-full px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:from-blue-600 hover:to-indigo-700 transition duration-300 shadow-sm font-medium"
            >
              Insert Table
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Editable Content Area -->
    <div
      ref="editorRef"
      contenteditable="true"
      @input="updateValue"
      class="editor-content w-full px-3 py-2 border border-gray-300 border-t-0 rounded-b-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      :style="{ height: height, minHeight: '200px', maxHeight: '60vh' }"
      :data-placeholder="placeholder"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  height: {
    type: String,
    default: '300px'
  },
  placeholder: {
    type: String,
    default: 'Enter your text here...'
  }
});

const emit = defineEmits(['update:modelValue']);

// References
const editorRef = ref(null);

// Watch for changes to the modelValue prop
watch(() => props.modelValue, (newValue) => {
  if (editorRef.value && editorRef.value.innerHTML !== newValue) {
    editorRef.value.innerHTML = newValue;
  }
}, { immediate: true });

// Formatting state
const selectedFont = ref('Arial, sans-serif');
const selectedFontSize = ref('12pt');
const selectedLineHeight = ref('1.5');
const textColor = ref('#000000');
const backgroundColor = ref('transparent');
const customTextColor = ref('#000000');
const customBackgroundColor = ref('#ffffff');

// Color picker state
const showTextColorPicker = ref(false);
const showBackgroundColorPicker = ref(false);
const colorOptions = [
  // Modern grayscale
  '#000000', '#212121', '#424242', '#616161', '#757575', '#9e9e9e', '#bdbdbd', '#e0e0e0', '#eeeeee', '#ffffff',

  // Material design colors - Red
  '#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828', '#b71c1c',

  // Material design colors - Pink
  '#fce4ec', '#f8bbd0', '#f48fb1', '#f06292', '#ec407a', '#e91e63', '#d81b60', '#c2185b', '#ad1457', '#880e4f',

  // Material design colors - Purple
  '#f3e5f5', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#9c27b0', '#8e24aa', '#7b1fa2', '#6a1b9a', '#4a148c',

  // Material design colors - Deep Purple
  '#ede7f6', '#d1c4e9', '#b39ddb', '#9575cd', '#7e57c2', '#673ab7', '#5e35b1', '#512da8', '#4527a0', '#311b92',

  // Material design colors - Indigo
  '#e8eaf6', '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0', '#3f51b5', '#3949ab', '#303f9f', '#283593', '#1a237e',

  // Material design colors - Blue
  '#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0', '#0d47a1',

  // Material design colors - Light Blue
  '#e1f5fe', '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#039be5', '#0288d1', '#0277bd', '#01579b',

  // Material design colors - Cyan
  '#e0f7fa', '#b2ebf2', '#80deea', '#4dd0e1', '#26c6da', '#00bcd4', '#00acc1', '#0097a7', '#00838f', '#006064',

  // Material design colors - Teal
  '#e0f2f1', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00897b', '#00796b', '#00695c', '#004d40'
];

// Table creator state
const showTableCreator = ref(false);
const tableRows = ref(3);
const tableColumns = ref(3);

// Update the value when the editor content changes
const updateValue = () => {
  if (editorRef.value) {
    emit('update:modelValue', editorRef.value.innerHTML);
  }
};

// Store the current selection when opening color picker
let savedRange = null;

// Insert code block
const insertCodeBlock = () => {
  if (!editorRef.value) return;

  // Focus the editor
  editorRef.value.focus();

  // Get the current selection
  const selection = window.getSelection();

  // Create a pre element for the code block
  const codeBlock = document.createElement('pre');
  codeBlock.style.backgroundColor = '#f5f5f5';
  codeBlock.style.padding = '10px';
  codeBlock.style.borderRadius = '4px';
  codeBlock.style.fontFamily = 'monospace';
  codeBlock.style.whiteSpace = 'pre';
  codeBlock.style.overflowX = 'auto';
  codeBlock.style.margin = '10px 0';

  // If there's a selection, use it as the content of the code block
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    // If there's selected text, use it
    if (selectedText) {
      codeBlock.textContent = selectedText;
      range.deleteContents();
      range.insertNode(codeBlock);
    } else {
      // If no text is selected, insert an empty code block with placeholder
      codeBlock.textContent = 'Your code here';
      range.insertNode(codeBlock);

      // Select the placeholder text
      const newRange = document.createRange();
      newRange.selectNodeContents(codeBlock);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  } else {
    // If no selection, just append to the end
    codeBlock.textContent = 'Your code here';
    editorRef.value.appendChild(codeBlock);
  }

  // Update the model value
  updateValue();
};

// Toggle table creator
const toggleTableCreator = () => {
  showTableCreator.value = !showTableCreator.value;
  showTextColorPicker.value = false;
  showBackgroundColorPicker.value = false;
};

// Toggle color pickers
const toggleColorPicker = (type) => {
  // Save the current selection
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0).cloneRange();
  }

  if (type === 'text') {
    showTextColorPicker.value = !showTextColorPicker.value;
    showBackgroundColorPicker.value = false;
  } else {
    showBackgroundColorPicker.value = !showBackgroundColorPicker.value;
    showTextColorPicker.value = false;
  }
};

// Select a color
const selectColor = (type, color) => {
  if (type === 'text') {
    textColor.value = color;
  } else {
    backgroundColor.value = color;
  }

  // Focus the editor
  if (editorRef.value) {
    editorRef.value.focus();

    // Restore the saved selection
    if (savedRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);

      // Apply the color
      if (type === 'text') {
        document.execCommand('foreColor', false, color);
      } else {
        document.execCommand('hiliteColor', false, color);
      }

      // Update the model
      updateValue();
    } else {
      // If no selection was saved, just set the current color for next use
      console.log('No text was selected when choosing color');
    }
  }

  // Close the color picker
  if (type === 'text') {
    showTextColorPicker.value = false;
  } else {
    showBackgroundColorPicker.value = false;
  }
};

// Apply formatting to the selected text
const applyFormat = (format, value) => {
  if (!editorRef.value) return;

  // Get the current selection
  const selection = window.getSelection();

  // Check if there's a selection
  if (selection.rangeCount === 0 && format !== 'insertTable') {
    alert('Please select some text to format');
    return;
  }

  // Save the current selection
  const range = selection.getRangeAt(0);

  // Apply the formatting using document.execCommand
  switch (format) {
    case 'bold':
      document.execCommand('bold', false, null);
      break;
    case 'italic':
      document.execCommand('italic', false, null);
      break;
    case 'underline':
      document.execCommand('underline', false, null);
      break;
    case 'align':
      document.execCommand('justify' + value.charAt(0).toUpperCase() + value.slice(1), false, null);
      break;
    case 'color':
      document.execCommand('foreColor', false, value);
      break;
    case 'backgroundColor':
      document.execCommand('hiliteColor', false, value);
      break;
    case 'font':
      document.execCommand('fontName', false, value);
      break;
    case 'fontSize':
      // Convert pt to 1-7 scale for execCommand
      const size = parseInt(value);
      let fontSizeValue = 3; // Default
      if (size <= 10) fontSizeValue = 1;
      else if (size <= 12) fontSizeValue = 2;
      else if (size <= 14) fontSizeValue = 3;
      else if (size <= 18) fontSizeValue = 4;
      else if (size <= 24) fontSizeValue = 5;
      else if (size <= 36) fontSizeValue = 6;
      else fontSizeValue = 7;

      document.execCommand('fontSize', false, fontSizeValue);
      break;
    case 'lineHeight':
      // Line height needs to be applied to a block element
      // First check if selection is inside a block element
      const parentBlock = getParentBlock(range.startContainer);
      if (parentBlock) {
        parentBlock.style.lineHeight = value;
      } else {
        // If not, wrap the selection in a div with the line height
        document.execCommand('formatBlock', false, 'div');
        const newBlock = getParentBlock(range.startContainer);
        if (newBlock) {
          newBlock.style.lineHeight = value;
        }
      }
      break;
    case 'valign':
      // Vertical alignment is typically used in table cells
      const parentCell = getParentElement(range.startContainer, ['td', 'th']);
      if (parentCell) {
        parentCell.style.verticalAlign = value;
      } else {
        // If not in a table cell, we can apply it to the current block
        const block = getParentBlock(range.startContainer);
        if (block) {
          block.style.verticalAlign = value;
        }
      }
      break;
  }

  // Update the model value
  updateValue();

  // Focus back on the editor
  editorRef.value.focus();
};

// Helper function to get the parent block element
const getParentBlock = (node) => {
  const blockTags = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'];

  while (node && node !== editorRef.value) {
    if (node.nodeType === 1 && blockTags.includes(node.tagName.toLowerCase())) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
};

// Helper function to get a specific parent element
const getParentElement = (node, tags) => {
  while (node && node !== editorRef.value) {
    if (node.nodeType === 1 && tags.includes(node.tagName.toLowerCase())) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
};

// Insert a table
const insertTable = () => {
  if (!editorRef.value) return;

  // Create table HTML
  let tableHtml = '<table style="width:100%; border-collapse: collapse;">';

  // Create table header
  tableHtml += '<thead><tr>';
  for (let col = 0; col < tableColumns.value; col++) {
    tableHtml += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;"></th>';
  }
  tableHtml += '</tr></thead>';

  // Create table body
  tableHtml += '<tbody>';
  for (let row = 0; row < tableRows.value; row++) {
    tableHtml += '<tr>';
    for (let col = 0; col < tableColumns.value; col++) {
      tableHtml += '<td style="border: 1px solid #ddd; padding: 8px;"></td>';
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table>';

  // Insert the table at the current selection
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    // Get the current range
    const range = selection.getRangeAt(0);

    // Delete any selected content
    range.deleteContents();

    // Create a new element with the table HTML
    const tableElement = document.createElement('div');
    tableElement.innerHTML = tableHtml;

    // Insert the table
    range.insertNode(tableElement.firstChild);

    // Update the model value
    updateValue();
  } else {
    // If no selection, append to the end
    editorRef.value.innerHTML += tableHtml;
    updateValue();
  }

  // Focus back on the editor
  editorRef.value.focus();

  // Hide the table creator
  showTableCreator.value = false;
};

// Close dropdowns when clicking outside
const handleClickOutside = (event) => {
  if (showTextColorPicker.value || showBackgroundColorPicker.value || showTableCreator.value) {
    const isClickInside = event.target.closest('.toolbar-btn') ||
                          event.target.closest('.color-picker') ||
                          event.target.closest('.table-creator');

    if (!isClickInside) {
      showTextColorPicker.value = false;
      showBackgroundColorPicker.value = false;
      showTableCreator.value = false;
    }
  }
};

// Lifecycle hooks
onMounted(() => {
  document.addEventListener('click', handleClickOutside);

  // Initialize the editor with the initial content
  if (editorRef.value && props.modelValue) {
    editorRef.value.innerHTML = props.modelValue;
  }

  // Add paste event listener to handle plain text pasting
  if (editorRef.value) {
    editorRef.value.addEventListener('paste', (e) => {
      // Prevent the default paste action
      e.preventDefault();

      // Get text from clipboard
      let text = '';
      if (e.clipboardData) {
        text = e.clipboardData.getData('text/plain');
      }

      // Insert text at the current position
      if (text) {
        // Use insertHTML for better compatibility
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(text);
          range.insertNode(textNode);

          // Move cursor to the end of inserted text
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);

          // Update the model
          updateValue();
        }
      }
    });
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);

  // Remove paste event listener
  if (editorRef.value) {
    editorRef.value.removeEventListener('paste', () => {});
  }
});
</script>

<style scoped>
.custom-text-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  flex-grow: 1;
}

.formatting-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background-color: white;
  border: 1px solid #e2e8f0;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background-color: #f7fafc;
  border-color: #cbd5e0;
}

.toolbar-btn:active {
  background-color: #edf2f7;
}

.toolbar-select {
  height: 28px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background-color: white;
  color: #4a5568;
  padding: 0 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.toolbar-select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
}

.editor-content {
  min-height: 200px;
  height: 100%;
  font-family: Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  overflow-y: scroll !important; /* Force scrollbar to always show */
  overflow-x: auto;
  flex-grow: 1;
}

[contenteditable]:empty:before {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
}

.color-option:hover {
  transform: scale(1.1);
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
}

/* Scrollbar styling */
.editor-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
  display: block !important;
}

.editor-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.editor-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.editor-content::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* Code block styling */
[contenteditable] pre {
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre;
  overflow-x: auto;
  margin: 10px 0;
}
</style>
