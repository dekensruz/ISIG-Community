
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Notification } from '../types';
import Spinner from './Spinner';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Avatar from './Avatar';
import { Heart, MessageCircle, MessageSquare, Users, Search, Bell, UserCheck, UserX, Crown } from 'lucide-react';

const NotificationsPage: React.FC = () => {
    const { session } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchNotifications = async (showLoading = true) => {
        if (!session?.user) return;
        if (showLoading) setLoading(true);

        const { data, error } = await supabase
            .from('notifications')
            .select('*, profiles:actor_id(*)')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setNotifications(data as any);
            
            const unreadIds = data.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length > 0) {
                await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchNotifications();

        if (session?.user) {
            const channel = supabase.channel(`notifications_page_${session.user.id}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications', 
                    filter: `user_id=eq.${session.user.id}` 
                }, () => {
                    fetchNotifications(false);
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [session]);


    const getNotificationLink = (notification: Notification): string => {
        switch (notification.type) {
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
            case 'group_request_accepted':
            case 'group_member_left':
            case 'group_admin_promotion':
                return notification.group_id ? `/group/${notification.group_id}` : '/groups';
            case 'new_follower':
                return `/profile/${notification.actor_id}`;
            default:
                return '#';
        }
    };

    const getNotificationText = (notification: Notification): string => {
        const actorName = notification.profiles?.full_name || 'Quelqu\'un';
        switch (notification.type) {
            case 'new_like': return `${actorName} a aimé votre publication.`;
            case 'new_group_like': return `${actorName} a aimé votre publication dans un groupe.`;
            case 'new_comment': return `${actorName} a commenté votre publication.`;
            case 'new_comment_reply': return `${actorName} a répondu à votre commentaire.`;
            case 'new_group_post': return `${actorName} a publié dans un de vos groupes.`;
            case 'new_group_comment': return `${actorName} a commenté dans un groupe.`;
            case 'new_group_comment_reply': return `${actorName} a répondu à votre commentaire dans un groupe.`;
            case 'new_message': return `${actorName} vous a envoyé un message.`;
            case 'group_join_request': return `${actorName} souhaite rejoindre un de vos groupes.`;
            case 'group_member_joined': return `${actorName} a rejoint un de vos groupes.`;
            case 'group_request_accepted': return `${actorName} a accepté votre demande d'adhésion.`;
            case 'group_member_left': return `${actorName} a quitté un de vos groupes.`;
            case 'group_admin_promotion': return `${actorName} vous a promu administrateur d'un groupe.`;
            case 'new_follower': return `${actorName} s'est abonné à votre profil.`;
            default: return `Vous avez une nouvelle notification.`;
        }
    };

    const getNotificationIcon = (notification: Notification): React.ReactNode => {
        const iconBaseClasses = "absolute -bottom-1 -right-1 bg-white p-1 rounded-full ring-2 ring-white";
        switch (notification.type) {
            case 'new_like':
            case 'new_group_like':
                return <div className={iconBaseClasses}><Heart className="h-5 w-5 text-isig-orange" fill="#FF8C00" /></div>;
            case 'new_comment':
            case 'new_group_comment':
            case 'new_comment_reply':
            case 'new_group_comment_reply':
                return <div className={iconBaseClasses}><MessageCircle className="h-5 w-5 text-isig-blue" fill="#00AEEF" /></div>;
            case 'new_message':
                return <div className={iconBaseClasses}><MessageSquare className="h-5 w-5 text-green-500" fill="#22c55e" /></div>;
            case 'group_join_request':
            case 'group_member_joined':
            case 'new_follower':
                return <div className={iconBaseClasses}><Users className="h-5 w-5 text-isig-blue" /></div>;
            case 'group_request_accepted':
                return <div className={iconBaseClasses}><UserCheck className="h-5 w-5 text-green-500" /></div>;
            case 'group_member_left':
                return <div className={iconBaseClasses}><UserX className="h-5 w-5 text-red-500" /></div>;
            case 'group_admin_promotion':
                 return <div className={iconBaseClasses}><Crown className="h-5 w-5 text-isig-orange" /></div>;
            default:
                return null;
        }
    };

    const filteredNotifications = useMemo(() => {
        if (!searchQuery) return notifications;
        const lowercasedQuery = searchQuery.toLowerCase();
        return notifications.filter(n =>
            getNotificationText(n).toLowerCase().includes(lowercasedQuery)
        );
    }, [searchQuery, notifications]);

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-black text-slate-800 mb-6 italic uppercase tracking-tight">Notifications</h1>

            <div className="relative mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher dans les notifications..."
                    className="w-full bg-white border border-slate-100 rounded-2xl pl-10 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-isig-blue shadow-soft font-bold text-sm"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center p-12"><Spinner /></div>
                ) : filteredNotifications.length > 0 ? (
                    <ul className="divide-y divide-slate-50">
                        {filteredNotifications.map(notification => (
                            <li key={notification.id}>
                                <Link
                                    to={getNotificationLink(notification)}
                                    className={`flex items-start p-6 hover:bg-slate-50 transition-all duration-300 ${!notification.is_read ? 'bg-isig-blue/5 border-l-4 border-isig-blue' : 'border-l-4 border-transparent'}`}
                                >
                                    <div className="relative mr-4 flex-shrink-0">
                                        <Avatar avatarUrl={notification.profiles?.avatar_url} name={notification.profiles?.full_name || ''} size="lg" />
                                        {getNotificationIcon(notification)}
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-sm text-slate-700 font-medium leading-relaxed">{getNotificationText(notification)}</p>
                                        <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-widest">
                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
                                        </p>
                                    </div>
                                    {!notification.is_read && (
                                        <div className="w-2.5 h-2.5 bg-isig-blue rounded-full self-center ml-4 flex-shrink-0 animate-pulse"></div>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center text-slate-500 p-16">
                         <Bell size={48} className="mx-auto text-slate-200 mb-6" />
                         <h3 className="text-xl font-black text-slate-700 uppercase italic">
                            {searchQuery ? 'Aucun résultat' : 'Le calme plat'}
                         </h3>
                         <p className="text-sm font-medium mt-2 text-slate-400">
                            {searchQuery ? 'Essayez un autre mot-clé.' : 'Vos futures interactions apparaîtront ici.'}
                         </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
