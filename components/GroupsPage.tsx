
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Group } from '../types';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import { Plus, Users, Lock, Search } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import Avatar from './Avatar';

const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');

  const fetchGroups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`*, profiles:created_by(*), group_members(*)`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setGroups(data as any);

    } catch (error: any) {
      console.error("Error fetching groups:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    
    // On écoute les changements sur les groupes ET sur les membres
    const channel = supabase
      .channel('groups_list_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
        fetchGroups();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
        fetchGroups();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchGroups]);

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase">Groupes</h1>
          <p className="text-slate-500 font-medium mt-1">Rejoignez des communautés d'apprentissage.</p>
        </div>
        
        <div className="flex items-center space-x-4">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Chercher un groupe..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-isig-blue outline-none w-full md:w-64 transition-all shadow-soft"
              />
           </div>
           <button
             onClick={() => setShowCreateModal(true)}
             className="bg-isig-blue text-white font-black py-3.5 px-6 rounded-2xl flex items-center space-x-2 hover:bg-blue-600 shadow-lg shadow-isig-blue/20 transition-all active:scale-95"
           >
             <Plus size={22} />
             <span className="hidden sm:inline">Créer</span>
           </button>
        </div>
      </div>
      
      {loading && groups.length === 0 ? (
        <div className="flex justify-center mt-20"><Spinner /></div>
      ) : (
        filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredGroups.map(group => (
              <Link to={`/group/${group.id}`} key={group.id} className="group bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-50 hover:shadow-premium hover:border-isig-blue/20 transition-all transform hover:-translate-y-2">
                <div className="flex items-start justify-between mb-6">
                    <Avatar avatarUrl={group.avatar_url} name={group.name} shape="square" size="xl" className="shadow-lg group-hover:scale-110 transition-transform duration-500" />
                    {group.is_private && <div className="p-2 bg-slate-100 rounded-xl text-slate-400"><Lock size={16} /></div>}
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight truncate">{group.name}</h2>
                    <p className="text-slate-500 text-sm font-medium mt-2 line-clamp-2 h-10 leading-relaxed">{group.description || 'Apprenez ensemble dans ce groupe.'}</p>
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-5">
                    <div className="flex items-center text-isig-blue font-black text-xs uppercase tracking-widest">
                        <Users size={16} className="mr-2" />
                        <span>{group.group_members?.length || 0} membre{group.group_members?.length > 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-300">#{group.profiles?.full_name?.split(' ')[0] || 'ISIG'}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center bg-white p-20 rounded-[3rem] shadow-soft border border-slate-100 mt-10">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users size={40} className="text-slate-200" />
            </div>
            <h3 className="text-2xl font-black text-slate-700">Aucun groupe trouvé</h3>
            <p className="text-slate-400 mt-2 font-medium">Lancez la tendance en créant le vôtre !</p>
          </div>
        )
      )}
      
      {showCreateModal && <CreateGroupModal onClose={() => { setShowCreateModal(false); fetchGroups(); }} />}
    </div>
  );
};

export default GroupsPage;
