import { GoogleGenerativeAI } from '@google/generative-ai';
import { BankTransaction, QBTransaction } from './matcher';

export interface VendorMapping {
  canonical: string;
  variants: string[];
}

/**
 * Extract unique vendor names from bank and QB transactions
 */
function extractUniqueVendors(
  bankTransactions: BankTransaction[],
  qbTransactions: QBTransaction[]
): { bankVendors: string[]; qbVendors: string[] } {
  const bankVendors = [...new Set(bankTransactions.map(t => t.vendor.toUpperCase().trim()))];
  const qbVendors = [...new Set(qbTransactions.map(t => t.name.toUpperCase().trim()))];
  
  return { bankVendors, qbVendors };
}

/**
 * Call Gemini API to analyze vendors and suggest mappings
 */
export async function analyzeVendorsWithGemini(
  apiKey: string,
  bankTransactions: BankTransaction[],
  qbTransactions: QBTransaction[]
): Promise<{ [key: string]: string[] }> {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const { bankVendors, qbVendors } = extractUniqueVendors(bankTransactions, qbTransactions);

  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  // Create prompt
  const prompt = `You are a financial data analyst helping match vendor names from bank statements and QuickBooks entries.

BANK VENDORS:
${bankVendors.join('\n')}

QUICKBOOKS VENDORS:
${qbVendors.join('\n')}

Analyze these vendor lists and identify which names represent the same entity but are spelled/formatted differently.

Return ONLY a valid JSON object (no markdown, no code blocks) in this exact format:
{
  "CANONICAL_NAME": ["variant1", "variant2", "variant3"],
  "ANOTHER_CANONICAL": ["variant_a", "variant_b"]
}

Rules:
1. Group similar vendors under one canonical name (e.g., "CHASE", "CHASE BANK", "CHASE CARD" → all map to "CHASE")
2. Include common abbreviations (e.g., "BK OF AMER" → "BANK OF AMERICA")
3. Include typos and variations (e.g., "CHSE" → "CHASE")
4. Only include mappings where you're confident they're the same entity
5. Return ONLY the JSON object, nothing else

Example output:
{
  "CHASE": ["CHASE BANK", "CHASE CARD", "CHASE CREDIT CARD", "CHSE"],
  "BANK OF AMERICA": ["BK OF AMER", "BK OF", "BOA", "BANK OF AMERICA"]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    // Clean up response - remove markdown code blocks if present
    let jsonText = text;
    if (text.startsWith('```json')) {
      jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (text.startsWith('```')) {
      jsonText = text.replace(/```\n?/g, '').trim();
    }

    // Parse JSON
    const mappings = JSON.parse(jsonText);

    console.log('Gemini vendor mappings:', mappings);
    return mappings;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
