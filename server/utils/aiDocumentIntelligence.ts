import { AIService } from './aiService';

interface DocumentStructure {
  documentType: string;
  title: string;
  structure: {
    sections: Array<{
      name: string;
      content: any;
      type: 'text' | 'table' | 'list' | 'header' | 'footer' | 'signature';
      formatting?: any;
    }>;
  };
  metadata: {
    purpose: string;
    audience: string;
    formality: 'formal' | 'semi-formal' | 'casual';
    urgency: 'high' | 'medium' | 'low';
  };
  suggestedImprovements: string[];
  exportRecommendations: {
    excel: string;
    word: string;
    pdf: string;
  };
}

interface EnrichedDocument extends DocumentStructure {
  enrichedContent: any;
  businessData: any;
  generatedAt: Date;
}

// Fixed syntax errors
export class AIDocumentIntelligence {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  private async callAI(prompt: string, retryCount: number = 0): Promise<any> {
    const maxRetries = 2;

    try {
      console.log(`🤖 [AI DOC] Calling AI (attempt ${retryCount + 1}/${maxRetries + 1})`);
      const result = await this.aiService.generateContent({ prompt });
      let text = result.content;



      // Clean up the response text
      text = text.trim();

      // Remove any markdown code blocks if present
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Try to parse JSON response with multiple fallback strategies
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch (parseError) {
        console.log('🔍 [AI DOC] Initial JSON parse failed, trying extraction strategies...');
        console.log('📝 [AI DOC] Raw response:', text.substring(0, 500) + '...');

        // Strategy 1: Try to extract JSON from the response if it's embedded in other text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extracted = JSON.parse(jsonMatch[0]);
            console.log('✅ [AI DOC] Successfully extracted JSON from response');
            return extracted;
          } catch (extractError) {
            console.log('❌ [AI DOC] Failed to parse extracted JSON');
          }
        }

        // Strategy 2: Try to find JSON between specific markers
        const markers = [
          /```json\s*(\{[\s\S]*?\})\s*```/,
          /```\s*(\{[\s\S]*?\})\s*```/,
          /JSON:\s*(\{[\s\S]*?\})/i,
          /Response:\s*(\{[\s\S]*?\})/i
        ];

        for (const marker of markers) {
          const match = text.match(marker);
          if (match && match[1]) {
            try {
              const extracted = JSON.parse(match[1]);
              console.log('✅ [AI DOC] Successfully extracted JSON using marker strategy');
              return extracted;
            } catch (markerError) {
              console.log('❌ [AI DOC] Marker strategy failed');
            }
          }
        }

        // Strategy 3: Try to clean up common JSON formatting issues
        let cleanedText = text
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .replace(/^\s*JSON:\s*/i, '')
          .replace(/^\s*Response:\s*/i, '')
          .trim();

        // Remove any trailing text after the last }
        const lastBrace = cleanedText.lastIndexOf('}');
        if (lastBrace !== -1) {
          cleanedText = cleanedText.substring(0, lastBrace + 1);
        }

        try {
          const cleaned = JSON.parse(cleanedText);
          console.log('✅ [AI DOC] Successfully parsed cleaned JSON');
          return cleaned;
        } catch (cleanError) {
          console.log('❌ [AI DOC] All JSON parsing strategies failed');
        }

        // Log the full response for debugging
        console.error('🚨 [AI DOC] Complete AI response that failed parsing:');
        console.error('Response length:', text.length);
        console.error('First 1000 chars:', text.substring(0, 1000));
        console.error('Last 500 chars:', text.substring(Math.max(0, text.length - 500)));

        // STRICT REAL DATA ONLY - No fallback content allowed
        console.error('🚨 [AI DOC] AI response parsing failed completely - cannot create fallback content due to real-data-only requirement');

