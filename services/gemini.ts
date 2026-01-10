import { GoogleGenAI, Type } from "@google/genai";
import { Profile } from '../types';

// Recommended models for different task types based on guidelines
const TEXT_MODEL = 'gemini-3-flash-preview';
const REASONING_MODEL = 'gemini-3-pro-preview';

export const summarizeText = async (text: string): Promise<string> => {
  try {
    // API key must be obtained exclusively from process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: `Tu es un assistant académique pour les étudiants de l'ISIG Goma. Résume le texte suivant de manière structurée avec des puces. Sois concis et professionnel :\n\n---\n\n${text}`,
    });
    // Access response.text property directly (not a method)
    return response.text || "Résumé indisponible.";
  } catch (error) {
    console.error("Error summarizing text:", error);
    return "Impossible de générer un résumé pour le moment. Vérifiez la configuration de l'API.";
  }
};

export const improveAcademicPost = async (text: string): Promise<string> => {
  try {
    // API key must be obtained exclusively from process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: `Reformule ce brouillon de publication pour un réseau social académique (ISIG Community). Rends-le plus clair, professionnel et engageant pour des étudiants, tout en gardant le même sens. Propose aussi 3 hashtags pertinents à la fin :\n\n"${text}"`,
    });
    // Access response.text property directly
    return response.text || text;
  } catch (error) {
    console.error("Error improving post:", error);
    return text;
  }
};

export interface SuggestionResult {
    userId: string;
    reason: string;
}

export const suggestPartners = async (query: string, currentUser: Profile, allUsers: Profile[]): Promise<SuggestionResult[]> => {
    try {
        // API key must be obtained exclusively from process.env.API_KEY
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
        const userProfilesPrompt = otherUsers.map(user => 
            `ID: ${user.id}, Nom: ${user.full_name}, Compétences: ${(user.skills || []).join(', ')}, Bio: ${user.bio || 'N/A'}`
        ).join('\n');

        const prompt = `
            Tu es l'expert en mise en relation d'ISIG Community.
            
            REQUÊTE DE L'ÉTUDIANT : "${query}"
            
            LISTE DES ÉTUDIANTS :
            ${userProfilesPrompt}

            INSTRUCTIONS :
            1. Analyse les besoins de la requête.
            2. Sélectionne les 3 meilleurs profils basés sur les compétences.
            3. Explique pourquoi chaque profil est pertinent.
            
            Réponds UNIQUEMENT en JSON (tableau d'objets avec "userId" et "reason").
        `;
        
        const response = await ai.models.generateContent({
            model: REASONING_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            userId: {
                                type: Type.STRING,
                                description: 'The ID of the suggested user.',
                            },
                            reason: {
                                type: Type.STRING,
                                description: 'Why this user is a good match for the query.',
                            }
                        },
                        required: ["userId", "reason"],
                        propertyOrdering: ["userId", "reason"],
                    }
                }
            }
        });

        // Access response.text property directly
        let cleanText = (response.text || "[]").trim();
        // Remove markdown formatting if present
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        return JSON.parse(cleanText) as SuggestionResult[];
    } catch (error) {
        console.error("Error suggesting partners:", error);
        return [];
    }
};