const axios = require('axios');

const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';

async function getAIResponse(message, userContext) {
  const openAIKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const hasOpenAIKey = openAIKey && !openAIKey.includes('your_openai_api_key');
  const hasGeminiKey = geminiKey && !geminiKey.includes('your_gemini_api_key');

  if (AI_PROVIDER === 'openai' && hasOpenAIKey) {
    return getOpenAIResponse(message, userContext);
  }
  if (hasGeminiKey) {
    return getGeminiResponse(message, userContext);
  }
  return getFallbackResponse(message, userContext);
}

async function getGeminiResponse(message, userContext) {
  const prompt = buildPrompt(message, userContext);
  try {
    const { data } = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      },
      { timeout: 30000 }
    );
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || getFallbackResponse(message, userContext);
  } catch (error) {
    console.error('Gemini API error:', error.message);
    return getFallbackResponse(message, userContext);
  }
}

async function getOpenAIResponse(message, userContext) {
  const prompt = buildPrompt(message, userContext);
  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are EcoGuardian AI, a sustainability assistant focused on SDG 13 Climate Action.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 30000,
      }
    );
    return data.choices?.[0]?.message?.content || getFallbackResponse(message, userContext);
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    return getFallbackResponse(message, userContext);
  }
}

function buildPrompt(message, ctx) {
  return `You are EcoGuardian AI, a personal carbon footprint sustainability assistant for SDG 13 (Climate Action).

User Profile:
- Name: ${ctx.name || 'User'}
- Daily CO2 Goal: ${ctx.goal || 15} kg
- Eco Score: ${ctx.ecoScore || 50}/100
- Green Points: ${ctx.greenPoints || 0}
- Current Streak: ${ctx.streak || 0} days

Recent Carbon Data:
- Latest Daily Emissions: ${ctx.latestEmissions || 'N/A'} kg CO2
- Weekly Average: ${ctx.weeklyAvg || 'N/A'} kg CO2
- Top Emission Source: ${ctx.topSource || 'N/A'}
- Emission Breakdown: ${JSON.stringify(ctx.breakdown || {})}

User Question: ${message}

Provide a helpful, personalized, actionable response focused on reducing carbon emissions. Include specific numbers when possible. Keep response concise but informative (2-4 paragraphs).`;
}

function getFallbackResponse(message, ctx) {
  const lower = message.toLowerCase();
  const emissions = ctx.latestEmissions || 20;
  const topSource = ctx.topSource || 'transport';

  if (lower.includes('reduce') || lower.includes('lower')) {
    return `Based on your current emissions of ${emissions} kg CO2/day, here are personalized recommendations:

1. **Transport (${topSource === 'transport' ? 'Your biggest source!' : 'Important'})**: Switch to public transit or cycling for short trips. Each km by car emits ~0.21 kg CO2 vs 0 for biking.

2. **Energy**: Reduce electricity by 20% — turn off unused devices, use LED bulbs, and optimize AC usage. This could save ~${(emissions * 0.15).toFixed(1)} kg CO2/day.

3. **Food**: Consider plant-based meals 3-4 days/week. Switching from non-vegetarian to vegetarian saves ~4.7 kg CO2/day.

Your eco score of ${ctx.ecoScore || 50}/100 can improve significantly with these changes!`;
  }

  if (lower.includes('travel') || lower.includes('transport')) {
    return `Eco-friendly travel suggestions for you:

🚇 **Metro/Bus**: Best for daily commute — emits only 0.04-0.09 kg CO2/km
🚲 **Bicycle**: Zero emissions, great for trips under 5km
⚡ **Electric Vehicle**: ~0.05 kg CO2/km (75% less than petrol cars)
✈️ **Flights**: Avoid when possible — 0.255 kg CO2/km. Consider train for regional travel.

Try the Digital Twin Simulator to see exactly how switching transport modes affects your footprint!`;
  }

  if (lower.includes('weekly') || lower.includes('plan')) {
    return `Your Personalized Weekly Sustainability Plan:

**Monday-Tuesday**: Meat-free days + bike/walk for commutes
**Wednesday-Thursday**: Reduce electricity 20% — unplug devices, natural lighting
**Friday**: Low-shopping day — avoid unnecessary purchases
**Weekend**: Review your carbon dashboard, complete a weekly challenge

**Target**: Reduce daily emissions from ${emissions} kg to ${(emissions * 0.8).toFixed(1)} kg CO2
**Potential savings**: ${(emissions * 0.2 * 7).toFixed(1)} kg CO2 this week!

Complete challenges to earn green points and badges! 🌱`;
  }

  if (lower.includes('report') || lower.includes('explain')) {
    const breakdown = ctx.breakdown || {};
    return `Your Carbon Report Explanation:

📊 **Total Daily Emissions**: ${emissions} kg CO2
${Object.entries(breakdown).map(([k, v]) => `• **${k.charAt(0).toUpperCase() + k.slice(1)}**: ${v} kg (${emissions > 0 ? ((v / emissions) * 100).toFixed(1) : 0}%)`).join('\n')}

${topSource === 'transport' ? '🚗 Transport is your largest emission source. Consider public transit or cycling.' : ''}
${topSource === 'electricity' ? '⚡ Electricity usage is significant. Try energy-efficient appliances and solar panels.' : ''}
${topSource === 'food' ? '🍽️ Food choices impact your footprint. Plant-based diets reduce emissions by ~60%.' : ''}

Your eco score: ${ctx.ecoScore || 50}/100. Keep logging daily to improve predictions!`;
  }

  return `Hello ${ctx.name || 'there'}! I'm EcoGuardian AI, your sustainability assistant for SDG 13 Climate Action.

Your current stats:
• Daily emissions: ${emissions} kg CO2
• Eco Score: ${ctx.ecoScore || 50}/100
• Green Points: ${ctx.greenPoints || 0}

I can help you with:
• Reducing your carbon emissions
• Eco-friendly travel suggestions
• Weekly sustainability plans
• Explaining your carbon reports

What would you like to know? Try asking "How can I reduce my emissions?" or use the Digital Twin Simulator to test lifestyle changes!`;
}

module.exports = { getAIResponse };
