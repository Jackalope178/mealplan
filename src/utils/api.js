// API helpers for Claude Vision and Edamam Nutrition

// Edamam API credentials – replace with your own
const EDAMAM_APP_ID = 'YOUR_EDAMAM_APP_ID';
const EDAMAM_APP_KEY = 'YOUR_EDAMAM_APP_KEY';

// Claude Vision: extract recipe from photo
export async function extractRecipeFromPhoto(base64Image, mimeType = 'image/jpeg') {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key not found. Set VITE_ANTHROPIC_API_KEY in your environment.');
  }

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
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          {
            type: 'text',
            text: `Analyze this recipe image. First, look for any pre-printed macro/nutrition information on the card (calories, protein, carbs, fat). If you find printed macros, use those values and set macroSource to "card". If no macros are printed, extract the ingredient list and set macroSource to "calculated" (macros will be null so we can calculate them separately).

Return ONLY valid JSON with no preamble, no markdown fences, matching this exact schema:
{
  "name": "Recipe Name",
  "servings": 4,
  "ingredients": [
    { "quantity": "1", "unit": "cup", "name": "ingredient name" }
  ],
  "instructions": "Step-by-step instructions as a single string",
  "macros": { "calories": 500, "protein": 30, "carbs": 50, "fat": 20 } or null,
  "macroSource": "card" or "calculated"
}

For ingredients, always include quantity, unit, and name. If a quantity is not clear, estimate. Return ONLY the JSON object.`,
          },
        ],
      }],
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
    // Try to extract JSON from response if wrapped in markdown
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse recipe from Claude response');
  }
}

// Edamam: calculate macros from ingredient list
export async function calculateMacros(ingredients, servings = 1) {
  const ingredientLines = ingredients.map(
    i => `${i.quantity} ${i.unit} ${i.name}`
  );

  const response = await fetch(
    `https://api.edamam.com/api/nutrition-details?app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Recipe',
        ingr: ingredientLines,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Edamam API error – could not calculate macros');
  }

  const data = await response.json();
  const total = data.totalNutrients;

  return {
    calories: Math.round((total.ENERC_KCAL?.quantity || 0) / servings),
    protein: Math.round((total.PROCNT?.quantity || 0) / servings),
    carbs: Math.round((total.CHOCDF?.quantity || 0) / servings),
    fat: Math.round((total.FAT?.quantity || 0) / servings),
  };
}
