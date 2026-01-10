
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
                }
            }
            setLoading(false);
        };

        checkProfile();
    }, [session]);

    if (!isVisible || loading) return null;

    const handleAction = () => {
        setIsVisible(false); // Disparaît immédiatement
        // On ajoute ?edit=true pour que le composant Profile sache qu'il doit s'ouvrir en mode édition
        navigate(`/profile/${session?.user.id}?edit=true`);
    };

    return (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-lg z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-premium max-w-md w-full p-8 text-center animate-fade-in-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-isig-blue to-isig-orange"></div>
                
                <div className="w-20 h-20 bg-isig-orange/10 text-isig-orange rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={40} />
                </div>

                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-tight uppercase italic">Profil incomplet</h2>
                <p className="mt-4 text-slate-500 font-medium leading-relaxed">
                    Cher étudiant, ISIG Community évolue ! Pour une meilleure expérience, veuillez spécifier votre <span className="text-isig-blue font-bold">Genre</span> et votre <span className="text-isig-blue font-bold">Promotion</span>.
                </p>

                <div className="mt-8 space-y-3">
                    <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                        <UserRound className="text-isig-blue shrink-0" size={24} />
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Champ requis</p>
                            <p className="text-sm font-bold text-slate-700">Genre (M/F)</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                        <GraduationCap className="text-isig-blue shrink-0" size={24} />
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Champ requis</p>
                            <p className="text-sm font-bold text-slate-700">Promotion académique</p>
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
