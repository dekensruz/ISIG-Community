
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Group as GroupType, GroupPost as GroupPostType, GroupMember, GroupJoinRequest } from '../types';
import Spinner from './Spinner';
import GroupPostCard from './GroupPostCard';
import { Users, LogIn, LogOut, Edit, X, Clock, Crown } from 'lucide-react';
import CreateGroupPost from './CreateGroupPost';
import EditGroupModal from './EditGroupModal';
import Avatar from './Avatar';
import GroupMembersModal from './GroupMembersModal';

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
  
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  const isOwner = session?.user.id === group?.created_by;
  const isAdmin = members.find(m => m.user_id === session?.user.id)?.role === 'admin';
  const canManageGroup = isOwner || isAdmin;

  const fetchGroupData = useCallback(async () => {
    if (!groupId || !session?.user) return;
    setLoadingGroup(true);
    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`*, profiles:created_by(*)`)
        .eq('id', groupId)
        .single();
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
    const { data } = await supabase.from('group_posts').select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`).eq('id', groupId).order('created_at', { ascending: false });
    // This table selection above has a bug: we want posts for the group, not the post with id=groupId
    const { data: correctData } = await supabase.from('group_posts').select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`).eq('group_id', groupId).order('created_at', { ascending: false });
    if (correctData) setPosts(correctData as any);
    setLoadingPosts(false);
  }, [groupId]);

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
  useEffect(() => { if (isMember || (group && !group.is_private)) fetchPosts(); }, [isMember, group, fetchPosts]);

  const handleJoinAction = async () => {
    if (!session?.user || !groupId || !group || actionLoading) return;
    setActionLoading(true);
    if (isMember) {
        await supabase.from('group_members').delete().match({ group_id: groupId, user_id: session.user.id });
        setIsMember(false);
    } else {
        if (group.is_private) {
            await supabase.from('group_join_requests').insert({ group_id: groupId, user_id: session.user.id });
            setUserRequestStatus('pending');
        } else {
            await supabase.from('group_members').insert({ group_id: groupId, user_id: session.user.id, role: 'member' });
            setIsMember(true);
        }
    }
    fetchGroupData();
    setActionLoading(false);
  };
  
  if (loadingGroup) return <div className="flex justify-center mt-8"><Spinner /></div>;
  if (!group) return <div className="text-center mt-8 text-xl text-slate-600 font-black uppercase italic">Groupe introuvable</div>;

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden mb-6">
        <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center space-x-4 min-w-0 flex-1 overflow-hidden">
                     <button onClick={() => setShowAvatarModal(true)} className="flex-shrink-0">
                         <Avatar avatarUrl={group.avatar_url} name={group.name} size="2xl" shape="square" />
                     </button>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h1 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight break-words leading-tight uppercase italic">{group.name}</h1>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest truncate">Créé par {group.profiles?.full_name}</p>
                    </div>
                </div>
                 <div className="flex items-center space-x-2 self-start sm:self-center shrink-0">
                    {canManageGroup && (
                         <button onClick={() => setShowEditModal(true)} className="p-2.5 rounded-2xl bg-slate-50 text-slate-600 hover:bg-slate-100"><Edit size={20}/></button>
                    )}
                    {isOwner ? (
                         <div className="bg-isig-orange/10 text-isig-orange px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center"><Crown size={14} className="mr-2"/>Admin</div>
                    ) : isMember ? (
                         <button onClick={handleJoinAction} disabled={actionLoading} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center"><LogOut size={14} className="mr-2"/>Quitter</button>
                    ) : (
                         <button onClick={handleJoinAction} disabled={actionLoading} className="bg-isig-blue text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-isig-blue/20">{userRequestStatus === 'pending' ? 'Attente' : 'Rejoindre'}</button>
                    )}
                </div>
            </div>
             <p className="mt-4 text-slate-600 text-sm font-medium italic break-words leading-relaxed border-t border-slate-50 pt-4">{group.description || 'Pas de description.'}</p>
             <button onClick={() => setShowMembersModal(true)} className="mt-4 flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-isig-blue">
                 <Users size={16} /> <span>{members.length} membres • Gérer</span>
             </button>
        </div>
      </div>
      
      <div className="space-y-6 pb-20">
          {(isMember || !group.is_private) ? (
              <>
                  {isMember && <CreateGroupPost groupId={groupId!} onPostCreated={handlePostCreated} />}
                  {loadingPosts ? <div className="flex justify-center py-10"><Spinner /></div> : 
                    posts.map(p => <GroupPostCard key={p.id} post={p} startWithModalOpen={p.id === openModalPostId} />)}
              </>
          ) : (
              <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100 shadow-soft">
                  <h3 className="font-black text-slate-700 uppercase italic">Groupe privé</h3>
                  <p className="text-slate-400 text-sm mt-2">Rejoignez ce groupe pour voir les discussions.</p>
              </div>
          )}
      </div>

      {showEditModal && <EditGroupModal group={group} onClose={() => setShowEditModal(false)} onGroupUpdated={fetchGroupData} onGroupDeleted={() => navigate('/groups')} />}
      {showMembersModal && <GroupMembersModal group={group} initialMembers={members} initialRequests={joinRequests} isAdmin={canManageGroup} onClose={() => setShowMembersModal(false)} onMembersUpdate={fetchGroupData} />}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-brand-dark/95 z-[200] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowAvatarModal(false)}>
            <img src={group.avatar_url || ''} className="max-w-full max-h-[80vh] rounded-3xl shadow-2xl animate-fade-in-up" alt="Avatar"/>
        </div>
      )}
    </div>
  );
};

export default GroupPage;
