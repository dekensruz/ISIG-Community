import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Message } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCheck, MoreHorizontal, MessageSquareReply, Pencil, Trash2, XCircle, Download, Share, Play, Pause } from 'lucide-react';

interface MessageBubbleProps {
    message: Message;
    isOwnMessage: boolean;
    onSetEditing: (message: Message) => void;
    onSetReplying: (message: Message) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    onMediaClick: (url: string, type: string, name: string) => void;
}

const AudioPlayer: React.FC<{ src: string; isOwnMessage: boolean }> = ({ src, isOwnMessage }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const progressBar = e.currentTarget;
        const clickPosition = e.clientX - progressBar.getBoundingClientRect().left;
        const newTime = (clickPosition / progressBar.offsetWidth) * duration;
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        
        const setAudioData = () => {
            if (isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
            setCurrentTime(audio.currentTime);
        };

        const setAudioTime = () => setCurrentTime(audio.currentTime);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onPause);

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onPause);
        };
    }, []);

    const formatTimeDisplay = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    const progress = duration ? (currentTime / duration) * 100 : 0;
    
    const playerColorClass = isOwnMessage ? 'text-white' : 'text-slate-600';
    const progressBgClass = isOwnMessage ? 'bg-white/30' : 'bg-slate-200';
    const progressFillClass = isOwnMessage ? 'bg-white' : 'bg-isig-blue';
    const buttonBgClass = isOwnMessage ? 'bg-white/20 hover:bg-white/40' : 'bg-slate-200 hover:bg-slate-300';

    return (
        <div className={`flex items-center gap-2 mt-1 w-60 sm:w-64 ${playerColorClass}`}>
            <audio ref={audioRef} src={src} preload="metadata"></audio>
            <button onClick={handlePlayPause} className={`p-2 rounded-full transition-colors ${buttonBgClass}`}>
                {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current" />}
            </button>
            <div className="flex-1 flex flex-col justify-center">
                <div onClick={handleProgressClick} className={`h-1.5 w-full rounded-full cursor-pointer ${progressBgClass}`}>
                    <div style={{ width: `${progress}%` }} className={`h-full rounded-full ${progressFillClass}`}></div>
                </div>
                 <div className="text-xs font-mono mt-1 self-end opacity-80">
                    {formatTimeDisplay(currentTime)} / {formatTimeDisplay(duration)}
                </div>
            </div>
        </div>
    );
};


const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwnMessage, onSetEditing, onSetReplying, setMessages, onMediaClick }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const time = format(new Date(message.created_at), 'HH:mm', { locale: fr });
    const isEdited = message.updated_at && new Date(message.updated_at).getTime() - new Date(message.created_at).getTime() > 1000;


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleDeleteForMe = async () => {
        setMenuOpen(false);
        setMessages(prev => prev.filter(m => m.id !== message.id));
    }
    
    const handleDeleteForEveryone = async () => {
        setMenuOpen(false);
        const { error } = await supabase.from('messages').delete().eq('id', message.id);
        if (error) {
            alert("Erreur lors de la suppression du message.");
        }
    }
    
    const renderMedia = () => {
        if (!message.media_url || !message.media_type) return null;
        
        if (message.media_type.startsWith('image/')) {
            return (
                <button
                    onClick={() => onMediaClick(message.media_url!, message.media_type!, message.media_url!.split('/').pop()!)}
                    className="mt-1 rounded-lg max-w-full w-64 md:w-80 overflow-hidden cursor-pointer block"
                >
                    <img src={message.media_url} alt="Contenu multimédia" className="w-full h-auto object-cover" />
                </button>
            );
        }

        if (message.media_type.startsWith('audio/')) {
            return <AudioPlayer src={message.media_url} isOwnMessage={isOwnMessage} />;
        }
        
        const textColorClass = isOwnMessage ? 'text-white' : 'text-slate-800';
        return (
             <button onClick={() => onMediaClick(message.media_url!, message.media_type!, message.media_url!.split('/').pop()!)} className={`flex items-center w-full space-x-3 p-3 mt-1 rounded-lg text-left ${isOwnMessage ? 'bg-black/20 hover:bg-black/30' : 'bg-slate-100 hover:bg-slate-200'}`}>
                <Download size={32} className={textColorClass} />
                <div className={`flex-1 min-w-0 ${textColorClass}`}>
                    <p className="font-semibold break-words">{message.media_url!.split('/').pop()}</p>
                    <p className="text-xs opacity-80">Fichier {message.media_type.split('/')[1] || ''}</p>
                </div>
            </button>
        )
    };

    const StatusIcon = () => {
        if (!isOwnMessage) return null;
    
        if (message.is_read) {
            return <CheckCheck size={16} className="ml-1 text-isig-orange" aria-label="Lu" />;
        }
        return <CheckCheck size={16} className="ml-1" style={{ color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#94a3b8' }} aria-label="Distribué" />;
    };

    return (
        <div className={`group flex items-end gap-2 w-full ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
             <div className={`relative self-center ${isOwnMessage ? 'order-1' : 'order-3'}`}>
                <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal size={20} />
                </button>
                {menuOpen && (
                    <div ref={menuRef} className={`absolute top-0 mt-6 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-slate-100 ${isOwnMessage ? 'right-0' : 'left-0'}`}>
                        <button onClick={() => { onSetReplying(message); setMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><MessageSquareReply size={16} className="mr-2"/>Répondre</button>
                        <button onClick={() => alert('Fonctionnalité bientôt disponible !')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><Share size={16} className="mr-2"/>Transférer</button>
                        {isOwnMessage && message.content && <button onClick={() => { onSetEditing(message); setMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><Pencil size={16} className="mr-2"/>Modifier</button>}
                        <div className="border-t my-1"></div>
                        <button onClick={handleDeleteForMe} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"><XCircle size={16} className="mr-2"/>Supprimer pour moi</button>
                        {isOwnMessage && <button onClick={handleDeleteForEveryone} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={16} className="mr-2"/>Supprimer pour tous</button>}
                    </div>
                )}
            </div>
            <div className={`relative max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 rounded-2xl order-2 ${isOwnMessage ? 'bg-isig-blue text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none border'}`}>
                 {message.replied_to && (
                     <div className={`p-2 mb-1 border-l-2 rounded-md ${isOwnMessage ? 'border-white/50 bg-black/20' : 'border-isig-blue bg-slate-100'}`}>
                         <p className="font-bold text-sm">{message.replied_to.profiles?.full_name}</p>
                         <p className={`text-sm opacity-90 line-clamp-2 ${isOwnMessage ? '' : 'text-slate-600'}`}>{message.replied_to.content}</p>
                     </div>
                 )}
                {renderMedia()}
                {message.content && <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>}
                <div className="text-right text-xs mt-1 flex justify-end items-center" style={{ color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'rgb(100 116 139)' }}>
                    {isEdited && <span className="mr-1">modifié</span>}
                    {time}
                    <StatusIcon />
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
