
import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import NotificationPermissionBanner from './NotificationPermissionBanner';

const VAPID_PUBLIC_KEY = 'BH0SUDCMUyultes5PbKRTcCnyjDnDUgfUtvkIWBBdVl1pPfmvecGekEjeNKvUhvk2hMGTkROBHrLpf3PWqmuDeQ';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const NotificationsProvider: React.FC = () => {
    const { session } = useAuth();
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    }, []);

    const subscribeUserToPush = async () => {
        try {
            console.log("Tentative d'abonnement Push...");
            const serviceWorker = await navigator.serviceWorker.ready;
            
            let subscription = await serviceWorker.pushManager.getSubscription();

            if (!subscription) {
                console.log("Création d'un nouvel abonnement...");
                subscription = await serviceWorker.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
            }
            
            console.log("Abonnement obtenu, enregistrement dans Supabase...");
            await saveSubscription(subscription);

        } catch (error) {
            console.error('Erreur lors de l abonnement Push:', error);
        }
    };
    
    const saveSubscription = async (subscription: PushSubscription) => {
        if (!session?.user) return;
        
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({ 
                user_id: session.user.id,
                subscription: subscription.toJSON()
            }, { onConflict: 'user_id' });

        if (error) {
            console.error("ERREUR lors de la sauvegarde en base de données:", error.message);
            alert("Erreur base de données: " + error.message);
        } else {
            console.log("✅ Abonnement Push enregistré avec succès dans la table push_subscriptions");
        }
    };
    
    useEffect(() => {
        if (session && 'serviceWorker' in navigator && 'PushManager' in window) {
            if (notificationPermission === 'granted') {
                subscribeUserToPush();
            }
        }
    }, [session, notificationPermission]);

    const handleRequestPermission = async () => {
        if (!('Notification' in window)) {
            alert("Ce navigateur ne supporte pas les notifications.");
            return;
        }
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
            await subscribeUserToPush();
        } else {
            alert("Vous avez refusé les notifications. Vous devez les autoriser dans les paramètres du site.");
        }
    };

    if (notificationPermission !== 'default') return null;

    return (
        <NotificationPermissionBanner onRequestPermission={handleRequestPermission} />
    );
};

export default NotificationsProvider;
