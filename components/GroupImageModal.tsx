
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, MessageCircle, Share2 } from 'lucide-react';
import { GroupPost, GroupPostLike } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';

interface GroupImageModalProps {
  post: GroupPost;
  onClose: () => void;
  onOpenComments: () => void;
}

const GroupImageModal: React.FC<GroupImageModalProps> = ({ post, onClose, onOpenComments }) => {
  const { session } = useAuth();
  const [likes, setLikes] = useState<GroupPostLike[]>(post.group_post_likes);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const modalRoot = document.getElementById('modal-root');

  const renderContentWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-isig-blue hover:underline break-all" onClick={e => e.stopPropagation()}>
            {part}
          </a>
        );
      }
      return part;
    });
  };

  useEffect(() => {
    setLikes(post.group_post_likes);
  }, [post.group_post_likes]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
  };
  
  const userHasLiked = likes.some(like => like.user_id === session?.user.id);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) return;
    
    if (userHasLiked) {
      const like = likes.find(l => l.user_id === session.user.id);
      if (like) {
        setLikes(likes.filter(l => l.id !== like.id));
        await supabase.from('group_post_likes').delete().eq('id', like.id);
      }
    } else {
      const tempLike: GroupPostLike = { id: `temp-${Date.now()}`, group_post_id: post.id, user_id: session.user.id };
      setLikes([...likes, tempLike]);
      const { error } = await supabase.from('group_post_likes').insert({ group_post_id: post.id, user_id: session.user.id });
      if (error) {
          setLikes(prev => prev.filter(l => l.id !== tempLike.id));
      }
    }
  };

  if (!modalRoot) return null;

  return createPortal(
    <div 
      className="fixed inset-0 w-full h-full bg-brand-dark/95 z-[999] flex justify-center items-center backdrop-blur-xl animate-fade-in"
      onClick={handleBackdropClick}
    >
        <button 
            className="absolute top-6 right-6 text-white/50 hover:text-white z-[1000] bg-white/10 p-3 rounded-full transition-all"
            onClick={onClose}
        >
            <X size={28} />
        </button>

        <div 
          ref={modalContentRef} 
          className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-10"
        >
            <div className="flex-1 flex items-center justify-center w-full h-full">
               <img 
                    src={post.media_url} 
                    alt="Group view" 
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                />
            </div>

            <div className="w-full max-w-4xl mx-auto mt-6 text-white">
                {post.content && <p className="mb-6 text-white/90 text-sm sm:text-base font-medium line-clamp-2">{renderContentWithLinks(post.content)}</p>}
                <div className="flex justify-between items-center pb-8 sm:pb-0">
                    <div className="flex items-center space-x-6 text-white/70">
                        <button onClick={handleLike} className={`flex items-center space-x-2 transition-all hover:text-white ${userHasLiked ? 'text-isig-orange' : ''}`}>
                            <Heart size={26} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                            <span className="font-black text-lg">{likes.length}</span>
                        </button>
                        <button onClick={() => { onClose(); onOpenComments(); }} className="flex items-center space-x-2 transition-all hover:text-white">
                            <MessageCircle size={26} />
                            <span className="font-black text-lg">{post.group_post_comments.length}</span>
                        </button>
                    </div>
                    <button className="p-3 bg-white/10 rounded-2xl text-white/70 hover:text-white transition-all">
                        <Share2 size={24} />
                    </button>
                </div>
            </div>
        </div>
    </div>,
    modalRoot
  );
};

export default GroupImageModal;