        // Throw error instead of creating fallback content
        throw new Error('AI response parsing failed and no fallback content is allowed (real data only requirement)');
      }
    } catch (error) {
      console.error(`❌ [AI DOC] AI call failed (attempt ${retryCount + 1}):`, error.message);

      // Retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        console.log(`🔄 [AI DOC] Retrying AI call (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive delay
        return this.callAI(prompt, retryCount + 1);
      }

      throw new Error(`AI processing failed after ${maxRetries + 1} attempts: ${error.message}`);
    }
  }

  async analyzeAndStructure(userRequest: string, firmData: any): Promise<DocumentStructure> {
    // REAL DATA ONLY - No fallback prompts allowed
    console.log('🤖 [AI DOC] Analyzing and structuring document with real data only');
    return await this.tryAnalyzeAndStructure(userRequest, firmData, false);
  }

  private async tryAnalyzeAndStructure(userRequest: string, firmData: any, useSimplePrompt: boolean): Promise<DocumentStructure> {
    const aiPrompt = useSimplePrompt ? `
Create a document structure for: "${userRequest}"

Return ONLY this JSON format:
{
  "documentType": "document type",
  "title": "document title",
  "structure": {
    "sections": [
      {
        "name": "section name",
        "content": "section content",
        "type": "text",
        "formatting": {"style": "normal", "alignment": "left", "emphasis": "normal"}
      }
    ]
  },
  "metadata": {
    "purpose": "document purpose",
    "audience": "target audience",
    "formality": "formal",
    "urgency": "medium"
  },
  "suggestedImprovements": ["improvement suggestions"],
  "exportRecommendations": {
    "excel": "Excel recommendation",
    "word": "Word recommendation",
    "pdf": "PDF recommendation"
  }
}` : `
You are an intelligent document creation AI with deep understanding of business documents and professional formatting.

User Request: "${userRequest}"

Available Business Data: ${JSON.stringify(firmData, null, 2)}

DOCUMENT CREATION PRINCIPLES:
- Create documents that are PROFESSIONAL but SIMPLE
- Avoid unnecessary complexity and jargon
- Use CLEAR, EASY-TO-UNDERSTAND language
- Focus on ESSENTIAL INFORMATION only
- Maintain CLEAN, READABLE formatting
- Be PRACTICAL and USER-FRIENDLY
- Keep business-appropriate standards without being overly formal

Your task is to analyze this user request and create a complete, professional document structure. Be creative and intelligent - don't limit yourself to predefined document types.

CRITICAL INSTRUCTIONS:
1. You MUST return ONLY valid JSON - no explanations, no markdown, no extra text
2. Understand what type of document the user needs based on context and intent
3. Determine the most appropriate structure and sections for this specific request
4. Extract or intelligently infer all necessary data from the user request
5. Create a complete, professional document structure that serves the user's purpose
6. Suggest any missing information that would improve the document
7. Be creative with document types - think beyond standard templates

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no markdown, no code blocks, no additional text.

RESPONSE FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "documentType": "AI-determined type (be creative and specific, not generic)",
  "title": "Professional document title",
  "structure": {
    "sections": [
      {
        "name": "section name",
        "content": "actual content, data, or placeholder text",
        "type": "text or table or list or header or footer or signature",
        "formatting": {
          "style": "formatting requirements",
          "alignment": "left or center or right",
          "emphasis": "bold or italic or normal"
        }
      }
    ]
  },
  "metadata": {
    "purpose": "clear purpose of this document",
    "audience": "target audience",
    "formality": "formal or semi-formal or casual",
    "urgency": "high or medium or low"
  },
  "suggestedImprovements": ["specific suggestions to make document better"],
  "exportRecommendations": {
    "excel": "specific reason why Excel would be beneficial for this document",
    "word": "specific reason why Word would be beneficial for this document", 
    "pdf": "specific reason why PDF would be beneficial for this document"
  }
}

Be intelligent, creative, and professional. Create documents that truly serve the user's business needs.
`;

    const result = await this.callAI(aiPrompt);
    return result;
  }

  async generateContent(documentStructure: DocumentStructure, additionalContext: string = ''): Promise<EnrichedDocument> {
    const aiPrompt = `
You are a professional content writer and business document expert. Take this document structure and create rich, detailed, professional content.

CONTENT CREATION GUIDELINES:
- Write in SIMPLE, CLEAR language that anyone can understand
- Avoid unnecessary jargon and complex terminology
- Keep content PROFESSIONAL but ACCESSIBLE
- Focus on PRACTICAL, ACTIONABLE information
- Use SHORT, CLEAR sentences and paragraphs
- Maintain BUSINESS-APPROPRIATE tone without being overly formal
- Ensure content is IMMEDIATELY USABLE for business purposes

Document Structure: ${JSON.stringify(documentStructure, null, 2)}
Additional Context: ${additionalContext}

Your task:
1. Fill in any missing content with professional, contextually appropriate text
2. Ensure consistency in tone and style throughout the document
3. Add relevant details that make the document complete and actionable
4. Format content appropriately for business use
5. Include any necessary legal disclaimers, terms, or standard business clauses
6. Make the content specific and valuable, not generic
7. Ensure all data is realistic and professional

CRITICAL REQUIREMENTS:
- You MUST return ONLY valid JSON - no explanations, no markdown, no extra text
- Replace any placeholder text with actual, meaningful content
- Ensure numbers, dates, and details are realistic and consistent
- Add professional language that matches the document type
- Include all necessary business elements (terms, conditions, etc.)

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no markdown, no code blocks, no additional text.

RESPONSE FORMAT: Return ONLY a valid JSON object that extends the original structure with enriched content:
{
  "documentType": "same as input",
  "title": "same as input", 
  "structure": {
    "sections": [
      {
        "name": "section name",
        "content": "ENRICHED CONTENT - detailed, professional, complete",
        "type": "same as input",
        "formatting": "enhanced formatting details"
      }
    ]
  },
  "metadata": "same as input with any enhancements",
  "suggestedImprovements": "updated suggestions",
  "exportRecommendations": "same as input",
  "enrichedContent": {
    "contentQuality": "professional or enhanced or complete",
    "completeness": "percentage of completion",
    "businessValue": "description of business value added"
  },
  "businessData": "any business data integrated",
  "generatedAt": "${new Date().toISOString()}"
}

Create content that is professional, detailed, and immediately usable for business purposes.
`;

    const result = await this.callAI(aiPrompt);

    return result;
  }

  async optimizeForFormat(documentData: EnrichedDocument, format: 'excel' | 'pdf' | 'word'): Promise<any> {
    let formatPrompt = '';

    switch (format) {
      case 'excel':
        formatPrompt = `
You are an Excel optimization expert. Transform this document into the best possible Excel format.

EXCEL FORMATTING PRINCIPLES:
- Keep layout SIMPLE and CLEAN
- Use CLEAR, READABLE fonts and appropriate sizes
- Avoid overly complex formulas or formatting
- Focus on PRACTICAL functionality
- Ensure data is EASY TO READ and UNDERSTAND
- Use simple color schemes and minimal styling
- Make it USER-FRIENDLY for business users

Document: ${JSON.stringify(documentData, null, 2)}

Create an Excel structure that:
1. Uses appropriate sheets if the document has multiple sections
2. Formats data in tables where beneficial with proper headers
3. Includes formulas for any calculations (totals, taxes, etc.)
4. Uses proper cell formatting (currency, dates, percentages, etc.)
5. Adds charts or graphs if data supports visualization
6. Includes data validation where appropriate
7. Uses professional styling and colors
8. Optimizes for both viewing and printing

RESPONSE FORMAT: Return ONLY a valid JSON object (no code blocks, no explanations):
{
  "sheets": [
    {
      "name": "sheet name",
      "cells": [
        {
          "address": "A1",
          "value": "cell value or formula",
          "formula": "Excel formula if applicable",
          "formatting": {
            "font": "font details",
            "alignment": "alignment",
            "border": "border style",
            "fill": "background color",
            "numberFormat": "number format"
          }
        }
      ],
      "charts": [
        {
          "type": "chart type",
          "position": "chart position",
          "data": "data range",
          "title": "chart title"
        }
      ],
      "columnWidths": {"A": 20, "B": 15},
      "rowHeights": {"1": 25}
    }
  ],
  "workbookProperties": {
    "title": "workbook title",
    "author": "author name",
    "created": "${new Date().toISOString()}"
  }
}
`;
        break;

      // Word generation temporarily disabled due to technical issues

      case 'pdf':
        formatPrompt = `
You are a PDF design expert. Transform this into a professional PDF layout structure.

Document: ${JSON.stringify(documentData, null, 2)}

PDF DESIGN PRINCIPLES:
- Keep design SIMPLE and CLEAN
- Use READABLE fonts and appropriate sizes
- Avoid overly complex layouts or decorative elements
- Focus on CLARITY and FUNCTIONALITY
- Ensure content is EASY TO READ and SCAN
- Use minimal but effective visual hierarchy
- Make it PROFESSIONAL but not overly formal

Create a PDF structure that:
1. Uses simple, professional typography with clear font sizes
2. Includes proper spacing and clean margins
3. Adds minimal visual elements (simple lines, clean boxes)
4. Ensures print-friendly layout with logical page breaks
5. Includes basic headers and footers as needed
6. Optimizes for both screen viewing and printing
7. Uses simple, professional color scheme
8. Adds practical signature areas if needed

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no markdown, no code blocks, no additional text.

RESPONSE FORMAT: Return ONLY a valid JSON object:
{
  "pages": [
    {
      "pageNumber": 1,
      "elements": [
        {
          "type": "text or table or image or line or rectangle",
          "content": "element content",
          "position": {"x": 50, "y": 100},
          "size": {"width": 500, "height": 20},
          "style": {
            "font": "font family",
            "fontSize": 12,
            "color": "#000000",
            "alignment": "left or center or right",
            "bold": true,
            "italic": false
          }
        }
      ],
      "header": "page header content",
      "footer": "page footer content"
    }
  ],
  "documentSettings": {
    "pageSize": "A4",
    "margins": {"top": 50, "bottom": 50, "left": 50, "right": 50},
    "orientation": "portrait or landscape"
  },
  "metadata": {
    "title": "PDF title",
    "author": "author name",
    "created": "${new Date().toISOString()}"
  }
}
`;
        break;

      case 'word':
        formatPrompt = `
You are a Word document optimization expert. Transform this document into the best possible Word format.

WORD FORMATTING PRINCIPLES:
- Create professional, well-structured documents
- Use appropriate headings, paragraphs, and sections
- Apply consistent formatting and styling
- Include tables where data is structured
- Use proper spacing and alignment
- Focus on readability and professional appearance

Document: ${JSON.stringify(documentData, null, 2)}

Create a Word document structure that:
1. Uses proper sections and page layouts
2. Formats text with appropriate styles (headings, body text, etc.)
3. Includes tables for structured data
4. Uses professional fonts and spacing
5. Adds headers and footers if appropriate
6. Optimizes for both viewing and printing

RESPONSE FORMAT: Return ONLY a valid JSON object:
{
  "sections": [
    {
      "name": "section name",
      "type": "content",
      "content": [
        {
          "type": "heading",
          "text": "heading text",
          "level": 1,
          "style": {
            "fontSize": 16,
            "bold": true,
            "color": "#000000"
          }
        },
        {
          "type": "paragraph",
          "text": "paragraph text",
          "style": {
            "fontSize": 12,
            "alignment": "left"
          }
        },
        {
          "type": "table",
          "headers": ["Column 1", "Column 2"],
          "rows": [
            ["Data 1", "Data 2"]
          ],
          "style": {
            "borderStyle": "single",
            "headerStyle": {
              "bold": true,
              "backgroundColor": "#f0f0f0"
            }
          }
        }
      ],
      "properties": {
        "margins": {
          "top": 1440,
          "right": 1440,
          "bottom": 1440,
          "left": 1440
        },
        "headers": "header text if needed",
        "footers": "footer text if needed"
      }
    }
  ],
  "documentProperties": {
    "title": "document title",
    "author": "author name",
    "created": "${new Date().toISOString()}"
  }
}
`;
        break;
    }

    const result = await this.callAI(formatPrompt);

    return result;
  }
}
