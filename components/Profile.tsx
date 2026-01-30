
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Profile as ProfileType, Post as PostType } from '../types';
import Spinner from './Spinner';
import Skeleton from './Skeleton';
import { Edit, Save, BookOpen, Star, Upload, Camera, Calendar, MessageCircle, UserPlus, UserCheck, X, Search, ChevronDown, UserRound, GraduationCap, School } from 'lucide-react';
import PostCard from './Post';
import CreatePost from './CreatePost';
import Avatar from './Avatar';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import UserListModal from './UserListModal';
import { PROMOTIONS } from './Auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ProfileSkeleton = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden">
            <Skeleton className="w-full h-48 sm:h-64 rounded-b-[3.5rem]" />
            <div className="px-4 sm:px-10">
                <div className="relative flex flex-col sm:flex-row items-center sm:items-start -mt-16 sm:-mt-20 mb-6 sm:space-x-8">
                    <Skeleton circle className="w-32 h-32 sm:w-40 sm:h-40 border-4 border-white dark:border-slate-900" />
                    <div className="mt-6 sm:mt-24 flex-grow text-center sm:text-left w-full">
                        <Skeleton className="h-8 w-48 mx-auto sm:mx-0 mb-2" />
                        <Skeleton className="h-4 w-32 mx-auto sm:mx-0" />
                    </div>
                </div>
                <div className="pb-8 border-b border-slate-50 dark:border-slate-800 flex gap-8 justify-center sm:justify-start">
                    <Skeleton className="h-10 w-16" />
                    <Skeleton className="h-10 w-16" />
                    <Skeleton className="h-10 w-16" />
                </div>
                <div className="py-8 space-y-2">
                    <Skeleton className="h-4 w-1/4 mb-4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                </div>
            </div>
        </div>
    </div>
);

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingPost, setEditingPost] = useState<PostType | null>(null);
  const [profileSearch, setProfileSearch] = useState('');
  const [formData, setFormData] = useState<Partial<ProfileType>>({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [skillsStr, setSkillsStr] = useState('');
  const [coursesStr, setCoursesStr] = useState('');
  
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [userListConfig, setUserListConfig] = useState<{ type: 'followers' | 'following', title: string } | null>(null);
  
  const editAreaRef = useRef<HTMLDivElement>(null);
  const isOwnProfile = session?.user.id === userId;
  const modalRoot = document.getElementById('modal-root');

  useEffect(() => {
    if (searchParams.get('edit') === 'true' && isOwnProfile) {
      setIsEditing(true);
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, isOwnProfile, setSearchParams]);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error("No user ID");
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      return data as ProfileType;
    },
    staleTime: 1000 * 60 * 5, 
  });

  const { data: posts, isLoading: loadingPosts } = useQuery({
    queryKey: ['profile-posts', userId],
    queryFn: async () => {
      const { data } = await supabase.from('posts').select(`*, profiles(*), comments(*, profiles(*)), likes(*)`).eq('user_id', userId).order('created_at', { ascending: false });
      return (data as PostType[]) || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: followStats } = useQuery({
    queryKey: ['follow-stats', userId],
    queryFn: async () => {
      const { count: followers } = await supabase.from('followers').select('*', { count: 'exact' }).eq('following_id', userId);
      const { count: following } = await supabase.from('followers').select('*', { count: 'exact' }).eq('follower_id', userId);
      
      let isFollowing = false;
      if (session?.user && !isOwnProfile) {
        const { data } = await supabase.from('followers').select('*').eq('follower_id', session.user.id).eq('following_id', userId).maybeSingle();
        isFollowing = !!data;
      }
      return { followers: followers || 0, following: following || 0, isFollowing };
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name,
        student_id: profile.student_id,
        major: profile.major,
        promotion: profile.promotion,
        gender: profile.gender,
        bio: profile.bio,
        cover_url: profile.cover_url,
        birth_date: profile.birth_date,
        show_birth_year: profile.show_birth_year,
      });
      setSkillsStr((profile.skills || []).join(', '));
      setCoursesStr((profile.courses || []).join(', '));
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<ProfileType>) => {
       const { error } = await supabase.from('profiles').upsert({ ...updates, id: userId, updated_at: new Date() });
       if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        setIsEditing(false);
    }
  });

  const handleUpdateProfile = () => {
    if (!isOwnProfile || !session?.user) return;
    updateProfileMutation.mutate({
        ...formData,
        skills: skillsStr.split(',').map(s => s.trim()).filter(Boolean),
        courses: coursesStr.split(',').map(s => s.trim()).filter(Boolean),
        birth_date: formData.birth_date === '' ? null : formData.birth_date,
    });
  };

  // ... (Upload handlers same as before) ...
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !isOwnProfile || !session?.user) return;
    const file = event.target.files[0];
    const fileName = `avatars/${userId}-${Date.now()}`;
    try {
        setAvatarUploading(true);
        const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId);
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (error: any) { alert(error.message); } finally { setAvatarUploading(false); }
  }

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !isOwnProfile || !session?.user) return;
    const file = event.target.files[0];
    const fileName = `covers/${userId}-${Date.now()}`;
    try {
      setCoverUploading(true);
      const { data, error } = await supabase.storage.from('covers').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('covers').getPublicUrl(data.path);
      await supabase.from('profiles').update({ cover_url: urlData.publicUrl }).eq('id', userId);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (error: any) { alert(error.message); } finally { setCoverUploading(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleFollowAction = async (action: 'follow' | 'unfollow') => {
    if (!session?.user) { navigate('/auth?mode=signup'); return; }
    if (isOwnProfile) return;
    queryClient.setQueryData(['follow-stats', userId], (old: any) => ({
        ...old,
        isFollowing: action === 'follow',
        followers: action === 'follow' ? old.followers + 1 : old.followers - 1
    }));
    if (action === 'follow') {
        await supabase.from('followers').insert({ follower_id: session.user.id, following_id: userId });
    } else {
        await supabase.from('followers').delete().match({ follower_id: session.user.id, following_id: userId });
    }
    queryClient.invalidateQueries({ queryKey: ['follow-stats', userId] });
  };

  const handleSendMessage = async () => {
    if (!session?.user) { navigate('/auth'); return; }
    if (!userId || isOwnProfile) return;
    const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user_id: userId });
    if (!error && data) navigate(`/chat/${data}`);
  };

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    if (!profileSearch.trim()) return posts;
    return posts.filter(p => p.content.toLowerCase().includes(profileSearch.toLowerCase()));
  }, [posts, profileSearch]);


  if (loadingProfile) return <ProfileSkeleton />;
  if (!profile) return <p className="text-center py-20 font-bold text-slate-400 dark:text-slate-600">Profil introuvable.</p>;
  
  const formattedBirthDate = profile.birth_date 
      ? format(parseISO(profile.birth_date), profile.show_birth_year ? 'd MMMM yyyy' : 'd MMMM', { locale: fr })
      : null;

  return (
    <>
    <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden group">
            {/* ... Cover Image (Same logic) ... */}
            <div className="relative">
                <div 
                    className={`w-full h-48 sm:h-64 md:h-72 bg-gradient-to-br from-isig-blue to-blue-600 relative rounded-b-[3.5rem] bg-cover bg-center transition-transform duration-700 ${profile.cover_url ? 'cursor-pointer' : ''}`}
                    style={{ backgroundImage: profile.cover_url ? `url(${profile.cover_url})` : undefined }}
                    onClick={() => profile.cover_url && setModalImage(profile.cover_url)}
                >
                    {isEditing && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-b-[3.5rem] opacity-0 group-hover:opacity-100 transition-opacity">
                            <label className="bg-white/90 text-slate-800 px-6 py-3 rounded-2xl flex items-center space-x-2 cursor-pointer hover:bg-white transition-all shadow-xl font-black text-sm uppercase tracking-widest">
                                {coverUploading ? <Spinner /> : <Camera size={20} className="text-isig-blue"/>}
                                <span>Changer la couverture</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading}/>
                            </label>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="px-4 sm:px-10">
                {/* ... Avatar & Name (Same logic, adapt dark mode classes) ... */}
                <div className="relative flex flex-col sm:flex-row items-center sm:items-start -mt-16 sm:-mt-20 mb-6 sm:space-x-8">
                    <div className="relative group/avatar shrink-0">
                        <button 
                            onClick={() => profile.avatar_url && setModalImage(profile.avatar_url)} 
                            disabled={!profile.avatar_url}
                            className="relative"
                        >
                           <Avatar avatarUrl={profile.avatar_url} name={profile.full_name} size="3xl" className="ring-[12px] ring-white dark:ring-slate-900 shadow-premium" />
                        </button>
                        {isOwnProfile && session?.user && (
                            <label className="absolute bottom-2 right-2 bg-isig-orange text-white p-3 rounded-2xl cursor-pointer hover:bg-orange-600 shadow-lg transition-all active:scale-90 flex items-center justify-center">
                                {avatarUploading ? <Spinner/> : <Upload size={20} />}
                                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading}/>
                            </label>
                        )}
                    </div>

                    <div className="mt-6 sm:mt-24 flex-grow text-center sm:text-left min-w-0">
                       {isEditing ? (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom complet</label>
                                <input type="text" name="full_name" value={formData.full_name || ''} onChange={handleInputChange} className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue transition-all" placeholder="Nom complet"/>
                            </div>
                        ) : (
                            <h1 className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">{profile.full_name}</h1>
                        )}
                        
                        {/* Static Info Display */}
                        {!isEditing && (
                            <div className="flex flex-wrap items-center justify-center sm:justify-start mt-1 gap-2">
                                <span className="text-lg text-isig-blue font-black uppercase tracking-widest text-xs sm:text-sm">{profile.major || 'Étudiant ISIG'}</span>
                                {profile.promotion && <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black px-2 py-1 rounded-lg">{profile.promotion}</span>}
                            </div>
                        )}
                        
                        {/* Edit Mode Inputs (Major, Promo, Gender) */}
                        {isEditing && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                                <input type="text" name="major" value={formData.major || ''} onChange={handleInputChange} placeholder="Ex: Génie Logiciel" className="text-sm font-bold p-3 bg-slate-50 dark:bg-slate-800 rounded-xl w-full"/>
                                <select name="promotion" value={formData.promotion || ''} onChange={handleInputChange} className="text-sm font-bold p-3 bg-slate-50 dark:bg-slate-800 rounded-xl w-full">
                                    <option value="" disabled>Promotion</option>
                                    {PROMOTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select name="gender" value={formData.gender || ''} onChange={handleInputChange} className="text-sm font-bold p-3 bg-slate-50 dark:bg-slate-800 rounded-xl w-full">
                                    <option value="" disabled>Genre</option>
                                    <option value="M">Homme</option>
                                    <option value="F">Femme</option>
                                </select>
                            </div>
                        )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex-shrink-0 flex items-center space-x-3 mt-6 sm:mt-24 w-full sm:w-auto">
                         {isOwnProfile && session?.user ? (
                             <button 
                                onClick={() => isEditing ? handleUpdateProfile() : setIsEditing(true)} 
                                className={`flex-1 sm:flex-none py-3 px-6 rounded-2xl flex items-center justify-center space-x-2 font-black text-xs sm:text-sm uppercase tracking-widest transition-all active:scale-95 border ${isEditing ? 'bg-isig-orange text-white border-transparent shadow-lg hover:bg-orange-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-700'}`}
                             >
                                {updateProfileMutation.isPending ? <Spinner /> : isEditing ? <><Save size={20} /><span>Sauver</span></> : <><Edit size={20} /><span>Éditer</span></>}
                            </button>
                        ) : (
                            <div className="flex-1 sm:flex-none flex items-center space-x-3">
                                <button onClick={handleSendMessage} className="flex-1 py-3 px-6 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl flex items-center justify-center space-x-2 font-black text-xs sm:text-sm uppercase tracking-widest transition-all">
                                    <MessageCircle size={20} className="text-isig-blue"/>
                                    <span>Chat</span>
                                </button>
                                {followStats?.isFollowing ? (
                                    <button onClick={() => handleFollowAction('unfollow')} className="flex-1 py-3 px-6 bg-isig-blue text-white rounded-2xl flex items-center justify-center space-x-2 font-black text-xs sm:text-sm uppercase tracking-widest transition-all">
                                        <UserCheck size={20} />
                                        <span>Abonné</span>
                                    </button>
                                ) : (
                                    <button onClick={() => handleFollowAction('follow')} className="flex-1 py-3 px-6 bg-isig-orange text-white rounded-2xl flex items-center justify-center space-x-2 font-black text-xs sm:text-sm uppercase tracking-widest transition-all">
                                        <UserPlus size={20} />
                                        <span>Suivre</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-center sm:justify-start space-x-8 pb-8 border-b border-slate-50 dark:border-slate-800">
                    <button onClick={() => setUserListConfig({ type: 'followers', title: 'Abonnés' })} className="text-center sm:text-left group/stat">
                        <span className="block text-xl font-black text-slate-800 dark:text-white">{followStats?.followers || 0}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abonnés</span>
                    </button>
                    <button onClick={() => setUserListConfig({ type: 'following', title: 'Abonnements' })} className="text-center sm:text-left group/stat">
                        <span className="block text-xl font-black text-slate-800 dark:text-white">{followStats?.following || 0}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abonnements</span>
                    </button>
                    <div className="text-center sm:text-left">
                        <span className="block text-xl font-black text-slate-800 dark:text-white">{posts?.length || 0}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posts</span>
                    </div>
                </div>

                {/* Bio */}
                <div className="py-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Biographie</h3>
                     <div className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                        {isEditing ? (
                            <textarea name="bio" value={formData.bio || ''} onChange={handleInputChange} placeholder="Votre bio..." className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl focus:ring-2 focus:ring-isig-blue dark:text-white"/>
                        ) : (
                            <p className="whitespace-pre-wrap">{profile.bio || "Pas encore de biographie."}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Skills & Courses Blocks */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black mb-4 flex items-center text-slate-800 dark:text-white uppercase tracking-tight"><Star className="text-isig-orange mr-3" size={24}/> Compétences</h3>
                {isEditing ? (
                    <input type="text" value={skillsStr} onChange={(e) => setSkillsStr(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white"/>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {(profile.skills && profile.skills.length > 0) ? profile.skills.map(skill => <span key={skill} className="bg-isig-blue/10 text-isig-blue px-4 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest">{skill}</span>) : <p className="text-slate-400 font-medium italic text-sm">Aucune compétence listée.</p>}
                    </div>
                )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black mb-4 flex items-center text-slate-800 dark:text-white uppercase tracking-tight"><BookOpen className="text-isig-blue mr-3" size={24}/> Points forts</h3>
                {isEditing ? (
                    <input type="text" value={coursesStr} onChange={(e) => setCoursesStr(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white"/>
                ) : (
                     <div className="flex flex-wrap gap-2">
                         {(profile.courses && profile.courses.length > 0) ? profile.courses.map(course => <span key={course} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest">{course}</span>) : <p className="text-slate-400 font-medium italic text-sm">Aucun point fort listé.</p>}
                    </div>
                )}
            </div>
        </div>

        {/* Posts Section */}
        <div className="mt-12" ref={editAreaRef}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight uppercase">Publications</h2>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Chercher..." 
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-isig-blue outline-none transition-all dark:text-white"
                    />
                </div>
            </div>

            {isOwnProfile && session?.user && editingPost && (
                <div className="mb-8">
                  <CreatePost 
                    onPostCreated={() => { 
                        queryClient.invalidateQueries({ queryKey: ['profile-posts', userId] }); 
                        setEditingPost(null); 
                    }} 
                    editingPost={editingPost}
                    onCancelEdit={() => setEditingPost(null)}
                  />
                </div>
            )}

            {loadingPosts ? (
                <div className="flex justify-center py-10"><Spinner /></div>
            ) : filteredPosts.length > 0 ? (
                <div className="space-y-8">
                    {filteredPosts.map(post => <PostCard key={post.id} post={post} onEditRequested={setEditingPost} />)}
                </div>
            ) : (
                <div className="text-center bg-white dark:bg-slate-900 p-16 rounded-[3rem] shadow-soft border border-slate-100 dark:border-slate-800">
                    <p className="text-slate-400 font-bold italic">Rien à voir ici pour le moment.</p>
                </div>
            )}
        </div>
    </div>

    {modalImage && modalRoot && createPortal(
        <div 
            className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center backdrop-blur-md" 
            onClick={() => setModalImage(null)}
        >
            <img src={modalImage} alt="Zoom" className="max-w-full max-h-full object-contain animate-fade-in"/>
            <button className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 p-3 rounded-full"><X size={32} /></button>
        </div>,
        modalRoot
    )}

    {userListConfig && (
        <UserListModal 
            userId={userId!} 
            type={userListConfig.type} 
            title={userListConfig.title} 
            onClose={() => setUserListConfig(null)} 
        />
    )}
    </>
  );
};

export default Profile;
