
import { GoogleGenAI, Type } from "@google/genai";
import { Profile } from '../types';

export const summarizeText = async (text: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Tu es un assistant académique pour les étudiants de l'ISIG Goma. Résume le texte suivant de manière structurée avec des puces. Sois concis et professionnel :\n\n---\n\n${text}`,
    });
    return response.text || "Résumé indisponible.";
  } catch (error) {
    console.error("Error summarizing text:", error);
    return "Impossible de générer un résumé pour le moment.";
  }
};

export const improveAcademicPost = async (text: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Reformule ce brouillon de publication pour un réseau social académique (ISIG Community). Rends-le plus clair, professionnel et engageant pour des étudiants, tout en gardant le même sens. Propose aussi 3 hashtags pertinents à la fin :\n\n"${text}"`,
    });
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
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            userId: { type: Type.STRING },
                            reason: { type: Type.STRING }
                        },
                        required: ["userId", "reason"]
                    }
                }
            }
        });

        const text = response.text || "[]";
        return JSON.parse(text) as SuggestionResult[];
    } catch (error) {
        console.error("Error suggesting partners:", error);
        return [];
    }
};
