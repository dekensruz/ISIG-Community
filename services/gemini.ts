import { GoogleGenAI } from "@google/genai";
import { Profile } from '../types';

// Fix: Initialize GoogleGenAI directly with the environment variable as per guidelines.
// The API key is assumed to be pre-configured and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const summarizeText = async (text: string): Promise<string> => {
  // Fix: Removed check for API_KEY as it's assumed to be present.
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Summarize the following text for a university student. Keep it concise and highlight the key points:\n\n---\n\n${text}`,
    });
    return response.text;
  } catch (error) {
    console.error("Error summarizing text:", error);
    return "Could not generate summary.";
  }
};

export const suggestPartners = async (currentUser: Profile, allUsers: Profile[]): Promise<string> => {
    // Fix: Removed check for API_KEY as it's assumed to be present.
    const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
    const userProfilesPrompt = otherUsers.map(user => 
        `User: ${user.full_name}, Major: ${user.major || 'N/A'}, Skills: ${(user.skills || []).join(', ') || 'N/A'}, Points forts académiques: ${(user.courses || []).join(', ') || 'N/A'}`
    ).join('\n');

    const prompt = `
        You are an AI assistant for the ISIG Community academic network. Your task is to suggest project partners for a student based on their profile.
        
        Current User Profile:
        Name: ${currentUser.full_name}
        Major: ${currentUser.major || 'N/A'}
        Skills: ${(currentUser.skills || []).join(', ') || 'N/A'}
        Points forts académiques: ${(currentUser.courses || []).join(', ') || 'N/A'}

        List of other students in the network:
        ${userProfilesPrompt}

        Based on the current user's profile, please suggest 2-3 students from the list who would be a good project partners. 
        For each suggestion, briefly explain why they would be a good match (e.g., complementary skills, same major, similar strong subjects).
        Format your response in a clear, readable way. Do not include the current user in the suggestions.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error suggesting partners:", error);
        return "Could not generate partner suggestions.";
    }
};
