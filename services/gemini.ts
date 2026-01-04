
import { GoogleGenAI, Type } from "@google/genai";
import { Profile } from '../types';

export const summarizeText = async (text: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Résume le texte suivant pour un étudiant universitaire. Sois concis et souligne les points clés :\n\n---\n\n${text}`,
    });
    return response.text || "Résumé indisponible.";
  } catch (error) {
    console.error("Error summarizing text:", error);
    return "Impossible de générer un résumé pour le moment.";
  }
};

export interface SuggestionResult {
    userId: string;
    reason: string;
}

export const suggestPartners = async (query: string, currentUser: Profile, allUsers: Profile[]): Promise<SuggestionResult[]> => {
    // On filtre pour ne pas se suggérer soi-même et s'assurer que les profils ont des infos
    const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
    
    const userProfilesPrompt = otherUsers.map(user => 
        `ID: ${user.id}, Nom: ${user.full_name}, Compétences: ${(user.skills || []).join(', ')}, Bio: ${user.bio || 'N/A'}`
    ).join('\n');

    const prompt = `
        Tu es l'expert en mise en relation d'ISIG Community.
        
        REQUÊTE DE L'ÉTUDIANT : "${query}"
        
        LISTE DES ÉTUDIANTS (Priorité aux compétences/skills) :
        ${userProfilesPrompt}

        INSTRUCTIONS :
        1. Analyse les mots-clés de la requête (ex: "Python", "Design", "Compta").
        2. Compare ces mots-clés principalement avec la liste des "Compétences" de chaque étudiant.
        3. Sois flexible : si quelqu'un cherche "Java", suggère aussi les profils "Android" ou "Backend" si pertinent.
        4. Sélectionne les 3 meilleurs profils. 
        5. Si AUCUN profil ne correspond vraiment, essaie quand même de trouver les plus proches ou ceux avec les compétences les plus larges.
        
        Réponds UNIQUEMENT sous forme d'un tableau JSON d'objets avec "userId" et "reason".
    `;
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
