import { GoogleGenAI, Type } from "@google/genai";
import { PersonaType, Stats } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const DETERMINISTIC_EMERGENCIES = [
  { title: "Flash Flood", description: "Heavy rain causes flash floods in your area. You had to pay for minor house repairs and special car cleaning.", impact: { wealth: -250, stress: 20, energy: -10 } },
  { title: "OPR Increase", description: "Banks announced a surprise OPR hike. Your monthly loan commitments have increased slightly.", impact: { wealth: -150, stress: 15 } },
  { title: "Family Kenduri", description: "A relative invites you to a big kenduri. You spent RM150 on the gift and travel.", impact: { wealth: -150, social: 25, hunger: 50, stress: 5 } },
  { title: "Parking Summon", description: "You accidentally parked in a 'Zon Tunda' area. The DBKL fine cost you RM100.", impact: { wealth: -100, stress: 10 } },
  { title: "Medical Emergency", description: "You had a sudden mild food poisoning after eating at a random stall. Clinic visit and meds required.", impact: { health: -20, wealth: -80, energy: -15, stress: 10 } },
  { title: "Car Battery Flat", description: "Your car won't start in the morning. Replaced the battery for RM280.", impact: { wealth: -280, stress: 15, energy: -10 } },
  { title: "Kitchen Appliance Break", description: "Your rice cooker stopped working. Bought a cheap replacement for RM120.", impact: { wealth: -120, stress: 8, hunger: -10 } },
  { title: "Lazada/Shopee Sale", description: "You couldn't resist the 5.5 sale. You spent more than you should have on 'essentials'.", impact: { wealth: -200, stress: -15 } },
  { title: "Water Disruption", description: "Air Selangor announced water cuts for 2 days. You spent extra on mineral water and eating out.", impact: { wealth: -100, stress: 12, hunger: -5 } },
  { title: "Unexpected Dividend", description: "ASB/Bonus dividends arrived! A small boost to your savings.", impact: { wealth: 300, stress: -10 } }
];

export async function generateEmergency(persona: PersonaType, stats: Stats) {
  // Option 1 & 2: 20% chance for AI, 80% for Deterministic templates
  const useAI = Math.random() < 0.2;

  if (!useAI) {
    const randomIndex = Math.floor(Math.random() * DETERMINISTIC_EMERGENCIES.length);
    return DETERMINISTIC_EMERGENCIES[randomIndex];
  }

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
      model: "gemini-flash-lite-latest",
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
  // Save quota: If very few events happened, use a deterministic summary
  if (weeklyLogs.length < 3) {
    return `Week ${week} was relatively quiet. You focused on your routine without major disruptions. Keep managing your energy and wealth wisely.`;
  }

  // 50% chance for AI, 50% for Deterministic to further save quota
  if (Math.random() < 0.5) {
    return `Weekly Resilience Report (Summary): You faced ${weeklyLogs.length} events this week. Your current wealth is RM${stats.wealth.toFixed(2)} and stress levels are at ${stats.stress.toFixed(0)}%. You are doing an okay job keeping things balanced. Keep pushing!`;
  }

  const prompt = `Provide a 'Weekly Resilience Report' for a ${persona} in 'Hidup Malaysia' after completing Week ${week}.
  Current Stats: Energy: ${stats.energy}, Health: ${stats.health}, Wealth: RM${stats.wealth}, Stress: ${stats.stress}, Hunger: ${stats.hunger}.
  Weekly Events: ${weeklyLogs.join(", ")}.
  Analyze their performance this week. Be insightful, localized (Malaysian context), and suggest improvements.
  Keep it under 100 words.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "You've survived another week. Keep a close eye on your stress and wealth. Resilience is key!";
  }
}

export async function generatePostMortem(persona: PersonaType, stats: Stats, daysSurvived: number, logs: string[]) {
  const isGraduation = daysSurvived >= 28 && persona === 'Uni Student';
  const prompt = `Provide a 'Resilience Post-Mortem' for a ${persona} who ${isGraduation ? 'graduated after' : 'survived'} ${daysSurvived} days in a game,'Cukup Cukup : Socio-Economic Survival'.
  Final Stats: Energy: ${stats.energy}, Health: ${stats.health}, Wealth: RM${stats.wealth}, Stress: ${stats.stress}, Hunger: ${stats.hunger}${stats.academics !== undefined ? `, Academics: ${stats.academics}/100` : ''}.
  ${isGraduation ? 'This is a graduation ceremony!' : ''}
  Key Events Summary: ${logs.slice(-10).join(", ")}.
  Analyze their journey, spending, and stress management in a supportive but realistic tone. Use Malaysian context.
  Keep it under 150 words.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "You've survived the challenges of life in Malaysia. Your resilience is noted, though the road ahead remains demanding. Keep pushing forward!";
  }
}
