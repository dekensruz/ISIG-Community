
import React, { useState, useEffect, useMemo } from 'react';
import { Post as PostType, Profile, Like } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { formatDistanceToNow } from 'date-fns';
import * as locales from 'date-fns/locale';
import { Heart, MessageCircle, Share2, FileText, MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import ImageModal from './ImageModal';
import PostDetailModal from './PostDetailModal';
import Avatar from './Avatar';
import LikerListModal from './LikerListModal';
import Spinner from './Spinner';

interface PostProps {
  post: PostType;
  startWithModalOpen?: boolean;
  onEditRequested?: (post: PostType) => void;
}

const PostCard: React.FC<PostProps> = ({ post, startWithModalOpen = false, onEditRequested }) => {
  const { session } = useAuth();
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPostDetailModal, setShowPostDetailModal] = useState(startWithModalOpen);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [likes, setLikes] = useState<Like[]>(post.likes);
  const [likerProfiles, setLikerProfiles] = useState<Profile[]>([]);
  const isLiked = useMemo(() => likes.some(l => l.user_id === session?.user.id), [likes, session]);

  const CONTENT_LIMIT = 280;
  const isLongContent = post.content.length > CONTENT_LIMIT;
  const displayedContent = isExpanded ? post.content : post.content.substring(0, CONTENT_LIMIT);

  useEffect(() => {
    const fetchTopLikers = async () => {
      if (likes.length === 0) {
        setLikerProfiles([]);
        return;
      }
      const likerIds = likes.slice(0, 3).map(l => l.user_id);
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', likerIds);
      if (data) {
        const sorted = likerIds.map(id => data.find(p => p.id === id)).filter(Boolean) as Profile[];
        setLikerProfiles(sorted);
      }
    };
    fetchTopLikers();
  }, [likes]);

  const renderContentWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-isig-blue hover:underline break-all" onClick={e => e.stopPropagation()}>{part}</a>;
      }
      return part;
    });
  };

  const handleLike = async () => {
    if (!session?.user) return;
    if (isLiked) {
      const like = likes.find(l => l.user_id === session.user.id);
      if (like) {
        setLikes(prev => prev.filter(l => l.id !== like.id));
        await supabase.from('likes').delete().match({ post_id: post.id, user_id: session.user.id });
      }
    } else {
      const tempLike = { id: Math.random().toString(), post_id: post.id, user_id: session.user.id };
      setLikes(prev => [tempLike as any, ...prev]);
      await supabase.from('likes').insert({ post_id: post.id, user_id: session.user.id });
    }
  };

  const handleShare = async () => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/post/${post.id}`;
    
    const shareData = {
        title: `ISIG Community`,
        text: `Découvrez cette publication académique sur ISIG Community.`,
        url: shareUrl,
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(shareUrl);
            alert("Lien de la publication copié !");
        }
    } catch (err) {
        console.error("Erreur de partage:", err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer cette publication ?")) {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (!error) window.location.reload();
    }
  };

  const getLikeText = () => {
    if (likes.length === 0) return "";
    const count = likes.length;
    const userLiked = isLiked;
    
    if (userLiked) {
      if (count === 1) return "Vous avez aimé";
      if (count === 2) return "Vous et 1 autre personne";
      return `Vous et ${count - 1} autres personnes`;
    } else {
      const firstLiker = likerProfiles[0]?.full_name?.split(' ')[0] || "Quelqu'un";
      if (count === 1) return `${firstLiker} a aimé`;
      if (count === 2) return `${firstLiker} et 1 autre personne`;
      return `${firstLiker} et ${count - 1} autres personnes`;
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-soft overflow-hidden transition-all hover:shadow-premium group relative">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to={`/profile/${post.profiles.id}`}>
            <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" className="ring-4 ring-slate-50 transition-transform group-hover:scale-105" />
          </Link>
          <div>
            <Link to={`/profile/${post.profiles.id}`} className="block text-base font-extrabold text-slate-800 hover:text-isig-blue transition-colors">
                {post.profiles.full_name}
            </Link>
            <div className="flex items-center text-[10px] text-slate-400 font-black uppercase tracking-widest">
                <span>{post.profiles.major}</span>
                <span className="mx-2 text-slate-300">•</span>
                <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: locales.fr })}</span>
            </div>
          </div>
        </div>

        {session?.user.id === post.user_id && (
          <div className="relative">
            <button onClick={() => setShowOptions(!showOptions)} className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors">
              <MoreHorizontal size={20} />
            </button>
            {showOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-premium border border-slate-100 py-2 z-20 overflow-hidden">
                <button 
                  onClick={() => { 
                    if(onEditRequested) onEditRequested(post);
                    setShowOptions(false); 
                  }} 
                  className="w-full flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={16} className="mr-3 text-isig-blue" /> Modifier
                </button>
                <button onClick={() => { handleDelete(); setShowOptions(false); }} className="w-full flex items-center px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50">
                  <Trash2 size={16} className="mr-3" /> Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-7 pb-4">
        <div className="text-[16px] text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
          {renderContentWithLinks(displayedContent)}
          {!isExpanded && isLongContent && <span>...</span>}
        </div>
        {isLongContent && (
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="mt-2 text-isig-blue font-black text-xs uppercase tracking-widest flex items-center hover:opacity-70 transition-opacity"
            >
                {isExpanded ? <><ChevronUp size={16} className="mr-1"/> Voir moins</> : <><ChevronDown size={16} className="mr-1"/> Voir plus</>}
            </button>
        )}
      </div>

      {post.media_url && (
        <div className="px-6 pb-6">
           {post.media_type === 'image' ? (
             <div onClick={() => setShowImageModal(true)} className="rounded-[2rem] overflow-hidden cursor-pointer bg-slate-100 aspect-video relative group/media ring-1 ring-slate-100">
               {!imageLoaded && <div className="absolute inset-0 bg-slate-100 animate-pulse-soft flex items-center justify-center"><Spinner /></div>}
               <img 
                 src={post.media_url} 
                 alt="Contenu" 
                 loading="lazy"
                 onLoad={() => setImageLoaded(true)}
                 className={`w-full h-full object-cover transition-all duration-1000 ${imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} group-hover/media:scale-110`} 
               />
               <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/5 transition-colors"></div>
             </div>
           ) : (
             <a href={post.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] hover:bg-slate-100 transition-all transform hover:-translate-y-1">
                <div className="w-12 h-12 bg-isig-blue/10 rounded-2xl flex items-center justify-center text-isig-blue mr-4">
                   <FileText size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">Document attaché</p>
                    <p className="text-xs text-slate-500 font-bold italic">Cliquer pour consulter</p>
                </div>
             </a>
           )}
        </div>
      )}

      {likes.length > 0 && (
          <div className="px-7 pb-4">
              <button 
                onClick={() => setShowLikersModal(true)}
                className="flex items-center text-[11px] font-black text-slate-400 uppercase tracking-wider hover:text-isig-blue transition-colors group/likes"
              >
                  <div className="flex -space-x-2 mr-3">
                      {likerProfiles.slice(0, 3).map(p => (
                          <Avatar key={p.id} avatarUrl={p.avatar_url} name={p.full_name} size="sm" className="ring-2 ring-white" />
                      ))}
                  </div>
                  <span>{getLikeText()}</span>
              </button>
          </div>
      )}

      <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={handleLike} className={`flex items-center space-x-2 px-5 py-3 rounded-2xl transition-all ${isLiked ? 'text-isig-orange bg-isig-orange/5' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Heart size={22} fill={isLiked ? '#FF8C00' : 'none'} className={`${isLiked ? 'scale-110' : ''} transition-transform duration-300`} />
            <span className="text-sm font-black">{likes.length}</span>
          </button>
          
          <button onClick={() => setShowPostDetailModal(true)} className="flex items-center space-x-2 px-5 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl transition-all">
            <MessageCircle size={22} />
            <span className="text-sm font-black">{post.comments.length}</span>
          </button>
        </div>

        <button onClick={handleShare} className="flex items-center space-x-2 px-5 py-3 text-slate-400 hover:text-isig-blue hover:bg-isig-blue/5 rounded-2xl transition-all">
            <Share2 size={22} />
        </button>
      </div>

      {showImageModal && <ImageModal post={post} onClose={() => setShowImageModal(false)} onOpenComments={() => setShowPostDetailModal(true)} />}
      {showPostDetailModal && <PostDetailModal post={post} onClose={() => setShowPostDetailModal(false)} />}
      {showLikersModal && <LikerListModal postId={post.id} postType="feed" onClose={() => setShowLikersModal(false)} />}
    </div>
  );
};

export default PostCard;
