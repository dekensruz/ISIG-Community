import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Group as GroupType, GroupPost as GroupPostType, GroupMember, GroupJoinRequest } from '../types';
import Spinner from './Spinner';
import GroupPostCard from './GroupPostCard';
import { Users, LogIn, LogOut, Edit, X, Clock, Check } from 'lucide-react';
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

  const fetchGroupData = useCallback(async () => {
    if (!groupId) return;
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

      const currentUserIsMember = memberData.some((m: any) => m.user_id === session?.user.id);
      setIsMember(currentUserIsMember);

      const currentUserIsAdmin = memberData.find(m => m.user_id === session?.user.id)?.role === 'admin';

      if (currentUserIsAdmin) {
        const { data: requestsData, error: requestsError } = await supabase
          .from('group_join_requests')
          .select('*, profiles(*)')
          .eq('group_id', groupId);
        if (requestsError) throw requestsError;
        setJoinRequests(requestsData as any);
      } else if (session?.user && !currentUserIsMember) {
        const { data: requestData, error: requestError } = await supabase
          .from('group_join_requests')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', session.user.id)
          .single();
        setUserRequestStatus(requestData ? 'pending' : 'none');
      }

    } catch (error: any) {
      console.error("Error fetching group data:", error.message);
      setGroup(null);
    } finally {
      setLoadingGroup(false);
    }
  }, [groupId, session?.user]);

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
    const groupUpdatesChannel = supabase.channel(`public:groups:${groupId}`);
    groupUpdatesChannel
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, () => fetchGroupData())
        .subscribe();
        
    return () => { supabase.removeChannel(groupUpdatesChannel) };
  }, [groupId, fetchGroupData]);
  
  const handleJoinAction = async () => {
    if (!session?.user || !groupId || !group || actionLoading) return;
    setActionLoading(true);

    if (isMember) { // Leave group
        const { error } = await supabase.from('group_members').delete().match({ group_id: groupId, user_id: session.user.id });
        if (!error) {
            setIsMember(false);
            fetchGroupData();
        }
    } else { // Join or request to join
        if (group.is_private) {
            if (userRequestStatus === 'none') {
                 const { error } = await supabase.from('group_join_requests').insert({ group_id: groupId, user_id: session.user.id });
                 if (!error) setUserRequestStatus('pending');
            }
        } else { // Public group, join directly
            const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: session.user.id, role: 'member' });
            if (!error) {
                setIsMember(true);
                fetchGroupData();
            }
        }
    }
    setActionLoading(false);
  };
  
  if (loadingGroup) {
    return <div className="flex justify-center mt-8"><Spinner /></div>;
  }

  if (!group) {
    return <div className="text-center mt-8 text-xl text-slate-600">Groupe introuvable.</div>;
  }
  
  const renderJoinButton = () => {
    if (isAdmin) {
        return <button className="flex items-center justify-center space-x-2 font-semibold py-2 px-4 rounded-lg bg-slate-200 text-slate-600 cursor-default" disabled><Check size={18}/><span>Admin</span></button>;
    }
    if (isMember) {
         return <button onClick={handleJoinAction} disabled={actionLoading} className="flex items-center justify-center space-x-2 font-semibold py-2 px-4 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"><LogOut size={18}/><span>Quitter</span></button>;
    }
    if (group.is_private) {
        if (userRequestStatus === 'pending') {
            return <button className="flex items-center justify-center space-x-2 font-semibold py-2 px-4 rounded-lg bg-slate-200 text-slate-600 cursor-default" disabled><Clock size={18}/><span>Demande envoyée</span></button>;
        } else {
            return <button onClick={handleJoinAction} disabled={actionLoading} className="flex items-center justify-center space-x-2 font-semibold py-2 px-4 rounded-lg bg-isig-blue text-white hover:bg-blue-600"><LogIn size={18}/><span>Demander à rejoindre</span></button>;
        }
    }
    // Public group and not a member
    return <button onClick={handleJoinAction} disabled={actionLoading} className="flex items-center justify-center space-x-2 font-semibold py-2 px-4 rounded-lg bg-isig-blue text-white hover:bg-blue-600"><LogIn size={18}/><span>Rejoindre</span></button>;
  };
  

  return (
    <>
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center space-x-4">
                     <button onClick={() => setShowAvatarModal(true)} className="flex-shrink-0 transition-transform duration-200 hover:scale-105">
                         <Avatar 
                            avatarUrl={group.avatar_url} 
                            name={group.name}
                            size="2xl" 
                            shape="square"
                         />
                     </button>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{group.name}</h1>
                      <p className="text-sm text-slate-500 mt-1">Créé par <Link to={`/profile/${group.created_by}`} className="font-semibold hover:underline">{group.profiles.full_name}</Link></p>
                    </div>
                </div>
                 <div className="flex items-center space-x-2 self-start sm:self-center flex-shrink-0">
                    {isAdmin && (
                         <button 
                            onClick={() => setShowEditModal(true)} 
                            className="flex items-center space-x-2 font-semibold py-2 px-4 rounded-lg transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                            <Edit size={18}/>
                            <span>Modifier</span>
                        </button>
                    )}
                    {renderJoinButton()}
                </div>
            </div>
             <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mt-4 pt-4 border-t border-slate-100">
                <p className="text-slate-600 flex-1">{group.description}</p>
                <button onClick={() => setShowMembersModal(true)} className="relative flex items-center space-x-3 text-left p-2 rounded-lg hover:bg-slate-100 self-start md:self-end">
                    {isAdmin && joinRequests.length > 0 && 
                        <span className="absolute -top-1 -right-1 flex h-5 w-5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-isig-orange opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-isig-orange text-white text-xs items-center justify-center">{joinRequests.length}</span>
                        </span>
                    }
                    <div className="flex -space-x-3">
                        {members.slice(0, 3).map(member => (
                           <Avatar key={member.user_id} avatarUrl={member.profiles.avatar_url} name={member.profiles.full_name} size="sm" className="ring-2 ring-white" />
                        ))}
                    </div>
                    <div className="text-sm">
                        <p className="font-semibold text-slate-700">{members.length} Membre{members.length > 1 ? 's' : ''}</p>
                        {isAdmin ? (
                            <p className="text-isig-blue font-semibold">Gérer</p>
                        ) : (
                            <p className="text-slate-500">Voir tout</p>
                        )}
                    </div>
                </button>
             </div>
        </div>
      </div>
      
        <div className="space-y-6">
            {isMember || !group.is_private ? (
                <>
                    {isMember && <CreateGroupPost groupId={groupId!} onPostCreated={fetchPosts} />}
                    {loadingPosts ? (
                        <div className="flex justify-center"><Spinner /></div>
                    ) : posts.length > 0 ? (
                        posts.map(post => <GroupPostCard key={post.id} post={post} startWithModalOpen={post.id === openModalPostId} />)
                    ) : (
                        <div className="bg-white text-center p-8 rounded-xl shadow-sm border border-slate-200">
                            <p className="text-slate-500">Aucune publication dans ce groupe pour le moment.</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="bg-white text-center p-8 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-700">Ceci est un groupe privé</h3>
                    <p className="text-slate-600 mt-2">Demandez à rejoindre le groupe pour voir les publications et participer.</p>
                </div>
            )}
        </div>
    </div>
    
    {showEditModal && (
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
            isAdmin={isAdmin}
            onClose={() => setShowMembersModal(false)}
            onMembersUpdate={fetchGroupData}
        />
    )}

    {showAvatarModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowAvatarModal(false)}>
            <img src={group.avatar_url || `https://placehold.co/150x150/00AEEF/FFFFFF?text=${group.name.charAt(0)}`} alt={group.name} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"/>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300">
                <X size={32} />
            </button>
        </div>
    )}
    </>
  );
};

export default GroupPage;