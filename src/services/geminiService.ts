import { GoogleGenAI, Type } from "@google/genai";
import { PersonaType, Stats } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateEmergency(persona: PersonaType, stats: Stats) {
  const prompt = `Generate a localized Malaysian life emergency for a ${persona} in a life simulator.
  Current Stats: Energy: ${stats.energy}, Health: ${stats.health}, Wealth: RM${stats.wealth}, Stress: ${stats.stress}, Hunger: ${stats.hunger}.
  The emergency should be realistic and localized (e.g., floods, OPR hikes, family emergencies, medical issues).
  Return a JSON object with:
  - title: A short catchy title.
  - description: A brief description of what happened.
  - impact: An object with keys 'energy', 'health', 'wealth', 'stress', 'hunger' and their numerical impact (negative for loss, positive for gain).
  Example: { "title": "Flash Flood", "description": "Your area is flooded. You spent RM200 on cleaning.", "impact": { "wealth": -200, "stress": 10, "hunger": -5 } }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            impact: {
              type: Type.OBJECT,
              properties: {
                energy: { type: Type.NUMBER },
                health: { type: Type.NUMBER },
                wealth: { type: Type.NUMBER },
                stress: { type: Type.NUMBER },
                hunger: { type: Type.NUMBER }
              }
            }
          },
          required: ["title", "description", "impact"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      title: "Unexpected Bill",
      description: "A sudden administrative fee has been charged.",
      impact: { wealth: -100, stress: 5 }
    };
  }
}

export async function generateWeeklyPostMortem(persona: PersonaType, stats: Stats, week: number, weeklyLogs: string[]) {
  const prompt = `Provide a 'Weekly Resilience Report' for a ${persona} in 'Hidup Malaysia' after completing Week ${week}.
  Current Stats: Energy: ${stats.energy}, Health: ${stats.health}, Wealth: RM${stats.wealth}, Stress: ${stats.stress}, Hunger: ${stats.hunger}.
  Weekly Events: ${weeklyLogs.join(", ")}.
  Analyze their performance this week. Be insightful, localized (Malaysian context), and suggest improvements.
  Keep it under 100 words.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "You've survived another week. Keep a close eye on your stress and wealth. Resilience is key!";
  }
}

export async function generatePostMortem(persona: PersonaType, stats: Stats, daysSurvived: number, logs: string[]) {
  const isGraduation = daysSurvived >= 28 && persona === 'Uni Student';
  const prompt = `Provide a 'Resilience Post-Mortem' for a ${persona} who ${isGraduation ? 'graduated after' : 'survived'} ${daysSurvived} days in 'Hidup Malaysia: The Resilience Sim'.
  Final Stats: Energy: ${stats.energy}, Health: ${stats.health}, Wealth: RM${stats.wealth}, Stress: ${stats.stress}, Hunger: ${stats.hunger}${stats.academics !== undefined ? `, Academics: ${stats.academics}/100` : ''}.
  ${isGraduation ? 'This is a graduation ceremony!' : ''}
  Key Events Summary: ${logs.slice(-10).join(", ")}.
  Analyze their journey, spending, and stress management in a supportive but realistic tone. Use Malaysian context.
  Keep it under 150 words.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "You've survived the challenges of life in Malaysia. Your resilience is noted, though the road ahead remains demanding. Keep pushing forward!";
  }
}
