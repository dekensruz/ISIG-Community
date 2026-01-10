
import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import NotificationPermissionBanner from './NotificationPermissionBanner';

// REMPLACEZ CETTE VALEUR par la "Public Key" générée par la commande npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = 'BOoFpHfa1Er-uzRd4yHysdloZes9PCkXbalOQwTN9cYyQ5eggzCTzYWt4LZmUDRsD3oPodbazHry6iKIcgRMRQQ';

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
            console.log("Tentative d'abonnement Push avec la nouvelle clé...");
            const serviceWorker = await navigator.serviceWorker.ready;
            
            // On force la récupération d'un nouvel abonnement si les clés ont changé
            let subscription = await serviceWorker.pushManager.getSubscription();

            if (subscription) {
                // On vérifie si l'abonnement actuel correspond à la clé (si possible)
                // Sinon, on le désabonne pour recréer proprement
                await subscription.unsubscribe();
            }

            console.log("Création d'un nouvel abonnement propre...");
            subscription = await serviceWorker.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            
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
        } else {
            console.log("✅ Nouvel abonnement Push enregistré avec succès.");
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
        }
    };

    if (notificationPermission !== 'default') return null;

    return (
        <NotificationPermissionBanner onRequestPermission={handleRequestPermission} />
    );
};

export default NotificationsProvider;
