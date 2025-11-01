import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Group, GroupMember } from '../types';
import { X, Shield, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import Spinner from './Spinner';

interface GroupMembersModalProps {
  group: Group;
  members: GroupMember[];
  isOwner: boolean;
  onClose: () => void;
  onMembersUpdate: () => void;
}

const GroupMembersModal: React.FC<GroupMembersModalProps> = ({ group, members, isOwner, onClose, onMembersUpdate }) => {
  const { session } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleRoleChange = async (member: GroupMember, newRole: 'admin' | 'member') => {
    if (!isOwner || member.user_id === group.created_by) return;
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
    if (!isOwner || member.user_id === group.created_by) return;
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


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold text-isig-blue">Membres ({members.length})</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </div>
        <div className="flex-grow overflow-y-auto pr-2">
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
                        {isOwner && session?.user.id !== member.user_id && (
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
        </div>
      </div>
    </div>
  );
};

export default GroupMembersModal;