
import React, { useState, useRef, useEffect } from 'react';
import { suggestPartners, SuggestionResult } from '../services/gemini';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { Link } from 'react-router-dom';
import { Search, Sparkles, X, ArrowRight, Lightbulb, Send, AlertCircle } from 'lucide-react';

interface SuggestionModalProps {
  currentUser: Profile;
  onClose: () => void;
}

interface EnrichedSuggestion extends SuggestionResult {
    profile: Profile;
}

const SuggestionModal: React.FC<SuggestionModalProps> = ({ currentUser, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [query]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
        const { data: allUsers, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        
        if (allUsers) {
            const results = await suggestPartners(query, currentUser, allUsers);
            const enriched: EnrichedSuggestion[] = results.map(res => {
                const profile = allUsers.find(u => u.id === res.userId);
                return profile ? { ...res, profile } : null;
            }).filter(Boolean) as EnrichedSuggestion[];

            setSuggestions(enriched);
        }
    } catch (error) {
        console.error(error);
        setSuggestions([]);
    } finally {
        setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSearch();
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[60] flex justify-center items-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-isig-blue/10 rounded-2xl flex items-center justify-center text-isig-blue">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Assistant ISIG</h2>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium italic">Trouvez vos partenaires grâce à l'IA</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="relative mb-8 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner group focus-within:ring-2 focus-within:ring-isig-blue transition-all">
                <div className="flex items-start p-4">
                    <Search className="mt-2 text-slate-400 mr-3 shrink-0" size={20} />
                    <textarea 
                        ref={textareaRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ex: Je cherche quelqu'un qui s'y connait en Python..."
                        className="w-full bg-transparent border-none focus:ring-0 outline-none font-bold text-slate-700 py-1 resize-none min-h-[44px] max-h-[150px] custom-scrollbar"
                        autoFocus
                    />
                    <button 
                        onClick={() => handleSearch()}
                        disabled={loading || !query.trim()}
                        className="ml-3 shrink-0 bg-isig-blue text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-isig-blue/20 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? <Spinner /> : <Send size={20} />}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Spinner />
                        <p className="mt-4 text-slate-400 font-black uppercase text-[10px] tracking-widest animate-pulse">L'IA parcourt les compétences...</p>
                    </div>
                ) : suggestions.length > 0 ? (
                    <div className="grid gap-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Profils suggérés :</p>
                        {suggestions.map((item) => (
                            <Link 
                                to={`/profile/${item.profile.id}`} 
                                key={item.profile.id}
                                onClick={onClose}
                                className="group flex items-start p-4 sm:p-5 bg-white border border-slate-100 rounded-[2rem] hover:border-isig-blue/30 hover:shadow-premium transition-all"
                            >
                                <Avatar avatarUrl={item.profile.avatar_url} name={item.profile.full_name} size="xl" className="ring-4 ring-slate-50 group-hover:ring-isig-blue/5 shrink-0" />
                                <div className="ml-4 sm:ml-5 flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-black text-slate-800 tracking-tight group-hover:text-isig-blue transition-colors truncate">{item.profile.full_name}</h3>
                                        <span className="text-[9px] bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-black uppercase shrink-0 ml-2">{item.profile.major || 'ISIG'}</span>
                                    </div>
                                    <div className="text-sm text-slate-500 mt-2 leading-relaxed break-words">
                                        <span className="text-isig-orange font-bold italic">IA :</span> {item.reason}
                                    </div>
                                </div>
                                <ArrowRight className="ml-2 text-slate-300 group-hover:text-isig-blue group-hover:translate-x-1 transition-all shrink-0 self-center" size={18} />
                            </Link>
                        ))}
                    </div>
                ) : hasSearched ? (
                    <div className="text-center py-12 px-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 animate-fade-in">
                        <div className="w-16 h-16 bg-isig-orange/10 text-isig-orange rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={32} />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-2 italic">Oups, l'IA est un peu fatiguée !</h3>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">
                            Désolé, l'IA n'a trouvé aucune correspondance. <br/>
                            <span className="text-isig-blue font-bold">À savoir :</span> Nous utilisons des crédits gratuits qui s'épuisent parfois vite à cause du succès d'ISIG Community ! 🚀 <br/><br/>
                            Réessayez un peu plus tard ou tentez une recherche différente. N'oubliez pas que nous ne sommes qu'à nos débuts !
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                         <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Lightbulb className="opacity-40 text-isig-blue" size={32} />
                         </div>
                         <p className="font-bold text-slate-500">Besoin d'aide pour un projet ?</p>
                         <p className="text-sm max-w-xs mt-1">Dites-moi qui vous cherchez et je fouillerai les profils pour vous.</p>
                    </div>
                )}
            </div>
        </div>
        
        <div className="bg-slate-50 p-6 flex items-center justify-end border-t border-slate-100 shrink-0">
            <button onClick={onClose} className="text-sm font-black text-slate-500 hover:text-slate-800 transition-colors">Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default SuggestionModal;
