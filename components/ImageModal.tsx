
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, MessageCircle, Share2 } from 'lucide-react';
import { Post as PostType, Like } from '../types';
import { useAuth } from '../App';
import { supabase, getOptimizedImageUrl } from '../services/supabase';

interface ImageModalProps {
  post: PostType;
  onClose: () => void;
  onOpenComments: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ post, onClose, onOpenComments }) => {
  const { session } = useAuth();
  const [likes, setLikes] = useState<Like[]>(post.likes);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const modalRoot = document.getElementById('modal-root');
  
  // Gesture State
  const [scale, setScale] = useState(1);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);
  const lastTap = useRef(0);

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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    const shareText = `Découvrez ce post de ${post.profiles.full_name} sur ISIG Community : ${url}`;
    
    try {
        if (navigator.share) {
            await navigator.share({
                title: 'ISIG Community',
                text: `Découvrez ce post de ${post.profiles.full_name} sur ISIG Community`,
                url: url,
            });
        } else {
            throw new Error('Web Share API non supportée');
        }
    } catch (err) {
        try {
            await navigator.clipboard.writeText(shareText);
            alert("Lien copié dans votre presse-papier !");
        } catch (copyErr) {
            console.error("Erreur de copie", copyErr);
        }
    }
  };

  // Touch Handlers for Gestures
  const handleTouchStart = (e: React.TouchEvent) => {
      if (scale > 1) return; // Disable swipe if zoomed
      touchStartY.current = e.touches[0].clientY;
      setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDragging || scale > 1) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY.current;
      
      // Only allow dragging down
      if (deltaY > 0) {
          setTranslateY(deltaY);
      }
  };

  const handleTouchEnd = () => {
      setIsDragging(false);
      if (translateY > 150) { // Threshold to close
          onClose();
      } else {
          setTranslateY(0); // Reset position
      }
  };

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      
      if (now - lastTap.current < DOUBLE_TAP_DELAY) {
          setScale(prev => prev > 1 ? 1 : 2.5);
      }
      lastTap.current = now;
  };

  if (!modalRoot) return null;

  // Calculate opacity based on drag distance
  const backdropOpacity = Math.max(0, 1 - translateY / 400);

  return createPortal(
    <div 
      className="fixed inset-0 w-full h-full z-[999] flex justify-center items-center backdrop-blur-xl animate-fade-in"
      style={{ backgroundColor: `rgba(15, 23, 42, ${backdropOpacity * 0.95})` }}
      onClick={handleBackdropClick}
    >
        <button 
            className="absolute top-6 right-6 text-white/50 hover:text-white z-[1000] bg-white/10 p-3 rounded-full transition-all"
            onClick={onClose}
            style={{ opacity: backdropOpacity }}
        >
            <X size={28} />
        </button>

        <div 
          ref={modalContentRef} 
          className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-10 transition-transform duration-200 ease-out"
          style={{ transform: `translateY(${translateY}px)` }}
        >
            <div 
                className="flex-1 flex items-center justify-center w-full h-full overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleDoubleTap} // Desktop double click
            >
               <img 
                    src={getOptimizedImageUrl(post.media_url, 1200)} 
                    alt="Full view" 
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-transform duration-300"
                    style={{ transform: `scale(${scale})`, cursor: scale > 1 ? 'zoom-out' : 'zoom-in' }}
                />
            </div>

            <div 
                className="w-full max-w-4xl mx-auto mt-6 text-white transition-opacity duration-200"
                style={{ opacity: scale > 1 ? 0 : backdropOpacity }}
            >
                {post.content && <p className="mb-6 text-white/90 text-sm sm:text-base font-medium line-clamp-2">{renderContentWithLinks(post.content)}</p>}
                <div className="flex justify-between items-center pb-8 sm:pb-0">
                    <div className="flex items-center space-x-6 text-white/70">
                        <button onClick={handleLike} className={`flex items-center space-x-2 transition-all ${userHasLiked ? 'text-isig-orange' : 'hover:text-white'}`}>
                            <Heart size={26} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                            <span className="font-black text-lg">{likes.length}</span>
                        </button>
                        <button onClick={() => { onClose(); onOpenComments(); }} className="flex items-center space-x-2 hover:text-white transition-all">
                            <MessageCircle size={26} />
                            <span className="font-black text-lg">{post.comments.length}</span>
                        </button>
                    </div>
                    <button onClick={handleShare} className="p-3 bg-white/10 rounded-2xl text-white/70 hover:text-white transition-all">
                        <Share2 size={24} />
                    </button>
                </div>
            </div>
        </div>
    </div>,
    modalRoot
  );
};

export default ImageModal;
