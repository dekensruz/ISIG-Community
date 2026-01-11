import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Post as PostType, Profile, Like } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { formatDistanceToNow } from 'date-fns';
import * as locales from 'date-fns/locale';
import { Heart, MessageCircle, Share2, FileText, MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ImageModal from './ImageModal';
import PostDetailModal from './PostDetailModal';
import Avatar from './Avatar';
import LikerListModal from './LikerListModal';

interface PostProps {
  post: PostType;
  startWithModalOpen?: boolean;
  onEditRequested?: (post: PostType) => void;
}

const PostCard: React.FC<PostProps> = ({ post, startWithModalOpen = false, onEditRequested }) => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPostDetailModal, setShowPostDetailModal] = useState(startWithModalOpen);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [likes, setLikes] = useState<Like[]>(post.likes || []);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentCount, setCommentCount] = useState(post.comments?.length || 0);
  const [likerProfiles, setLikerProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    setLikes(post.likes || []);
    const actualCount = post.likes?.length || 0;
    setLikesCount(Math.max(post.likes_count || 0, actualCount));
    setCommentCount(post.comments?.length || 0);
  }, [post.likes, post.likes_count, post.comments]);

  const isLiked = useMemo(() => likes.some(l => l.user_id === session?.user.id), [likes, session]);

  useEffect(() => {
    const fetchTopLikers = async () => {
      if (likesCount === 0) {
        setLikerProfiles([]);
        return;
      }
      const { data } = await supabase
        .from('likes')
        .select('profiles(id, full_name, avatar_url)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (data) {
        setLikerProfiles(data.map((d: any) => d.profiles).filter(Boolean));
      }
    };
    fetchTopLikers();
  }, [likesCount, post.id]);

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!session?.user) {
      navigate('/auth');
      return;
    }
    
    if (isLiked) {
      const like = likes.find(l => l.user_id === session.user.id);
      if (like) {
        setLikes(prev => prev.filter(l => l.id !== like.id));
        setLikesCount(prev => Math.max(0, prev - 1));
        await supabase.from('likes').delete().match({ post_id: post.id, user_id: session.user.id });
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      setLikes(prev => [{ id: tempId, post_id: post.id, user_id: session.user.id! } as Like, ...prev]);
      setLikesCount(prev => prev + 1);
      
      const { data, error } = await supabase.from('likes').insert({ post_id: post.id, user_id: session.user.id }).select().single();
      if (error) {
          setLikes(prev => prev.filter(l => l.id !== tempId));
          setLikesCount(prev => prev - 1);
      } else if (data) {
          setLikes(prev => prev.map(l => l.id === tempId ? data : l));
      }
    }
  }, [isLiked, likes, post.id, session?.user.id, navigate]);

  const handleInteractionUpdate = (newLikes: Like[], newCommentCount: number) => {
    setLikes(newLikes);
    setLikesCount(newLikes.length);
    setCommentCount(newCommentCount);
  };

  const getLikeSummaryText = useCallback(() => {
    const count = likesCount;
    if (count === 0) return null;

    if (isLiked) {
        if (count === 1) return "Vous avez aimé";
        const others = likerProfiles.filter(p => p.id !== session?.user.id);
        if (others.length > 0) {
            const otherName = others[0].full_name.split(' ')[0];
            if (count === 2) return `Vous et ${otherName}`;
            const remaining = count - 2;
            return `Vous, ${otherName} et ${remaining} autre${remaining > 1 ? 's' : ''}`;
        }
        const remaining = count - 1;
        return `Vous et ${remaining} autre${remaining > 1 ? 's' : ''}`;
    } else {
        if (likerProfiles.length > 0) {
            const first = likerProfiles[0].full_name.split(' ')[0];
            if (count === 1) return `${first} a aimé`;
            if (count === 2) return `${first} et 1 autre`;
            const remaining = count - 1;
            return `${first} et ${remaining} autres`;
        }
        return `${count} J'aime`;
    }
  }, [isLiked, likerProfiles, likesCount, session?.user.id]);

  const CONTENT_LIMIT = 280;
  const isLongContent = post.content.length > CONTENT_LIMIT;
  const displayedContent = isExpanded ? post.content : post.content.substring(0, CONTENT_LIMIT);

  const renderContentWithLinks = useCallback((text: string) => {
    // Regex améliorée pour détecter les URLs même sans http://
    const urlRegex = /((?:https?:\/\/|www\.)[^\s]+|[a-z0-9.-]+\.(?:com|net|org|edu|ac|cd|io|me|fr|be)[^\s/]*[^\s.,;?!])/gi;
    
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        let href = part;
        if (!href.match(/^https?:\/\//i)) {
          href = `https://${href}`;
        }
        return (
          <a 
            key={index} 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-isig-blue hover:underline break-all transition-colors duration-200" 
            onClick={e => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  }, []);

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-soft overflow-hidden transition-all duration-300 hover:shadow-premium group/card animate-fade-in-up">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <Link to={`/profile/${post.profiles.id}`} className="transition-transform active:scale-90 duration-200 shrink-0">
            <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" className="ring-4 ring-slate-50" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={`/profile/${post.profiles.id}`} className="block text-base font-extrabold text-slate-800 hover:text-isig-blue transition-colors truncate">
                {post.profiles.full_name}
            </Link>
            <div className="flex flex-wrap items-center text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                <span className="truncate max-w-[120px] sm:max-w-none">{post.profiles.major}</span>
                <span className="mx-1.5 text-slate-300 shrink-0">•</span>
                <span className="shrink-0">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: locales.fr })}</span>
            </div>
          </div>
        </div>

        {session?.user.id === post.user_id && (
          <div className="relative shrink-0 ml-2">
            <button onClick={() => setShowOptions(!showOptions)} className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors active:scale-95">
              <MoreHorizontal size={20} />
            </button>
            {showOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-premium border border-slate-100 py-2 z-20 overflow-hidden animate-fade-in">
                <button 
                  onClick={() => { if(onEditRequested) onEditRequested(post); setShowOptions(false); }} 
                  className="w-full flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Pencil size={16} className="mr-3 text-isig-blue" /> Modifier
                </button>
                <button onClick={async () => { if(window.confirm("Supprimer ?")) await supabase.from('posts').delete().eq('id', post.id); setShowOptions(false); }} className="w-full flex items-center px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={16} className="mr-3" /> Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-7 pb-4">
        <div className="text-[16px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
          {renderContentWithLinks(displayedContent)}
          {!isExpanded && isLongContent && <span>...</span>}
        </div>
        {isLongContent && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="mt-2 text-isig-blue font-black text-[10px] uppercase tracking-widest hover:opacity-70 active:scale-95 transition-all">
                {isExpanded ? <><ChevronUp size={14} className="inline mr-1"/>Voir moins</> : <><ChevronDown size={14} className="inline mr-1"/>Voir plus</>}
            </button>
        )}
      </div>

      {post.media_url && (
        <div className="px-6 pb-6">
           {post.media_type === 'image' ? (
             <div 
               onClick={() => setShowImageModal(true)} 
               className="social-image-container cursor-pointer transition-transform duration-300 active:scale-[0.985] group/img"
             >
               <img 
                 src={post.media_url} 
                 alt="Post content" 
                 className="shadow-md"
                 loading="lazy" 
               />
               <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors duration-300"></div>
             </div>
           ) : (
             <a href={post.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] hover:bg-slate-100 transition-all active:scale-[0.98]">
                <FileText size={24} className="text-isig-blue mr-4" />
                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">Consulter le document</span>
             </a>
           )}
        </div>
      )}

      {likesCount > 0 && (
          <div className="px-7 pb-4">
              <button 
                onClick={() => setShowLikersModal(true)}
                className="flex items-center space-x-3 text-[11px] font-black text-slate-400 uppercase tracking-wider hover:text-isig-blue transition-all active:scale-95"
              >
                  <div className="flex -space-x-2">
                      {likerProfiles.length > 0 ? (
                          likerProfiles.slice(0, 3).map(p => (
                            <Avatar key={p.id} avatarUrl={p.avatar_url} name={p.full_name} size="sm" className="ring-2 ring-white" />
                          ))
                      ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white"></div>
                      )}
                  </div>
                  <span className="italic">{getLikeSummaryText()}</span>
              </button>
          </div>
      )}

      <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={handleLike} className={`flex items-center space-x-2 px-5 py-3 rounded-2xl transition-all duration-300 active:scale-90 ${isLiked ? 'text-isig-orange bg-isig-orange/5' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Heart size={22} fill={isLiked ? '#FF8C00' : 'none'} className={`transition-transform duration-300 ${isLiked ? 'scale-110' : ''}`} />
            <span className="text-sm font-black">{likesCount}</span>
          </button>
          
          <button onClick={() => setShowPostDetailModal(true)} className="flex items-center space-x-2 px-5 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl transition-all active:scale-90">
            <MessageCircle size={22} />
            <span className="text-sm font-black">{commentCount}</span>
          </button>
        </div>

        <button onClick={() => {
            const url = `${window.location.origin}/post/${post.id}`;
            if (navigator.share) {
                navigator.share({ title: 'ISIG Community', url });
            } else {
                navigator.clipboard.writeText(url);
                alert("Lien copié !");
            }
        }} className="p-3 text-slate-400 hover:text-isig-blue hover:bg-isig-blue/5 rounded-2xl transition-all active:scale-90">
            <Share2 size={22} />
        </button>
      </div>

      {showImageModal && <ImageModal post={post} onClose={() => setShowImageModal(false)} onOpenComments={() => setShowPostDetailModal(true)} />}
      {showPostDetailModal && (
        <PostDetailModal 
          post={{...post, likes: likes, likes_count: likesCount}} 
          onClose={() => setShowPostDetailModal(false)} 
          onInteractionUpdate={handleInteractionUpdate} 
        />
      )}
      {showLikersModal && <LikerListModal postId={post.id} postType="feed" onClose={() => setShowLikersModal(false)} />}
    </div>
  );
};

export default memo(PostCard);