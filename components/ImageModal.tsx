
import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, MessageCircle, Share2 } from 'lucide-react';
import { Post as PostType, Like } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';

interface ImageModalProps {
  post: PostType;
  onClose: () => void;
  onOpenComments: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ post, onClose, onOpenComments }) => {
  const { session } = useAuth();
  const [likes, setLikes] = useState<Like[]>(post.likes);
  const modalContentRef = useRef<HTMLDivElement>(null);

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
    setLikes(post.likes);
  }, [post.likes]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
        await supabase.from('likes').delete().eq('id', like.id);
      }
    } else {
      const tempLike: Like = { id: `temp-${Date.now()}`, post_id: post.id, user_id: session.user.id };
      setLikes([...likes, tempLike]);
      const { error } = await supabase.from('likes').insert({ post_id: post.id, user_id: session.user.id });
      if (error) {
          setLikes(prev => prev.filter(l => l.id !== tempLike.id));
      }
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(); // Fermer l'image pour laisser place au modal de commentaires
      onOpenComments();
  };

  return (
    <div 
      className="fixed inset-0 w-screen h-screen bg-black/95 z-50 flex justify-center items-center backdrop-blur-md"
      onClick={handleBackdropClick}
    >
        <button 
            className="absolute top-6 right-6 text-white/50 hover:text-white z-[60] bg-white/10 p-3 rounded-full transition-all"
            onClick={onClose}
        >
            <X size={24} />
        </button>

        <div 
          ref={modalContentRef} 
          className="relative w-full h-full flex flex-col items-center justify-center animate-fade-in-up"
        >
            <div className="flex-1 flex items-center justify-center h-full w-full p-4 sm:p-10">
               <img 
                    src={post.media_url} 
                    alt="Full view" 
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl shadow-black/50"
                />
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-6 pt-12 pb-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <div className="w-full max-w-3xl mx-auto text-white">
                    {post.content && (
                        <p className="mb-6 text-white/90 text-base font-medium leading-relaxed line-clamp-3">
                            {renderContentWithLinks(post.content)}
                        </p>
                    )}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-6 text-white/70">
                            <button onClick={handleLike} className={`flex items-center space-x-2 transition-all hover:text-white ${userHasLiked ? 'text-isig-orange' : ''}`}>
                                <Heart size={26} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                                <span className="font-black text-lg">{likes.length}</span>
                            </button>
                            <button onClick={handleCommentClick} className="flex items-center space-x-2 transition-all hover:text-white">
                                <MessageCircle size={26} />
                                <span className="font-black text-lg">{post.comments.length}</span>
                            </button>
                        </div>
                        <button className="p-3 bg-white/10 rounded-2xl text-white/70 hover:text-white hover:bg-white/20 transition-all">
                            <Share2 size={24} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ImageModal;
