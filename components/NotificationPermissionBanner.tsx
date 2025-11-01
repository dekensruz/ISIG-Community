import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';

interface NotificationPermissionBannerProps {
    onRequestPermission: () => void;
}

const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({ onRequestPermission }) => {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg max-w-sm z-50 border border-slate-200 animate-fade-in-up">
            <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                    <Bell className="h-6 w-6 text-isig-blue" />
                </div>
                <div className="ml-3 w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">Activer les notifications</p>
                    <p className="mt-1 text-sm text-gray-500">
                        Recevez des alertes pour les likes et commentaires, même lorsque vous êtes absent.
                    </p>
                    <div className="mt-4 flex">
                        <button
                            onClick={() => {
                                onRequestPermission();
                                setIsVisible(false);
                            }}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-isig-blue hover:bg-blue-600 focus:outline-none"
                        >
                            Activer
                        </button>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="ml-3 inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        >
                            Plus tard
                        </button>
                    </div>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                    <button onClick={() => setIsVisible(false)} className="inline-flex text-gray-400 hover:text-gray-500">
                        <span className="sr-only">Close</span>
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationPermissionBanner;
