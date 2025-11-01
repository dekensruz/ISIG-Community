import React, { useEffect } from 'react';
import { Notification } from '../types';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Avatar from './Avatar';
import { Heart, MessageCircle, MessageSquare, Users } from 'lucide-react';

interface NotificationsDropdownProps {
    notifications: Notification[];
    onClose: () => void;
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ notifications, onClose, setNotifications }) => {
    
    useEffect(() => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length > 0) {
            const markAsRead = async () => {
                await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
                setNotifications(prev => prev.map(n => ({...n, is_read: unreadIds.includes(n.id) ? true : n.is_read })));
            };
            const timer = setTimeout(markAsRead, 2000);
            return () => clearTimeout(timer);
        }
    }, [notifications, setNotifications]);
    
    const getNotificationLink = (notification: Notification): string => {
        switch(notification.type) {
            case 'new_like':
            case 'new_comment':
            case 'new_comment_reply':
                return notification.post_id ? `/post/${notification.post_id}?openModal=true` : '#';
            case 'new_message':
                return notification.conversation_id ? `/chat/${notification.conversation_id}` : '/chat';
            case 'new_group_post':
            case 'new_group_comment':
            case 'new_group_comment_reply':
            case 'new_group_like':
                const baseGroupPath = notification.group_id ? `/group/${notification.group_id}` : '/groups';
                if (notification.group_post_id) {
                    return `${baseGroupPath}?postId=${notification.group_post_id}&openModal=true`;
                }
                return baseGroupPath;
            case 'group_join_request':
            case 'group_member_joined':
                 return notification.group_id ? `/group/${notification.group_id}` : '/groups';
            case 'new_follower':
                return `/profile/${notification.actor_id}`;
            default:
                return '#';
        }
    };

    const getNotificationText = (notification: Notification): React.ReactNode => {
        const actorName = <strong className="font-semibold">{notification.profiles?.full_name || 'Quelqu\'un'}</strong>;
        switch (notification.type) {
            case 'new_like':
                return <>{actorName} a aimé votre publication.</>;
            case 'new_group_like':
                return <>{actorName} a aimé votre publication dans un groupe.</>;
            case 'new_comment':
                return <>{actorName} a commenté votre publication.</>;
            case 'new_comment_reply':
                return <>{actorName} a répondu à votre commentaire.</>;
            case 'new_group_post':
                return <>{actorName} a publié dans un de vos groupes.</>;
            case 'new_group_comment':
                return <>{actorName} a commenté votre publication dans un groupe.</>;
            case 'new_group_comment_reply':
                return <>{actorName} a répondu à votre commentaire dans un groupe.</>;
            case 'new_message':
                return <>{actorName} vous a envoyé un message.</>;
            case 'group_join_request':
                return <>{actorName} souhaite rejoindre un de vos groupes.</>;
            case 'group_member_joined':
                return <>{actorName} a rejoint un de vos groupes.</>;
            default:
                return <>Vous avez une nouvelle notification.</>;
        }
    };
    
    const getNotificationIcon = (notification: Notification): React.ReactNode => {
        const iconBaseClasses = "absolute bottom-0 right-0 bg-white p-0.5 rounded-full ring-2 ring-white";
        switch (notification.type) {
            case 'new_like':
            case 'new_group_like':
                return <div className={iconBaseClasses}><Heart className="h-4 w-4 text-isig-orange" fill="#FF8C00" /></div>;
            case 'new_comment':
            case 'new_group_comment':
            case 'new_comment_reply':
            case 'new_group_comment_reply':
                 return <div className={iconBaseClasses}><MessageCircle className="h-4 w-4 text-isig-blue" fill="#00AEEF" /></div>;
            case 'new_message':
                 return <div className={iconBaseClasses}><MessageSquare className="h-4 w-4 text-green-500" fill="#22c55e" /></div>;
            case 'group_join_request':
            case 'group_member_joined':
                 return <div className={iconBaseClasses}><Users className="h-4 w-4 text-green-500" /></div>;
            default:
                return null;
        }
    };

    return (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-md shadow-lg z-20 border border-slate-100 max-h-[70vh] flex flex-col">
            <div className="p-4 border-b">
                <h3 className="font-bold text-lg text-slate-800">Notifications</h3>
            </div>
            <div className="flex-grow overflow-y-auto">
                {notifications.length > 0 ? (
                    notifications.map(notification => (
                        <Link 
                            to={getNotificationLink(notification)} 
                            key={notification.id} 
                            onClick={onClose}
                            className={`flex items-start p-4 hover:bg-slate-50 transition-colors duration-150 ${!notification.is_read ? 'bg-blue-50' : ''}`}
                        >
                            <div className="relative mr-4 flex-shrink-0">
                                <Avatar avatarUrl={notification.profiles?.avatar_url} name={notification.profiles?.full_name || ''} />
                                {getNotificationIcon(notification)}
                            </div>
                            <div className="flex-grow">
                                <p className="text-sm text-slate-700">{getNotificationText(notification)}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
                                </p>
                            </div>
                        </Link>
                    ))
                ) : (
                    <p className="text-center text-slate-500 p-8">Aucune notification pour le moment.</p>
                )}
            </div>
            <div className="p-2 border-t text-center">
                <Link to="/notifications" onClick={onClose} className="text-sm font-semibold text-isig-blue hover:underline">
                    Voir toutes les notifications
                </Link>
            </div>
        </div>
    );
};

export default NotificationsDropdown;