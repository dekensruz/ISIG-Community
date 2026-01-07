
import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import NotificationPermissionBanner from './NotificationPermissionBanner';

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
            const serviceWorker = await navigator.serviceWorker.ready;
            const existingSubscription = await serviceWorker.pushManager.getSubscription();

            if (existingSubscription) {
                await saveSubscription(existingSubscription);
                return;
            }

            const subscription = await serviceWorker.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            
            await saveSubscription(subscription);

        } catch (error) {
            console.error('Failed to subscribe the user: ', error);
        }
    };
    
    const saveSubscription = async (subscription: PushSubscription) => {
        if (!session?.user) return;
        await supabase
            .from('push_subscriptions')
            .upsert({ 
                user_id: session.user.id,
                subscription: subscription.toJSON()
            }, { onConflict: 'user_id' });
    };
    
    useEffect(() => {
        if (session && 'serviceWorker' in navigator && 'PushManager' in window) {
            if (notificationPermission === 'granted') {
                subscribeUserToPush();
            }
        }
    }, [session, notificationPermission]);

    const handleRequestPermission = async () => {
        if (!('Notification' in window)) return;
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
