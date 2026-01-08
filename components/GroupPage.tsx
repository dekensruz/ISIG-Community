
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Group as GroupType, GroupPost as GroupPostType, GroupMember, GroupJoinRequest } from '../types';
import Spinner from './Spinner';
import GroupPostCard from './GroupPostCard';
import { Users, LogIn, LogOut, Edit, X, Clock, Check, Crown } from 'lucide-react';
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

      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select(`*, profiles(*)`)
        .eq('group_id', groupId);
        
      if (memberError) throw memberError;
      setMembers(memberData as any);

      const currentUserIsMember = memberData.some((m: any) => m.user_id === session.user.id);
      setIsMember(currentUserIsMember);

      if (isAdmin || isOwner) {
        const { data: requestsData } = await supabase
          .from('group_join_requests')
          .select('*, profiles(*)')
          .eq('group_id', groupId);
        setJoinRequests(requestsData as any || []);
      }

      if (!currentUserIsMember) {
        const { data: requestData } = await supabase
          .from('group_join_requests')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', session.user.id)
          .maybeSingle();
        setUserRequestStatus(requestData ? 'pending' : 'none');
      }

    } catch (error: any) {
      console.error("Error fetching group data:", error.message);
    } finally {
      setLoadingGroup(false);
    }
  }, [groupId, session?.user, isAdmin, isOwner]);

  const fetchPosts = useCallback(async () => {
    if (!groupId) return;
    setLoadingPosts(true);
    try {
      const { data, error } = await supabase
        .from('group_posts')
        .select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPosts(data as any);
    } catch (error: any) {
      console.error("Error fetching group posts:", error.message);
    } finally {
      setLoadingPosts(false);
    }
  }, [groupId]);
  
  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  useEffect(() => {
      if (isMember || (group && !group.is_private)) {
          fetchPosts();
      }
  }, [isMember, group, fetchPosts]);

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-posts-${groupId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'group_posts',
        filter: `group_id=eq.${groupId}`
      }, async (payload) => {
        const { data } = await supabase
          .from('group_posts')
          .select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setPosts(prev => {
            if (prev.some(p => p.id === data.id)) return prev;
            return [data as any, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_posts' }, (payload) => {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_posts' }, async (payload) => {
        const { data } = await supabase
          .from('group_posts')
          .select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setPosts(prev => prev.map(p => p.id === data.id ? data as any : p));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const handlePostCreated = (newPost?: GroupPostType) => {
      if (newPost) {
          setPosts(prev => {
            if (prev.some(p => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
      } else {
          fetchPosts();
      }
  };

  const handleJoinAction = async () => {
    if (!session?.user || !groupId || !group || actionLoading || isOwner) return;
    setActionLoading(true);

    if (isMember) {
        const { error } = await supabase.from('group_members').delete().match({ group_id: groupId, user_id: session.user.id });
        if (!error) {
            setIsMember(false);
            fetchGroupData();
        }
    } else {
        if (group.is_private) {
            if (userRequestStatus === 'none') {
                 const { error } = await supabase.from('group_join_requests').insert({ group_id: groupId, user_id: session.user.id });
                 if (!error) setUserRequestStatus('pending');
            }
        } else {
            const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: session.user.id, role: 'member' });
            if (!error) {
                setIsMember(true);
                fetchGroupData();
            }
        }
    }
    setActionLoading(false);
  };
  
  if (loadingGroup) return <div className="flex justify-center mt-8"><Spinner /></div>;
  if (!group) return <div className="text-center mt-8 text-xl text-slate-600">Groupe introuvable.</div>;

  return (
    <>
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden mb-6">
        <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                     <button onClick={() => setShowAvatarModal(true)} className="flex-shrink-0 transition-transform duration-200 hover:scale-105">
                         <Avatar avatarUrl={group.avatar_url} name={group.name} size="2xl" shape="square" />
                     </button>
                    <div className="min-w-0 flex-1">
                      {/* Correction du débordement ici avec break-words et truncate controlé */}
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight break-words leading-tight">{group.name}</h1>
                      <p className="text-xs text-slate-500 mt-1 uppercase font-black tracking-widest truncate">Par <Link to={`/profile/${group.created_by}`} className="text-isig-blue hover:underline">{group.profiles?.full_name || 'Chargement...'}</Link></p>
                    </div>
                </div>
                 <div className="flex items-center space-x-2 self-start sm:self-center flex-shrink-0">
                    {canManageGroup && (
                         <button onClick={() => setShowEditModal(true)} className="flex items-center space-x-2 font-black py-2 px-6 rounded-2xl transition-all bg-slate-50 text-slate-600 hover:bg-slate-100 uppercase tracking-widest text-[10px]">
                            <Edit size={18}/><span>Modifier</span>
                        </button>
                    )}
                    {isOwner ? (
                         <button className="flex items-center justify-center space-x-2 font-black py-2 px-6 rounded-2xl bg-isig-orange/10 text-isig-orange uppercase tracking-widest text-[10px] cursor-default"><Crown size={18}/><span>Créateur</span></button>
                    ) : isMember ? (
                         <button onClick={handleJoinAction} disabled={actionLoading} className="flex items-center justify-center space-x-2 font-black py-2 px-6 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 uppercase tracking-widest text-[10px]"><LogOut size={18}/><span>Quitter</span></button>
                    ) : userRequestStatus === 'pending' ? (
                         <button className="flex items-center justify-center space-x-2 font-black py-2 px-6 rounded-2xl bg-slate-100 text-slate-500 uppercase tracking-widest text-[10px] cursor-default" disabled><Clock size={18}/><span>En attente</span></button>
                    ) : (
                         <button onClick={handleJoinAction} disabled={actionLoading} className="flex items-center justify-center space-x-2 font-black py-2 px-6 rounded-2xl bg-isig-blue text-white hover:bg-blue-600 shadow-lg shadow-isig-blue/20 uppercase tracking-widest text-[10px]"><LogIn size={18}/><span>Rejoindre</span></button>
                    )}
                </div>
            </div>
             <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mt-4 pt-4 border-t border-slate-50">
                <p className="text-slate-600 flex-1 font-medium italic break-words">{group.description || 'Bienvenue dans ce groupe académique.'}</p>
                <button onClick={() => setShowMembersModal(true)} className="relative flex items-center space-x-3 text-left p-3 rounded-2xl hover:bg-slate-50 self-start md:self-end transition-all">
                    {canManageGroup && joinRequests.length > 0 && 
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 z-10">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-isig-orange opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-isig-orange text-white text-[10px] font-black items-center justify-center border-2 border-white">{joinRequests.length}</span>
                        </span>
                    }
                    <div className="flex -space-x-3">
                        {members.slice(0, 3).map(member => (
                           <Avatar key={member.user_id} avatarUrl={member.profiles?.avatar_url} name={member.profiles?.full_name || '...'} size="sm" className="ring-2 ring-white" />
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest">
                        <p className="text-slate-700">{members.length} Membre{members.length > 1 ? 's' : ''}</p>
                        <p className="text-isig-blue">Gérer • Voir</p>
                    </div>
                </button>
             </div>
        </div>
      </div>
      
        <div className="space-y-6 pb-12">
            {isMember || !group.is_private ? (
                <>
                    {isMember && <CreateGroupPost groupId={groupId!} onPostCreated={handlePostCreated} />}
                    {loadingPosts && posts.length === 0 ? (
                        <div className="flex justify-center py-10"><Spinner /></div>
                    ) : posts.length > 0 ? (
                        posts.map(post => <GroupPostCard key={post.id} post={post} startWithModalOpen={post.id === openModalPostId} />)
                    ) : (
                        <div className="bg-white text-center p-12 rounded-[2rem] shadow-soft border border-slate-100">
                            <p className="text-slate-400 font-bold italic">Aucune publication dans ce groupe pour le moment.</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="bg-white text-center p-16 rounded-[2.5rem] shadow-soft border border-slate-100">
                    <h3 className="text-xl font-black text-slate-700 italic uppercase">Groupe privé</h3>
                    <p className="text-slate-500 mt-2 font-medium">Rejoignez le groupe pour voir et participer aux discussions.</p>
                </div>
            )}
        </div>
    </div>
    
    {showEditModal && canManageGroup && (
        <EditGroupModal 
            group={group}
            onClose={() => setShowEditModal(false)}
            onGroupUpdated={fetchGroupData}
            onGroupDeleted={() => navigate('/groups')}
        />
    )}

    {showMembersModal && (
        <GroupMembersModal
            group={group}
            initialMembers={members}
            initialRequests={joinRequests}
            isAdmin={canManageGroup}
            onClose={() => setShowMembersModal(false)}
            onMembersUpdate={fetchGroupData}
        />
    )}

    {showAvatarModal && (
        <div className="fixed inset-0 bg-brand-dark/95 z-50 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowAvatarModal(false)}>
            <img src={group.avatar_url || `https://placehold.co/150x150/00AEEF/FFFFFF?text=${group.name.charAt(0)}`} alt={group.name} className="max-w-[90vw] max-h-[90vh] object-contain rounded-3xl shadow-2xl"/>
            <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-all bg-white/10 p-3 rounded-full">
                <X size={32} />
            </button>
        </div>
    )}
    </>
  );
};

export default GroupPage;
