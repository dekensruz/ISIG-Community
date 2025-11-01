import React, { useState, useEffect, useRef } from 'react';
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

  const renderContentWithLinks = (text: string) => {
    // A regex to find URLs and wrap them in anchor tags
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-isig-blue hover:underline break-all">
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

  const handleLike = async () => {
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

  return (
    <div 
      className="fixed inset-0 w-screen h-screen bg-black/90 z-50 flex justify-center items-center"
      onClick={handleBackdropClick}
    >
        <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-[60]"
            onClick={onClose}
            aria-label="Close image view"
        >
            <X size={32} />
        </button>

        <div 
          ref={modalContentRef} 
          className="relative w-full h-full flex flex-col items-center justify-center"
        >
            <div className="flex-1 flex items-center justify-center h-full w-full p-4">
               {post.media_url && post.media_type?.startsWith('image/') ? (
                 <img 
                    src={post.media_url} 
                    alt="Full screen view" 
                    className="max-w-full max-h-full object-contain"
                />
               ) : (
                 <div className="text-white text-lg">
                    Media could not be loaded.
                 </div>
               )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pt-8 pb-8 sm:pb-12 bg-gradient-to-t from-black/70 to-transparent">
                <div className="w-full max-w-4xl mx-auto text-white">
                    {post.content && <p className="mb-4 text-gray-200 text-sm">{renderContentWithLinks(post.content)}</p>}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-5 text-gray-200">
                            <button onClick={handleLike} disabled={!session} className={`flex items-center space-x-2 transition-colors ${!session ? 'cursor-not-allowed text-gray-500' : `hover:text-white ${userHasLiked ? 'text-isig-orange' : ''}`}`}>
                                <Heart size={24} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                                <span className="font-semibold">{likes.length}</span>
                            </button>
                            <button onClick={onOpenComments} className="flex items-center space-x-2 hover:text-white">
                                <MessageCircle size={24} />
                                <span className="font-semibold">{post.group_post_comments.length}</span>
                            </button>
                            <button className="flex items-center space-x-2 hover:text-white">
                                <Share2 size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default GroupImageModal;
