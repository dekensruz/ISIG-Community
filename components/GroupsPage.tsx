import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Group } from '../types';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import { Plus, Users } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import Avatar from './Avatar';

const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchGroups();
    
    const groupsSubscription = supabase
      .channel('public:groups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
        fetchGroups();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(groupsSubscription);
    };
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          profiles:created_by(*),
          group_members(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase error fetching groups:", error);
        throw error;
      }
      if (data) setGroups(data as any);

    } catch (error: any) {
      console.error("Error fetching groups:", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Groupes de la Communauté</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-isig-blue text-white font-semibold py-2 px-4 rounded-lg flex items-center space-x-2 hover:bg-blue-600 transition-colors"
        >
          <Plus size={20} />
          <span>Créer un groupe</span>
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center mt-8"><Spinner /></div>
      ) : (
        groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map(group => (
              <Link to={`/group/${group.id}`} key={group.id} className="block bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-isig-blue transition-all">
                <div className="flex items-center space-x-4 mb-3">
                    <Avatar avatarUrl={group.avatar_url} name={group.name} shape="square" size="xl" />
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{group.name}</h2>
                        <p className="text-sm text-slate-500 flex items-center"><Users size={14} className="mr-1" /> {group.group_members.length} membres</p>
                    </div>
                </div>
                <p className="text-slate-600 text-sm line-clamp-2">{group.description || 'Aucune description.'}</p>
                <p className="text-xs text-slate-400 mt-3">Créé par {group.profiles.full_name}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center bg-white p-8 rounded-lg shadow-md mt-6">
            <h3 className="text-2xl font-semibold text-gray-700">Aucun groupe pour le moment.</h3>
            <p className="text-gray-500 mt-2">Soyez le premier à créer un groupe pour un projet, une classe ou un centre d'intérêt !</p>
          </div>
        )
      )}
      
      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};

export default GroupsPage;