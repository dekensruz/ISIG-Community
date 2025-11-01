import React, { useState, useEffect, useCallback } from 'react';
import { suggestPartners } from '../services/gemini';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import Spinner from './Spinner';

interface SuggestionModalProps {
  currentUser: Profile;
  onClose: () => void;
}

const SuggestionModal: React.FC<SuggestionModalProps> = ({ currentUser, onClose }) => {
  const [suggestions, setSuggestions] = useState('');
  const [loading, setLoading] = useState(true);

  const getSuggestions = useCallback(async () => {
    setLoading(true);
    try {
        const { data: allUsers, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        
        if (allUsers) {
            const result = await suggestPartners(currentUser, allUsers);
            setSuggestions(result);
        }
    } catch (error) {
        setSuggestions("Impossible de récupérer les suggestions pour le moment.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    getSuggestions();
  }, [getSuggestions]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-isig-blue">Suggestions de partenaires (IA)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
        </div>
        <div className="max-h-96 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center items-center h-60">
              <Spinner />
            </div>
          ) : (
            <div className="prose max-w-none text-gray-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: suggestions.replace(/\n/g, '<br />') }} />
          )}
        </div>
        <div className="text-right mt-4">
           <button 
             onClick={onClose} 
             className="bg-isig-orange text-white px-4 py-2 rounded-lg hover:bg-orange-600"
            >
             Fermer
           </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestionModal;