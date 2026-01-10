
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { Moon, Sparkles, X, ArrowRight } from 'lucide-react';

const DarkModeDiscoveryPopup: React.FC = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!session?.user) return;

        // Ne l'afficher qu'une seule fois
        const hasShown = localStorage.getItem('dark_mode_discovery_shown');
        if (hasShown) return;

        const checkDelay = () => {
            const profilePopupTriggered = localStorage.getItem('profile_popup_triggered') === 'true';
            const profilePopupClosedAt = localStorage.getItem('profile_popup_closed_at');

            if (profilePopupTriggered) {
                // Si le popup de profil a été déclenché, on vérifie s'il a été fermé
                if (profilePopupClosedAt) {
                    const elapsed = Date.now() - parseInt(profilePopupClosedAt);
                    const twoMinutes = 2 * 60 * 1000;
                    
                    if (elapsed >= twoMinutes) {
                        setIsVisible(true);
                    } else {
                        // Réessayer dans 10 secondes jusqu'à ce que les 2 minutes soient écoulées
                        setTimeout(checkDelay, 10000);
                    }
                } else {
                    // Toujours pas fermé, on réessaye plus tard
                    setTimeout(checkDelay, 10000);
                }
            } else {
                // Pas de popup de profil, on affiche après 5 secondes d'utilisation
                setTimeout(() => setIsVisible(true), 5000);
            }
        };

        checkDelay();
    }, [session]);

    if (!isVisible) return null;

    const handleGoToSettings = () => {
        setIsVisible(false);
        localStorage.setItem('dark_mode_discovery_shown', 'true');
        navigate('/settings');
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('dark_mode_discovery_shown', 'true');
    };

    return (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-md z-[105] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 rounded-[3rem] shadow-2xl max-w-sm w-full p-8 text-center animate-fade-in-up relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 w-32 h-32 bg-isig-blue/20 blur-[50px] rounded-full -mr-16 -mt-16"></div>
                
                <button onClick={handleDismiss} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                <div className="w-20 h-20 bg-isig-blue/10 text-isig-blue rounded-[2rem] flex items-center justify-center mx-auto mb-6 relative">
                    <Moon size={40} className="fill-isig-blue/20" />
                    <Sparkles size={20} className="absolute -top-1 -right-1 text-isig-orange animate-pulse" />
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight leading-tight uppercase italic">Le Mode Sombre est là !</h2>
                <p className="mt-4 text-slate-400 font-medium leading-relaxed">
                    Découvrez une nouvelle expérience plus confortable pour vos yeux, surtout lors de vos révisions nocturnes.
                </p>

                <button 
                    onClick={handleGoToSettings}
                    className="mt-10 w-full py-5 bg-isig-blue text-white font-black rounded-2xl shadow-xl shadow-isig-blue/20 flex items-center justify-center space-x-2 transition-all active:scale-95 uppercase tracking-widest text-xs group"
                >
                    <span>L'essayer maintenant</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                
                <button 
                    onClick={handleDismiss}
                    className="mt-4 w-full py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300 transition-colors"
                >
                    Plus tard
                </button>
            </div>
        </div>
    );
};

export default DarkModeDiscoveryPopup;
