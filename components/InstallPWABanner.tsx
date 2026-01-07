
import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Share, PlusSquare } from 'lucide-react';

interface InstallPWABannerProps {
    onComplete: () => void;
}

const InstallPWABanner: React.FC<InstallPWABannerProps> = ({ onComplete }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other');

    useEffect(() => {
        // Détecter la plateforme
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIos = /iphone|ipad|ipod/.test(userAgent);
        const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;

        if (isStandalone) {
            onComplete();
            return;
        }

        if (isIos) {
            setPlatform('ios');
        } else {
            setPlatform('android');
        }

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Sur iOS, on l'affiche après un court délai
        if (isIos && !isStandalone) {
            const timer = setTimeout(() => setIsVisible(true), 2000);
            return () => clearTimeout(timer);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, [onComplete]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsVisible(false);
            onComplete();
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        onComplete();
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[100] animate-fade-in-up">
            <div className="glass bg-white/90 rounded-[2.5rem] shadow-premium border border-slate-100 overflow-hidden">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-isig-blue/10 p-3 rounded-2xl text-isig-blue">
                            <Smartphone size={24} />
                        </div>
                        <button onClick={handleClose} className="p-2 text-slate-300 hover:text-slate-500 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <h3 className="text-lg font-black text-slate-800 tracking-tight leading-tight">
                        Installer l'app ISIG Community
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed">
                        Accédez plus rapidement à vos cours, messages et groupes depuis votre écran d'accueil.
                    </p>

                    {platform === 'ios' ? (
                        <div className="mt-6 bg-slate-50 p-4 rounded-3xl space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comment installer :</p>
                            <div className="flex items-center space-x-3 text-xs font-bold text-slate-700">
                                <div className="bg-white p-2 rounded-lg shadow-sm"><Share size={14} className="text-isig-blue"/></div>
                                <span>1. Cliquez sur "Partager" en bas de Safari</span>
                            </div>
                            <div className="flex items-center space-x-3 text-xs font-bold text-slate-700">
                                <div className="bg-white p-2 rounded-lg shadow-sm"><PlusSquare size={14} className="text-isig-blue"/></div>
                                <span>2. Sélectionnez "Sur l'écran d'accueil"</span>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleInstallClick}
                            className="mt-6 w-full py-4 bg-isig-blue text-white font-black rounded-2xl shadow-lg shadow-isig-blue/20 flex items-center justify-center space-x-2 hover:bg-blue-600 transition-all active:scale-95 uppercase tracking-widest text-xs"
                        >
                            <Download size={18} />
                            <span>Installer maintenant</span>
                        </button>
                    )}
                    
                    <button 
                        onClick={handleClose}
                        className="mt-3 w-full py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Peut-être plus tard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPWABanner;
