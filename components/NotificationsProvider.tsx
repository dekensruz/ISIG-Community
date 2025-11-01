import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import NotificationPermissionBanner from './NotificationPermissionBanner';

// ATTENTION: Remplacez cette clé par votre propre clé publique VAPID.
// Vous pouvez générer des clés via des outils en ligne ou la bibliothèque 'web-push'.
// Stockez-la de manière sécurisée, par exemple dans vos variables d'environnement.
const VAPID_PUBLIC_KEY = 'BCx1XVKpiYEDX_pOptcyi7ikv0hVQo9iVNsww-GxbKyife7Vdln3gTOz2p0eN06twP5MBiZLVEsDMxeLSb4YOuc';


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

const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session } = useAuth();
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
      // It's safe to access browser globals like `Notification` inside useEffect.
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    }, []);


    const subscribeUserToPush = async () => {
        try {
            const serviceWorker = await navigator.serviceWorker.ready;
            const existingSubscription = await serviceWorker.pushManager.getSubscription();

            if (existingSubscription) {
                console.log('User is already subscribed.');
                await saveSubscription(existingSubscription);
                return;
            }

            const subscription = await serviceWorker.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            
            console.log('User subscribed successfully.');
            await saveSubscription(subscription);

        } catch (error) {
            console.error('Failed to subscribe the user: ', error);
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
            console.error('Error saving subscription:', error);
        } else {
            console.log('Subscription saved successfully.');
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
            console.log('Notification permission granted.');
            await subscribeUserToPush();
        } else {
            console.log('Notification permission denied.');
        }
    };

    return (
        <>
            {session && notificationPermission === 'default' && (
                <NotificationPermissionBanner onRequestPermission={handleRequestPermission} />
            )}
            {children}
        </>
    );
};

export default NotificationsProvider;