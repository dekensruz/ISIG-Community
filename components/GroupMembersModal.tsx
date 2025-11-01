import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Group, GroupMember, GroupJoinRequest } from '../types';
import { X, Shield, UserX, Check, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import Spinner from './Spinner';

interface GroupMembersModalProps {
  group: Group;
  initialMembers: GroupMember[];
  initialRequests: GroupJoinRequest[];
  isAdmin: boolean;
  onClose: () => void;
  onMembersUpdate: () => void;
}

const GroupMembersModal: React.FC<GroupMembersModalProps> = ({ group, initialMembers, initialRequests, isAdmin, onClose, onMembersUpdate }) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [members, setMembers] = useState(initialMembers);
  const [requests, setRequests] = useState(initialRequests);
  const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members');
  
  useEffect(() => {
    setMembers(initialMembers);
    setRequests(initialRequests);
  }, [initialMembers, initialRequests]);


  const handleRoleChange = async (member: GroupMember, newRole: 'admin' | 'member') => {
    if (!isAdmin || member.user_id === group.created_by) return;
    setLoadingAction(member.user_id);
    const { error } = await supabase
        .from('group_members')
        .update({ role: newRole })
        .match({ group_id: group.id, user_id: member.user_id });
    
    if (error) alert("Erreur lors du changement de rôle: " + error.message);
    else onMembersUpdate();
    
    setLoadingAction(null);
  };

  const handleRemoveMember = async (member: GroupMember) => {
    if (!isAdmin || member.user_id === group.created_by) return;
    if (window.confirm(`Voulez-vous vraiment retirer ${member.profiles.full_name} du groupe ?`)) {
      setLoadingAction(member.user_id);
      const { error } = await supabase
          .from('group_members')
          .delete()
          .match({ group_id: group.id, user_id: member.user_id });

      if (error) alert("Erreur lors de la suppression du membre: " + error.message);
      else onMembersUpdate();

      setLoadingAction(null);
    }
  };
  
  const handleApproveRequest = async (request: GroupJoinRequest) => {
    setLoadingAction(request.user_id);
    // 1. Add user to members
    const { error: insertError } = await supabase.from('group_members').insert({
        group_id: request.group_id,
        user_id: request.user_id,
        role: 'member'
    });
    
    if(insertError) {
        alert("Erreur lors de l'ajout du membre: " + insertError.message);
        setLoadingAction(null);
        return;
    }
    
    // 2. Delete the request
    const { error: deleteError } = await supabase.from('group_join_requests').delete().eq('id', request.id);
    if(deleteError) console.error("Could not delete request, but user was added:", deleteError);

    onMembersUpdate(); // Refresh parent state
    setLoadingAction(null);
  };

  const handleRejectRequest = async (request: GroupJoinRequest) => {
    setLoadingAction(request.user_id);
    const { error } = await supabase.from('group_join_requests').delete().eq('id', request.id);
    if(error) alert("Erreur lors du rejet de la demande: " + error.message);
    
    onMembersUpdate(); // Refresh parent state
    setLoadingAction(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-isig-blue">Gérer le groupe</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </div>
        
        {isAdmin && (
            <div className="flex border-b mb-4">
                <button onClick={() => setActiveTab('members')} className={`px-4 py-2 font-semibold text-sm ${activeTab === 'members' ? 'border-b-2 border-isig-blue text-isig-blue' : 'text-slate-500'}`}>Membres ({members.length})</button>
                <button onClick={() => setActiveTab('requests')} className={`relative px-4 py-2 font-semibold text-sm ${activeTab === 'requests' ? 'border-b-2 border-isig-blue text-isig-blue' : 'text-slate-500'}`}>
                    Demandes
                    {requests.length > 0 && <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-isig-orange rounded-full">{requests.length}</span>}
                </button>
            </div>
        )}

        <div className="flex-grow overflow-y-auto pr-2">
            {activeTab === 'members' ? (
                <ul className="space-y-3">
                    {members.map(member => (
                        <li key={member.user_id} className="flex items-center justify-between hover:bg-slate-50 p-2 rounded-lg">
                            <Link to={`/profile/${member.user_id}`} onClick={onClose} className="flex items-center space-x-3 flex-grow min-w-0">
                                <Avatar avatarUrl={member.profiles.avatar_url} name={member.profiles.full_name} />
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-700 truncate">{member.profiles.full_name}</p>
                                    <p className="text-sm text-slate-500">
                                        {member.user_id === group.created_by ? 'Créateur' : member.role === 'admin' ? 'Admin' : 'Membre'}
                                    </p>
                                </div>
                            </Link>
                            {isAdmin && group.created_by !== member.user_id && (
                                <div className="flex items-center space-x-1 flex-shrink-0">
                                    {loadingAction === member.user_id ? <Spinner /> : (
                                        <>
                                            <button 
                                                onClick={() => handleRoleChange(member, member.role === 'admin' ? 'member' : 'admin')} 
                                                className="p-2 rounded-full text-slate-500 hover:bg-blue-100 hover:text-isig-blue"
                                                title={member.role === 'admin' ? "Rétrograder en membre" : "Promouvoir en admin"}
                                            >
                                                <Shield size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleRemoveMember(member)} 
                                                className="p-2 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600"
                                                title="Retirer du groupe"
                                            >
                                                <UserX size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                 <ul className="space-y-3">
                    {requests.length > 0 ? requests.map(request => (
                        <li key={request.id} className="flex items-center justify-between hover:bg-slate-50 p-2 rounded-lg">
                             <Link to={`/profile/${request.user_id}`} onClick={onClose} className="flex items-center space-x-3 flex-grow min-w-0">
                                <Avatar avatarUrl={request.profiles.avatar_url} name={request.profiles.full_name} />
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-700 truncate">{request.profiles.full_name}</p>
                                </div>
                            </Link>
                             <div className="flex items-center space-x-1 flex-shrink-0">
                                {loadingAction === request.user_id ? <Spinner /> : (
                                    <>
                                        <button onClick={() => handleApproveRequest(request)} className="p-2 rounded-full text-slate-500 hover:bg-green-100 hover:text-green-600" title="Approuver"><Check size={20}/></button>
                                        <button onClick={() => handleRejectRequest(request)} className="p-2 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600" title="Rejeter"><X size={20}/></button>
                                    </>
                                )}
                            </div>
                        </li>
                    )) : (
                        <div className="text-center p-6 text-slate-500">
                            <UserPlus size={32} className="mx-auto text-slate-300 mb-2"/>
                            <p>Aucune demande en attente.</p>
                        </div>
                    )}
                 </ul>
            )}
        </div>
      </div>
    </div>
  );
};

export default GroupMembersModal;