import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { UserPlus, UserCheck } from 'lucide-react';
import { useAuth } from '../App';

const UsersPage: React.FC = () => {
  const { session } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Map<string, boolean>>(new Map());

  const fetchUsersAndFollowing = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', session.user.id) // Exclude self
        .order('full_name', { ascending: true });
        
      if (usersError) throw usersError;
      setUsers(usersData || []);

      const { data: followingData, error: followingError } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', session.user.id);
      
      if (followingError) throw followingError;
      
      const newFollowingMap = new Map<string, boolean>();
      followingData.forEach(item => newFollowingMap.set(item.following_id, true));
      setFollowingMap(newFollowingMap);

    } catch (error: any) {
      console.error("Error fetching users:", error.message);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    fetchUsersAndFollowing();
  }, [fetchUsersAndFollowing]);
  
  const handleToggleFollow = async (targetUserId: string) => {
    if (!session?.user) return;

    const isCurrentlyFollowing = followingMap.get(targetUserId);
    
    // Optimistic update
    const newMap = new Map(followingMap);
    newMap.set(targetUserId, !isCurrentlyFollowing);
    setFollowingMap(newMap);

    if (isCurrentlyFollowing) {
        // Unfollow
        const { error } = await supabase.from('followers').delete().match({ follower_id: session.user.id, following_id: targetUserId });
        if (error) { // Revert on error
            newMap.set(targetUserId, true);
            setFollowingMap(new Map(newMap));
        }
    } else {
        // Follow
        const { error } = await supabase.from('followers').insert({ follower_id: session.user.id, following_id: targetUserId });
        if (error) { // Revert on error
            newMap.set(targetUserId, false);
            setFollowingMap(new Map(newMap));
        }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Membres de la Communauté</h1>
      
      {loading ? (
        <div className="flex justify-center mt-8"><Spinner /></div>
      ) : (
        users.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(user => {
                const isFollowing = followingMap.get(user.id);
                return (
                    <div key={user.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
                        <Avatar avatarUrl={user.avatar_url} name={user.full_name} size="2xl" />
                        <h2 className="text-lg font-bold text-slate-800 mt-4">{user.full_name}</h2>
                        <p className="text-sm text-isig-blue font-medium">{user.major || 'Filière non spécifiée'}</p>
                        <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full">
                            <Link to={`/profile/${user.id}`} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 transition-colors">
                                Voir Profil
                            </Link>
                            <button
                                onClick={() => handleToggleFollow(user.id)}
                                className={`flex-1 flex items-center justify-center space-x-2 font-semibold py-2 px-4 rounded-lg transition-colors ${isFollowing ? 'bg-isig-blue text-white hover:bg-blue-700' : 'bg-isig-orange text-white hover:bg-orange-600'}`}
                            >
                                {isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
                                <span>{isFollowing ? 'Abonné' : 'Suivre'}</span>
                            </button>
                        </div>
                    </div>
                );
            })}
          </div>
        ) : (
          <div className="text-center bg-white p-8 rounded-lg shadow-md mt-6">
            <h3 className="text-2xl font-semibold text-gray-700">Aucun autre membre trouvé.</h3>
            <p className="text-gray-500 mt-2">Invitez vos amis à rejoindre la communauté !</p>
          </div>
        )
      )}
    </div>
  );
};

export default UsersPage;
