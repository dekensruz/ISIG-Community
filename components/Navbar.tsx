
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth, useSearchFilter } from '../App';
import { Link, useNavigate } from 'react-router-dom';
import { Profile } from '../types';
import { User, LogOut, Search, Bell, LayoutGrid } from 'lucide-react';
import Avatar from './Avatar';

const Navbar: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const { searchQuery, setSearchQuery } = useSearchFilter();

  useEffect(() => {
    if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
            .then(({ data }) => setProfile(data));
        
        supabase.from('notifications').select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id).eq('is_read', false)
            .then(({ count }) => setUnreadNotificationsCount(count || 0));
    }
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <nav className="glass fixed top-0 w-full z-40 border-b border-slate-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          
          <div className="flex items-center space-x-4 flex-1">
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
              <img src="https://i.ibb.co/d0GY63vw/Logo-transparent.png" alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-sm" />
              <span className="hidden sm:block text-xl font-black tracking-tighter text-brand-dark uppercase">
                ISIG<span className="text-isig-blue">.</span>
              </span>
            </Link>

            <div className="hidden md:block relative max-w-xs w-full ml-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher sur ISIG..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-100/70 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-isig-blue transition-all"
              />
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-3">
            <Link to="/groups" className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl transition-all" title="Groupes">
              <LayoutGrid size={22} />
            </Link>

            <Link to="/notifications" className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
              <Bell size={22} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-2 right-2 flex h-4 w-4">
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-isig-orange text-[10px] font-bold text-white items-center justify-center border-2 border-white">
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </span>
                </span>
              )}
            </Link>

            {profile && (
               <div className="relative flex items-center pl-3 border-l border-slate-200 ml-2">
                  <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center space-x-2 group">
                    <Avatar avatarUrl={profile.avatar_url} name={profile.full_name} size="md" className="ring-2 ring-transparent group-hover:ring-isig-blue/30 transition-all" />
                    <span className="hidden sm:block text-sm font-black text-slate-800">{profile.full_name.split(' ')[0]}</span>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-3 w-56 bg-white rounded-3xl shadow-premium border border-slate-100 py-2 overflow-hidden animate-fade-in">
                        <Link to={`/profile/${profile.id}`} onClick={() => setDropdownOpen(false)} className="flex items-center px-4 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            <User size={18} className="mr-3 text-slate-400" /> Profil
                        </Link>
                        <div className="border-t border-slate-100 my-1 mx-2"></div>
                        <button onClick={handleSignOut} className="w-full flex items-center px-4 py-3.5 text-sm font-bold text-red-500 hover:bg-red-50 text-left">
                            <LogOut size={18} className="mr-3" /> Déconnexion
                        </button>
                    </div>
                  )}
               </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;
