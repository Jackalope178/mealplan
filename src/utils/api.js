// API helpers for Claude Vision + macro estimation

// Runtime key cache
let _anthropicKey = null;

async function getAnthropicKey() {
  if (_anthropicKey) return _anthropicKey;

  // Try env var first (local dev)
  if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
    _anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    return _anthropicKey;
  }

  // Fetch from Supabase app_config table
  const { supabase } = await import('./supabaseClient.js');
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'anthropic_api_key')
    .maybeSingle();

  if (error || !data?.value) {
    throw new Error('Anthropic API key not configured. Add it to the app_config table in Supabase.');
  }

  _anthropicKey = data.value;
  return _anthropicKey;
}

async function callClaude(apiKey, messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse JSON from Claude response');
  }
}

// Claude Vision: extract ONE recipe from one or more photos
// Multiple photos are treated as different views of the same recipe (front/back, multiple pages)
export async function extractRecipeFromPhotos(images) {
  const apiKey = await getAnthropicKey();

  const content = [];

  // Add all images
  images.forEach((img, i) => {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType || 'image/jpeg', data: img.base64 },
    });
  });

  // Add the prompt
  content.push({
    type: 'text',
    text: `These ${images.length} photo${images.length > 1 ? 's are different views of the SAME recipe' : ' shows a recipe'} (e.g. front and back of a card, multiple cookbook pages). Combine all information into ONE complete recipe.

MACROS: First, look for any pre-printed nutrition information (calories, protein, carbs, fat per serving). If you find printed macros, use those exact values and set macroSource to "card". If NO printed macros are found, estimate the macros per serving yourself based on the ingredients — use your knowledge of nutritional data. Set macroSource to "calculated" in that case.

ALWAYS include macros — never return null for macros.

Return ONLY valid JSON with no preamble, no markdown fences:
{
  "name": "Recipe Name",
  "servings": 4,
  "ingredients": [
    { "quantity": "1", "unit": "cup", "name": "ingredient name" }
  ],
  "instructions": "Step-by-step instructions as a single string",
  "macros": { "calories": 500, "protein": 30, "carbs": 50, "fat": 20 },
  "macroSource": "card" or "calculated"
}

For ingredients, always include quantity, unit, and name. If a quantity is not clear, estimate reasonably. Return ONLY the JSON object.`,
  });

  return callClaude(apiKey, [{ role: 'user', content }]);
}

// Claude: estimate macros from an ingredient list (used by recipe editor "Recalculate" button)
export async function calculateMacros(ingredients, servings = 1) {
  const apiKey = await getAnthropicKey();

  const ingredientList = ingredients
    .map(i => `${i.quantity} ${i.unit} ${i.name}`)
    .join('\n');

  const result = await callClaude(apiKey, [{
    role: 'user',
    content: `Estimate the macronutrients PER SERVING for this recipe (${servings} servings total).

Ingredients:
${ingredientList}

Use your knowledge of nutritional data for common foods. Be as accurate as possible.

Return ONLY valid JSON, no preamble:
{ "calories": 500, "protein": 30, "carbs": 50, "fat": 20 }`,
  }]);

  return {
    calories: Math.round(result.calories || 0),
    protein: Math.round(result.protein || 0),
    carbs: Math.round(result.carbs || 0),
    fat: Math.round(result.fat || 0),
  };
}
