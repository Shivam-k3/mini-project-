const axios = require('axios');

const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';

// The assistant is a MOBILITY-domain expert. It must refuse questions outside
// transportation/mobility rather than improvising generic sustainability advice.
const SYSTEM_PROMPT = `You are EcoGuardian Mobility AI, an assistant specialised EXCLUSIVELY in sustainable mobility and transportation carbon management (SDG 13).

STRICT SCOPE RULES:
- Answer ONLY questions about: commuting, vehicle choices, EVs, public transit, carpooling/occupancy, cycling/walking, flights vs rail, emission factors for transport modes, and the user's own logged trips.
- If asked about ANYTHING else (food, electricity, shopping, waste, water, homework, general chat, coding, news), politely decline in one sentence and redirect to a mobility topic.
- Use the user's actual trip data when relevant. Never invent statistics; if unsure of a number, say it is approximate or refer to their dashboard.
- Be concise (2-4 short paragraphs max).`;

function isOffTopic(message) {
  const m = String(message || '').toLowerCase();
  const onTopic = [
    'transport', 'travel', 'commute', 'car', 'ev', 'electric vehicle', 'metro',
    'bus', 'train', 'flight', 'fly', 'bike', 'cycle', 'walk', 'carpool',
    'motorcycle', 'scooter', 'auto', 'trip', 'vehicle', 'fuel', 'petrol',
    'diesel', 'emission', 'carbon', 'footprint', 'mobility', 'occupancy',
  ];
  return !onTopic.some((k) => m.includes(k));
}

async function getAIResponse(message, userContext) {
  // Hard domain gate — applied before any provider call.
  if (isOffTopic(message)) {
    return getFallbackResponse(message, userContext);
  }

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
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
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
          { role: 'system', content: SYSTEM_PROMPT },
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
  return `User Profile:
- Name: ${ctx.name || 'User'}
- Eco Score: ${ctx.ecoScore || 50}/100
- Green Points: ${ctx.greenPoints || 0}
- Current Streak: ${ctx.streak || 0} days

Recent Mobility Data:
- Daily personal transport emissions: ${ctx.latestTransport ?? 'N/A'} kg CO2
- Weekly personal transport emissions: ${ctx.weeklyTransport ?? 'N/A'} kg CO2
- Mode breakdown (kg/day): ${JSON.stringify(ctx.modeBreakdown || {})}

User Question: ${message}

Answer strictly within the mobility/transportation scope described in your instructions.`;
}

function getFallbackResponse(message, ctx) {
  const lower = String(message || '').toLowerCase();

  // Off-topic refusal
  if (isOffTopic(message)) {
    return `I'm EcoGuardian Mobility AI — I can only help with transportation and commuting questions, like choosing between metro, bus, cycling, EVs or carpooling. Try asking "How can I make my commute greener?"`;
  }

  const modes = ctx.modeBreakdown || {};
  const topMode = Object.entries(modes).sort((a, b) => b[1] - a[1])[0]?.[0];
  const daily = ctx.latestTransport;

  if (lower.includes('reduce') || lower.includes('lower') || lower.includes('greener')) {
    return `Based on your logged trips${daily != null ? ` (${daily} kg CO₂/day personal transport)` : ''}, here are personalised mobility suggestions:

🚇 **Public transit**: Metro emits ~0.041 kg/passenger-km vs ~0.21 kg/km for a solo petrol car.
👥 **Carpooling**: Sharing your car with 3 others cuts each person's share by ~75%.
🚲 **Active travel**: Walking and cycling are zero-emission for short trips.
⚡ **EV switch**: An EV at India's grid intensity (~0.107 kg/km at 0.15 kWh/km) beats most petrol vehicles.

Try the Digital Twin Simulator to test these against YOUR distances!`;
  }

  if (topMode) {
    return `Your dominant mode right now is **${topMode.replace('_', ' ')}** (${modes[topMode]} kg/day).

Depending on the mode, shifting some km to metro/bus or increasing occupancy usually gives the biggest cut. Open your Mobility Twin to see replacement options computed from your own weekly distances.`;
  }

  return `Hello ${ctx.name || 'there'}! I'm EcoGuardian Mobility AI.

I can help you with:
• Greener commute choices (metro, bus, cycle, walk)
• Carpooling and occupancy effects
• EV vs petrol comparisons
• Understanding your trip emissions

Log a few trips first so I can give personalised advice!`;
}

module.exports = { getAIResponse };
