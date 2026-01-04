
import React, { useState, useEffect, useMemo } from 'react';
import { Post as PostType, Profile, Like } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { formatDistanceToNow } from 'date-fns';
import * as locales from 'date-fns/locale';
import { Heart, MessageCircle, Share2, FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ImageModal from './ImageModal';
import PostDetailModal from './PostDetailModal';
import Avatar from './Avatar';
import LikerListModal from './LikerListModal';
import EditPostModal from './EditPostModal';

interface PostProps {
  post: PostType;
  startWithModalOpen?: boolean;
}

const PostCard: React.FC<PostProps> = ({ post, startWithModalOpen = false }) => {
  const { session } = useAuth();
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPostDetailModal, setShowPostDetailModal] = useState(startWithModalOpen);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  const [likes, setLikes] = useState<Like[]>(post.likes);
  const [likerProfiles, setLikerProfiles] = useState<Profile[]>([]);
  const isLiked = useMemo(() => likes.some(l => l.user_id === session?.user.id), [likes, session]);

  useEffect(() => {
    const fetchTopLikers = async () => {
      if (likes.length === 0) {
        setLikerProfiles([]);
        return;
      }
      const likerIds = likes.slice(0, 3).map(l => l.user_id);
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', likerIds);
      if (data) {
        // Garder l'ordre original des likes pour les avatars
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

  const handleDelete = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer cette publication ?")) {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (!error) window.location.reload();
    }
  };

  const getLikeText = () => {
    if (likes.length === 0) return "Aucun j'aime";
    const userLiked = isLiked;
    const count = likes.length;
    
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
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-soft overflow-hidden transition-all hover:shadow-premium group relative">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to={`/profile/${post.profiles.id}`}>
            <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" className="ring-4 ring-slate-50 transition-transform group-hover:scale-105" />
          </Link>
          <div>
            <Link to={`/profile/${post.profiles.id}`} className="block text-base font-extrabold text-slate-800 hover:text-isig-blue transition-colors">
                {post.profiles.full_name}
            </Link>
            <div className="flex items-center text-xs text-slate-400 font-medium uppercase tracking-wider">
                <span>{post.profiles.major}</span>
                <span className="mx-2 text-slate-300">|</span>
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
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-premium border border-slate-100 py-2 z-20">
                <button onClick={() => { setShowEditModal(true); setShowOptions(false); }} className="w-full flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <Pencil size={16} className="mr-3" /> Modifier
                </button>
                <button onClick={() => { handleDelete(); setShowOptions(false); }} className="w-full flex items-center px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50">
                  <Trash2 size={16} className="mr-3" /> Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 pb-4">
        <p className="text-[16px] text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
          {renderContentWithLinks(post.content)}
        </p>
      </div>

      {post.media_url && (
        <div className="px-5 pb-5">
           {post.media_type === 'image' ? (
             <div onClick={() => setShowImageModal(true)} className="rounded-[1.5rem] overflow-hidden cursor-pointer bg-slate-50 aspect-video relative group/media">
               <img src={post.media_url} alt="Post content" className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-110" />
               <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/10 transition-colors"></div>
             </div>
           ) : (
             <a href={post.media_url} target="_blank" className="flex items-center p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 transition-all transform hover:-translate-y-1">
                <div className="w-12 h-12 bg-isig-blue/10 rounded-2xl flex items-center justify-center text-isig-blue mr-4">
                   <FileText size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">Document attaché</p>
                    <p className="text-xs text-slate-500 font-medium">Consulter le fichier</p>
                </div>
             </a>
           )}
        </div>
      )}

      {likes.length > 0 && (
        <div className="px-6 pb-3 flex items-center">
          <button onClick={() => setShowLikersModal(true)} className="flex items-center group/likers">
             <div className="flex -space-x-2 mr-3">
               {likerProfiles.map(p => (
                 <Avatar key={p.id} avatarUrl={p.avatar_url} name={p.full_name} size="sm" className="ring-2 ring-white" />
               ))}
             </div>
             <span className="text-xs font-bold text-slate-500 group-hover/likers:text-isig-blue transition-colors">
               {getLikeText()}
             </span>
          </button>
        </div>
      )}

      <div className="px-5 py-4 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={handleLike} className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl transition-all ${isLiked ? 'text-isig-orange bg-isig-orange/5' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Heart size={22} fill={isLiked ? '#FF8C00' : 'none'} className={`${isLiked ? 'scale-110' : ''} transition-transform`} />
            <span className="text-sm font-bold">{likes.length}</span>
          </button>
          
          <button onClick={() => setShowPostDetailModal(true)} className="flex items-center space-x-2 px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-2xl transition-all">
            <MessageCircle size={22} />
            <span className="text-sm font-bold">{post.comments.length}</span>
          </button>
        </div>

        <button className="flex items-center space-x-2 px-4 py-2.5 text-slate-400 hover:text-isig-blue hover:bg-isig-blue/5 rounded-2xl transition-all">
            <Share2 size={22} />
        </button>
      </div>

      {showImageModal && <ImageModal post={post} onClose={() => setShowImageModal(false)} onOpenComments={() => setShowPostDetailModal(true)} />}
      {showPostDetailModal && <PostDetailModal post={post} onClose={() => setShowPostDetailModal(false)} />}
      {showLikersModal && <LikerListModal postId={post.id} postType="feed" onClose={() => setShowLikersModal(false)} />}
      {showEditModal && <EditPostModal post={post} onClose={() => setShowEditModal(false)} />}
    </div>
  );
};

export default PostCard;
