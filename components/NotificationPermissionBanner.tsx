
import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';

interface NotificationPermissionBannerProps {
    onRequestPermission: () => void;
}

const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({ onRequestPermission }) => {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 bg-white p-5 rounded-[2rem] shadow-premium z-[100] border border-slate-100 animate-fade-in-up md:max-w-sm">
            <div className="flex items-start">
                <div className="flex-shrink-0 bg-isig-blue/10 p-3 rounded-2xl text-isig-blue">
                    <Bell className="h-6 w-6" />
                </div>
                <div className="ml-4 w-0 flex-1">
                    <p className="text-base font-black text-slate-800 tracking-tight">Activer les notifications</p>
                    <p className="mt-1 text-sm text-slate-500 font-medium leading-relaxed">
                        Ne manquez aucun like, commentaire ou message important.
                    </p>
                    <div className="mt-5 flex items-center space-x-3">
                        <button
                            onClick={() => {
                                onRequestPermission();
                                setIsVisible(false);
                            }}
                            className="inline-flex items-center px-6 py-2.5 text-sm font-black rounded-xl shadow-lg shadow-isig-blue/20 text-white bg-isig-blue hover:bg-blue-600 focus:outline-none transition-all active:scale-95"
                        >
                            Activer
                        </button>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="inline-flex items-center px-4 py-2.5 text-sm font-bold rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 focus:outline-none transition-all"
                        >
                            Plus tard
                        </button>
                    </div>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                    <button onClick={() => setIsVisible(false)} className="text-slate-300 hover:text-slate-500 p-1">
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationPermissionBanner;
