
import { GoogleGenAI } from "@google/genai";
import { Profile } from '../types';

// Utilisation d'une fonction pour initialiser l'IA au besoin, évitant les crashs au chargement du module
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const summarizeText = async (text: string): Promise<string> => {
  try {
    const ai = getAI();
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

export const suggestPartners = async (currentUser: Profile, allUsers: Profile[]): Promise<string> => {
    const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
    const userProfilesPrompt = otherUsers.map(user => 
        `Utilisateur: ${user.full_name}, Filière: ${user.major || 'N/A'}, Compétences: ${(user.skills || []).join(', ') || 'N/A'}`
    ).join('\n');

    const prompt = `
        Tu es un assistant IA pour le réseau ISIG Community. Suggère 2-3 partenaires de projet pour cet étudiant.
        
        Profil de l'utilisateur actuel :
        Nom : ${currentUser.full_name}
        Filière : ${currentUser.major || 'N/A'}
        Compétences : ${(currentUser.skills || []).join(', ') || 'N/A'}

        Liste des autres étudiants :
        ${userProfilesPrompt}

        Explique brièvement pourquoi chaque personne est un bon match (compétences complémentaires, même filière, etc.). 
        Formatte ta réponse en HTML simple (utilisant <p>, <strong>, <br/>).
    `;
    
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
        });
        return response.text || "Suggestions indisponibles.";
    } catch (error) {
        console.error("Error suggesting partners:", error);
        return "Impossible de générer des suggestions pour le moment.";
    }
};
