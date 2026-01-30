
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Group as GroupType, GroupPost as GroupPostType, GroupMember, GroupJoinRequest } from '../types';
import Spinner from './Spinner';
import Skeleton from './Skeleton';
import GroupPostCard from './GroupPostCard';
import { Users, LogIn, LogOut, Edit, X, Clock, Crown, TrendingUp } from 'lucide-react';
import CreateGroupPost from './CreateGroupPost';
import EditGroupModal from './EditGroupModal';
import Avatar from './Avatar';
import GroupMembersModal from './GroupMembersModal';

const GroupHeaderSkeleton = () => (
    <div className="max-w-4xl mx-auto px-4 mt-8">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
                <Skeleton className="w-24 h-24 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-full mt-4" />
                </div>
            </div>
        </div>
    </div>
);

const GroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const openModalPostId = searchParams.get('openModal') === 'true' ? searchParams.get('postId') : null;
  
  const [group, setGroup] = useState<GroupType | null>(null);
  const [posts, setPosts] = useState<GroupPostType[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [userRequestStatus, setUserRequestStatus] = useState<'none' | 'pending'>('none');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  const isOwner = session?.user.id === group?.created_by;
  const isAdmin = members.find(m => m.user_id === session?.user.id)?.role === 'admin';
  const canManageGroup = isOwner || isAdmin;
  const modalRoot = document.getElementById('modal-root');

  const fetchGroupData = useCallback(async () => {
    if (!groupId || !session?.user) return;
    setLoadingGroup(true);
    try {
      const { data: groupData, error: groupError } = await supabase.from('groups').select(`*, profiles:created_by(*)`).eq('id', groupId).single();
      if (groupError) throw groupError;
      setGroup(groupData as any);

      const { data: memberData } = await supabase.from('group_members').select(`*, profiles(*)`).eq('group_id', groupId);
      if (memberData) {
        setMembers(memberData as any);
        setIsMember(memberData.some((m: any) => m.user_id === session.user.id));
      }

      if (isAdmin || isOwner) {
        const { data: requestsData } = await supabase.from('group_join_requests').select('*, profiles(*)').eq('group_id', groupId);
        setJoinRequests(requestsData as any || []);
      }

      if (!isMember) {
        const { data } = await supabase.from('group_join_requests').select('id').eq('group_id', groupId).eq('user_id', session.user.id).maybeSingle();
        setUserRequestStatus(data ? 'pending' : 'none');
      }
    } catch (err) { console.error(err); } finally { setLoadingGroup(false); }
  }, [groupId, session?.user, isAdmin, isOwner, isMember]);

  const fetchPosts = useCallback(async (isInitial = true) => {
    if (!groupId) return;
    if (isInitial) setLoadingPosts(true);
    
    let query = supabase.from('group_posts').select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`).eq('group_id', groupId);
    if (sortBy === 'popular') {
      query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: correctData } = await query;
    if (correctData) setPosts(correctData as any);
    setLoadingPosts(false);
  }, [groupId, sortBy]);

  const handlePostCreated = (newPost?: GroupPostType) => {
      if (newPost) {
          setPosts(prev => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
          });
      } else {
          fetchPosts(true);
      }
  };
  
  useEffect(() => { fetchGroupData(); }, [fetchGroupData]);
  
  useEffect(() => { 
    if (isMember || (group && !group.is_private)) {
      fetchPosts(); 
    }
  }, [isMember, group, sortBy, fetchPosts]);

  const handleJoinAction = async () => {
    if (!session?.user || !groupId || !group || actionLoading) return;
    setActionLoading(true);
    try {
        if (isMember) {
            const { error } = await supabase.from('group_members').delete().match({ group_id: groupId, user_id: session.user.id });
            if (!error) {
                setIsMember(false);
                setMembers(prev => prev.filter(m => m.user_id !== session.user.id));
            }
        } else {
            if (group.is_private) {
                const { error } = await supabase.from('group_join_requests').insert({ group_id: groupId, user_id: session.user.id });
                if (!error) setUserRequestStatus('pending');
            } else {
                const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: session.user.id, role: 'member' });
                if (!error) {
                    setIsMember(true);
                    fetchGroupData(); 
                }
            }
        }
    } catch (err) { console.error(err); } finally { setActionLoading(false); }
  };
  
  if (loadingGroup) return <GroupHeaderSkeleton />;
  if (!group) return <div className="text-center mt-8 text-xl text-slate-600 dark:text-slate-400 font-black uppercase italic">Groupe introuvable</div>;

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden mb-6">
        <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center space-x-4 min-w-0 flex-1 overflow-hidden">
                     <button onClick={() => setShowAvatarModal(true)} className="flex-shrink-0">
                         <Avatar avatarUrl={group.avatar_url} name={group.name} size="2xl" shape="square" />
                     </button>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h1 className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight break-words leading-tight uppercase italic">{group.name}</h1>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest truncate">Créé par {group.profiles?.full_name}</p>
                    </div>
                </div>
                 <div className="flex items-center space-x-2 self-start sm:self-center shrink-0">
                    {canManageGroup && (
                         <button onClick={() => setShowEditModal(true)} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"><Edit size={20}/></button>
                    )}
                    {isOwner ? (
                         <div className="bg-isig-orange/10 text-isig-orange px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center"><Crown size={14} className="mr-2"/>Admin</div>
                    ) : isMember ? (
                         <button onClick={handleJoinAction} disabled={actionLoading} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center">
                             {actionLoading ? <Spinner /> : <><LogOut size={14} className="mr-2"/>Quitter</>}
                         </button>
                    ) : (
                         <button onClick={handleJoinAction} disabled={actionLoading} className="bg-isig-blue text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-isig-blue/20">
                             {actionLoading ? <Spinner /> : userRequestStatus === 'pending' ? 'Attente' : 'Rejoindre'}
                         </button>
                    )}
                </div>
            </div>
             <p className="mt-4 text-slate-600 dark:text-slate-300 text-sm font-medium italic break-words leading-relaxed border-t border-slate-50 dark:border-slate-800 pt-4">{group.description || 'Pas de description.'}</p>
             <button onClick={() => setShowMembersModal(true)} className="mt-4 flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-isig-blue">
                 <Users size={16} /> <span>{members.length} membres • Gérer</span>
             </button>
        </div>
      </div>
      
      <div className="space-y-6 pb-20">
          {(isMember || !group.is_private) ? (
              <>
                  <div className="flex p-1.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl w-fit animate-fade-in-up">
                      <button onClick={() => setSortBy('recent')} className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'recent' ? 'bg-white dark:bg-slate-700 text-isig-blue shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                          <Clock size={14} /> <span>Récent</span>
                      </button>
                      <button onClick={() => setSortBy('popular')} className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'popular' ? 'bg-white dark:bg-slate-700 text-isig-orange shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                          <TrendingUp size={14} /> <span>Populaire</span>
                      </button>
                  </div>

                  {isMember && <CreateGroupPost groupId={groupId!} onPostCreated={handlePostCreated} />}
                  {loadingPosts ? <div className="flex justify-center py-10"><Spinner /></div> : 
                    posts.map(p => <GroupPostCard key={p.id} post={p} startWithModalOpen={p.id === openModalPostId} />)}
                  {!loadingPosts && posts.length === 0 && (
                      <div className="text-center py-12 text-slate-400 font-medium italic">Aucune publication dans ce groupe.</div>
                  )}
              </>
          ) : (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-[2.5rem] text-center border border-slate-100 dark:border-slate-800 shadow-soft">
                  <h3 className="font-black text-slate-700 dark:text-slate-300 uppercase italic">Groupe privé</h3>
                  <p className="text-slate-400 text-sm mt-2">Rejoignez ce groupe pour voir les discussions.</p>
              </div>
          )}
      </div>

      {showEditModal && <EditGroupModal group={group} onClose={() => setShowEditModal(false)} onGroupUpdated={fetchGroupData} onGroupDeleted={() => navigate('/groups')} />}
      {showMembersModal && <GroupMembersModal group={group} initialMembers={members} initialRequests={joinRequests} isAdmin={canManageGroup} onClose={() => setShowMembersModal(false)} onMembersUpdate={fetchGroupData} />}
      
      {showAvatarModal && modalRoot && createPortal(
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center backdrop-blur-md" onClick={() => setShowAvatarModal(false)}>
            <img src={group.avatar_url || ''} className="max-w-full max-h-full object-contain animate-fade-in" alt="Avatar"/>
            <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 p-3 rounded-full"><X size={32} /></button>
        </div>,
        modalRoot
      )}
    </div>
  );
};

export default GroupPage;
