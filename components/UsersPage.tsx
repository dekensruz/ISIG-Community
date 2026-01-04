
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { UserPlus, UserCheck, Search } from 'lucide-react';
import { useAuth } from '../App';

const UsersPage: React.FC = () => {
  const { session } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [followingMap, setFollowingMap] = useState<Map<string, boolean>>(new Map());

  const fetchUsersAndFollowing = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', session.user.id)
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
    const newMap = new Map(followingMap);
    newMap.set(targetUserId, !isCurrentlyFollowing);
    setFollowingMap(newMap);

    if (isCurrentlyFollowing) {
        await supabase.from('followers').delete().match({ follower_id: session.user.id, following_id: targetUserId });
    } else {
        await supabase.from('followers').insert({ follower_id: session.user.id, following_id: targetUserId });
    }
  };

  const filteredUsers = users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase">Membres</h1>
          <p className="text-slate-500 font-medium mt-1">Découvrez et collaborez avec vos pairs.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un étudiant..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-isig-blue outline-none transition-all shadow-soft"
          />
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center mt-20"><Spinner /></div>
      ) : (
        filteredUsers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredUsers.map(user => {
                const isFollowing = followingMap.get(user.id);
                const majorPromotion = [user.promotion, user.major].filter(Boolean).join(' ');
                return (
                    <div key={user.id} className="group bg-white p-6 rounded-[2rem] shadow-soft border border-slate-50 flex flex-col items-center text-center transition-all hover:shadow-premium hover:-translate-y-2">
                        <Link to={`/profile/${user.id}`} className="relative">
                            <Avatar avatarUrl={user.avatar_url} name={user.full_name} size="3xl" className="ring-8 ring-slate-50 group-hover:ring-isig-blue/5 transition-all duration-500" />
                        </Link>
                        <h2 className="text-lg font-black text-slate-800 mt-6 tracking-tight line-clamp-1">{user.full_name}</h2>
                        <p className="text-xs text-isig-blue font-black uppercase tracking-widest mt-1 line-clamp-1">{majorPromotion || 'Étudiant ISIG'}</p>
                        
                        <div className="mt-8 flex flex-col gap-2 w-full">
                            <Link to={`/profile/${user.id}`} className="w-full py-3 px-4 bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all active:scale-95">
                                Profil
                            </Link>
                            <button
                                onClick={() => handleToggleFollow(user.id)}
                                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${isFollowing ? 'bg-isig-blue text-white' : 'bg-isig-orange/10 text-isig-orange hover:bg-isig-orange/20'}`}
                            >
                                {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                                <span>{isFollowing ? 'Abonné' : 'Suivre'}</span>
                            </button>
                        </div>
                    </div>
                );
            })}
          </div>
        ) : (
          <div className="text-center bg-white p-20 rounded-[3rem] shadow-soft border border-slate-100 mt-10">
            <h3 className="text-2xl font-black text-slate-700">Aucun membre trouvé</h3>
            <p className="text-slate-400 mt-2 font-medium">Invitez vos collègues à rejoindre l'aventure !</p>
          </div>
        )
      )}
    </div>
  );
};

export default UsersPage;
