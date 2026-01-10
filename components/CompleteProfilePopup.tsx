
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { UserRound, GraduationCap, ArrowRight, AlertTriangle } from 'lucide-react';
import Spinner from './Spinner';

const CompleteProfilePopup: React.FC = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session?.user) {
            setLoading(false);
            return;
        }

        const checkProfile = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('gender, promotion')
                .eq('id', session.user.id)
                .single();
            
            if (!error && data) {
                // Si l'un des deux champs est manquant, on affiche le popup
                if (!data.gender || !data.promotion) {
                    setIsVisible(true);
                    // Stocker le fait qu'on a affiché le popup de profil
                    localStorage.setItem('profile_popup_triggered', 'true');
                }
            }
            setLoading(false);
        };

        checkProfile();
    }, [session]);

    if (!isVisible || loading) return null;

    const handleAction = () => {
        setIsVisible(false);
        // Marquer comme fermé avec timestamp pour le délai du mode sombre
        localStorage.setItem('profile_popup_closed_at', Date.now().toString());
        navigate(`/profile/${session?.user.id}?edit=true`);
    };

    return (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-lg z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-premium max-w-md w-full p-8 text-center animate-fade-in-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-isig-blue to-isig-orange"></div>
                
                <div className="w-20 h-20 bg-isig-orange/10 text-isig-orange rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={40} />
                </div>

                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight uppercase italic">Profil incomplet</h2>
                <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Cher étudiant, ISIG Community évolue ! Pour une meilleure expérience, veuillez spécifier votre <span className="text-isig-blue font-bold">Genre</span> et votre <span className="text-isig-blue font-bold">Promotion</span>.
                </p>

                <div className="mt-8 space-y-3">
                    <div className="flex items-center space-x-4 p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-800 text-left">
                        <UserRound className="text-isig-blue shrink-0" size={24} />
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">Champ requis</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Genre (M/F)</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-800 text-left">
                        <GraduationCap className="text-isig-blue shrink-0" size={24} />
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">Champ requis</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Promotion académique</p>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleAction}
                    className="mt-10 w-full py-5 bg-isig-blue text-white font-black rounded-2xl shadow-xl shadow-isig-blue/20 flex items-center justify-center space-x-2 transition-all active:scale-95 uppercase tracking-widest text-xs group px-6"
                >
                    <span className="whitespace-nowrap">Mettre à jour mon profil</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
            </div>
        </div>
    );
};

export default CompleteProfilePopup;
