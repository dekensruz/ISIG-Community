
import React, { useState, useEffect, useMemo } from 'react';
import { GroupPost, Profile, GroupPostLike, GroupPostComment } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Heart, MessageCircle, Share2, FileText, Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import GroupImageModal from './GroupImageModal';
import GroupPostDetailModal from './GroupPostDetailModal';
import LikerListModal from './LikerListModal';
import EditGroupPostModal from './EditGroupPostModal';

interface GroupPostCardProps {
  post: GroupPost;
  startWithModalOpen?: boolean;
}

const GroupPostCard: React.FC<GroupPostCardProps> = ({ post, startWithModalOpen = false }) => {
  const { session } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPostDetailModal, setShowPostDetailModal] = useState(startWithModalOpen);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const [likes, setLikes] = useState<GroupPostLike[]>(post.group_post_likes);
  const [comments, setComments] = useState<GroupPostComment[]>(post.group_post_comments);
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
        await supabase.from('group_post_likes').delete().match({ group_post_id: post.id, user_id: session.user.id });
      }
    } else {
      const tempLike = { id: Math.random().toString(), group_post_id: post.id, user_id: session.user.id };
      setLikes(prev => [tempLike as any, ...prev]);
      await supabase.from('group_post_likes').insert({ group_post_id: post.id, user_id: session.user.id });
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer cette publication du groupe ?")) {
      const { error } = await supabase.from('group_posts').delete().eq('id', post.id);
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
    <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 transition-all hover:shadow-premium group relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Link to={`/profile/${post.profiles.id}`}>
            <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" className="mr-4" />
          </Link>
          <div>
            <Link to={`/profile/${post.profiles.id}`} className="font-extrabold text-slate-800 hover:text-isig-blue transition-colors">{post.profiles.full_name}</Link>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</p>
          </div>
        </div>

        {session?.user.id === post.user_id && (
          <div className="relative">
            <button onClick={() => setShowOptions(!showOptions)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl">
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

      <p className="text-slate-700 whitespace-pre-wrap mb-4 font-medium leading-relaxed">{renderContentWithLinks(post.content)}</p>

      {post.media_url && (
        <div className="mb-4">
          {post.media_type?.startsWith('image/') ? (
            <button onClick={() => setShowImageModal(true)} className="w-full h-auto cursor-pointer focus:outline-none rounded-[1.5rem] overflow-hidden group/media">
                <img src={post.media_url} alt="Média" className="max-h-[500px] w-full object-cover transition-transform duration-700 group-hover/media:scale-110" />
            </button>
          ) : (
            <a href={post.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 transition-all">
              <div className="w-10 h-10 bg-isig-blue/10 rounded-xl flex items-center justify-center text-isig-blue mr-3">
                <FileText size={20} />
              </div>
              <span className="text-slate-800 font-bold text-sm">Consulter le document</span>
            </a>
          )}
        </div>
      )}
      
      {likes.length > 0 && (
        <div className="pb-3 flex items-center">
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

      <div className="flex justify-between items-center text-slate-500 border-t border-slate-50 pt-4">
        <div className="flex items-center space-x-2 sm:space-x-6">
          <button onClick={handleLike} className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-2xl transition-all ${isLiked ? 'text-isig-orange bg-isig-orange/5' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Heart size={20} fill={isLiked ? '#FF8C00' : 'none'} className={isLiked ? 'scale-110' : ''} />
            <span className="text-sm font-bold">{likes.length}</span>
          </button>
          
          <button onClick={() => setShowPostDetailModal(true)} className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-2xl transition-all">
            <MessageCircle size={20} />
            <span className="text-sm font-bold">{comments.length}</span>
          </button>
        </div>
        
        <button onClick={() => {
           navigator.clipboard.writeText(`${window.location.origin}/#/group/${post.group_id}`);
           setCopied(true);
           setTimeout(() => setCopied(false), 2000);
        }} className="p-2.5 text-slate-400 hover:text-isig-blue hover:bg-isig-blue/5 rounded-2xl transition-all relative flex-shrink-0">
           <Share2 size={20} />
           {copied && <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-slate-800 text-white text-[10px] rounded-lg font-bold shadow-xl">Lien copié</span>}
        </button>
      </div>

      {showImageModal && <GroupImageModal post={post} onClose={() => setShowImageModal(false)} onOpenComments={() => setShowPostDetailModal(true)} />}
      {showPostDetailModal && <GroupPostDetailModal postInitial={post} onClose={() => setShowPostDetailModal(false)} />}
      {showLikersModal && <LikerListModal postId={post.id} postType="group" onClose={() => setShowLikersModal(false)} />}
      {showEditModal && <EditGroupPostModal post={post} onClose={() => setShowEditModal(false)} />}
    </div>
  );
};

export default GroupPostCard;
