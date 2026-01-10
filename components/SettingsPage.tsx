
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { User, Shield, Bell, Info, ExternalLink, ChevronRight, LogOut, X, CheckCircle, AlertCircle, MessageSquareText, Lock, LayoutDashboard, ChevronDown, ChevronUp, Scale, Moon, Sun } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Spinner from './Spinner';

const SettingsPage: React.FC = () => {
  const { session, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [profile, setProfile] = useState<any>(null);
  const [isPassExpanded, setIsPassExpanded] = useState(false);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
            .then(({ data }) => setProfile(data));
    }
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
        setPasswordError("Les mots de passe ne correspondent pas.");
        return;
    }
    if (newPassword.length < 6) {
        setPasswordError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
    }

    setLoading(true);
    setPasswordError(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
        setPasswordError(error.message);
    } else {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
            setPasswordSuccess(false);
            setIsPassExpanded(false);
        }, 3000);
    }
  };

  const SettingItem: React.FC<{ icon: React.ReactNode, title: string, subtitle?: string, to?: string, onClick?: () => void, danger?: boolean, rightContent?: React.ReactNode }> = ({ icon, title, subtitle, to, onClick, danger, rightContent }) => {
    const content = (
      <div className={`flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all ${danger ? 'text-red-600' : 'text-slate-700 dark:text-slate-200'}`}>
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-2xl ${danger ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
            {icon}
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-tight">{title}</p>
            {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{subtitle}</p>}
          </div>
        </div>
        {rightContent || <ChevronRight size={18} className="text-slate-300 dark:text-slate-700" />}
      </div>
    );

    if (to) return <Link to={to} className="block">{content}</Link>;
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight italic uppercase">Paramètres</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Gérez votre compte et vos préférences.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Interface & Personnalisation</h2>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
            <SettingItem 
                icon={theme === 'dark' ? <Moon size={20}/> : <Sun size={20}/>} 
                title="Mode Sombre" 
                subtitle={theme === 'dark' ? 'Activé' : 'Désactivé'}
                onClick={toggleTheme}
                rightContent={
                    <div className={`w-12 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-isig-blue' : 'bg-slate-200 dark:bg-slate-800'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`}></div>
                    </div>
                }
            />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Compte & Sécurité</h2>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
            <SettingItem icon={<User size={20}/>} title="Éditer le profil" subtitle="Changer nom, bio et photos" to={`/profile/${session?.user.id}`} />
            
            <div className="bg-white dark:bg-slate-900">
                <button 
                    onClick={() => setIsPassExpanded(!isPassExpanded)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all text-slate-700 dark:text-slate-200"
                >
                    <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"><Shield size={20}/></div>
                        <div className="text-left">
                            <p className="font-black text-sm uppercase tracking-tight">Sécurité</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Changer de mot de passe</p>
                        </div>
                    </div>
                    {isPassExpanded ? <ChevronUp size={18} className="text-isig-blue" /> : <ChevronDown size={18} className="text-slate-300 dark:text-slate-700" />}
                </button>
                {isPassExpanded && (
                    <div className="px-5 pb-8 animate-fade-in">
                        <form onSubmit={handleChangePassword} className="space-y-4 bg-slate-50 dark:bg-slate-950/30 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                             {passwordError && <p className="text-red-500 text-xs font-bold flex items-center"><AlertCircle size={14} className="mr-2"/>{passwordError}</p>}
                             {passwordSuccess && <p className="text-emerald-500 text-xs font-bold flex items-center"><CheckCircle size={14} className="mr-2"/>Mis à jour avec succès !</p>}
                             <div>
                                <input 
                                    type="password" 
                                    placeholder="Nouveau mot de passe"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-isig-blue font-bold text-sm text-slate-800 dark:text-slate-100"
                                />
                             </div>
                             <div>
                                <input 
                                    type="password" 
                                    placeholder="Confirmer le mot de passe"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-isig-blue font-bold text-sm text-slate-800 dark:text-slate-100"
                                />
                             </div>
                             <button type="submit" disabled={loading} className="w-full py-4 bg-isig-blue text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest">
                                {loading ? <Spinner /> : "Mettre à jour"}
                             </button>
                        </form>
                    </div>
                )}
            </div>

            <SettingItem icon={<MessageSquareText size={20}/>} title="Feedback" subtitle="Signaler un bug ou proposer une idée" to="/feedback" />
            
            {profile?.role === 'admin' && (
                <SettingItem icon={<LayoutDashboard size={20}/>} title="Panel Admin" subtitle="Gérer les feedbacks et la plateforme" to="/admin/feedbacks" />
            )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">À propos & Charte</h2>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
            <div className="p-8">
                <div className="flex items-center space-x-4 mb-6">
                    <img src="https://i.ibb.co/gLJQF0rn/isig.jpg" alt="ISIG Logo" className="w-16 h-16 drop-shadow-lg" />
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase italic">ISIG Community</h3>
                    </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    ISIG Community est le réseau social académique exclusif de l'ISIG Goma.
                </p>
                <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Créateur</p>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/30 rounded-3xl border border-slate-100 dark:border-slate-800 group">
                        <div className="flex items-center space-x-4">
                            <img src="https://i.ibb.co/8nMGzv9X/527452060-602830646229470-3538579722418400104-n.jpg" alt="Dekens" className="w-12 h-12 rounded-2xl object-cover shadow-lg ring-2 ring-white dark:ring-slate-800"/>
                            <div>
                                <p className="font-black text-slate-800 dark:text-slate-200 text-sm">Dekens Ruzuba</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Software Engineer</p>
                            </div>
                        </div>
                        <a href="http://portfoliodek.netlify.app/" target="_blank" rel="noopener noreferrer" className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:text-isig-blue transition-all dark:text-slate-300"><ExternalLink size={20} /></a>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900">
                <button 
                    onClick={() => setIsRulesExpanded(!isRulesExpanded)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all text-slate-700 dark:text-slate-200"
                >
                    <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-isig-orange"><Scale size={20}/></div>
                        <div className="text-left">
                            <p className="font-black text-sm uppercase tracking-tight">Charte de Bonne Conduite</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Règles & Courtoisie</p>
                        </div>
                    </div>
                    {isRulesExpanded ? <ChevronUp size={18} className="text-isig-blue" /> : <ChevronDown size={18} className="text-slate-300 dark:text-slate-700" />}
                </button>
                {isRulesExpanded && (
                    <div className="px-8 pb-8 animate-fade-in">
                        <div className="bg-slate-50 dark:bg-slate-950/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                            <div className="flex items-start space-x-3">
                                <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    <strong className="text-slate-900 dark:text-slate-100">Respect mutuel :</strong> Soyez courtois et bienveillants. Les insultes et le harcèlement sont strictement interdits.
                                </p>
                            </div>
                            <div className="flex items-start space-x-3">
                                <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    <strong className="text-slate-900 dark:text-slate-100">Contenu académique :</strong> Privilégiez le partage de connaissances, de projets et d'entraide. Ne publiez pas de contenu inapproprié.
                                </p>
                            </div>
                            <div className="flex items-start space-x-3">
                                <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    <strong className="text-slate-900 dark:text-slate-100">Propriété intellectuelle :</strong> Respectez le travail de vos pairs. Citez vos sources lors du partage de ressources.
                                </p>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase text-center mt-4">
                                Tout manquement à ces règles peut entraîner une suspension de compte.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden mb-12">
        <SettingItem icon={<LogOut size={20}/>} title="Déconnexion" subtitle="Quitter votre session actuelle" onClick={handleSignOut} danger />
      </div>
    </div>
  );
};

export default SettingsPage;
