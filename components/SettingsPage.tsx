
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { User, Shield, MessageSquareText, LayoutDashboard, ChevronDown, ChevronUp, Scale, LogOut, CheckCircle, AlertCircle, Info, ExternalLink, ChevronRight, Moon, Sun } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Spinner from './Spinner';
import { useTheme } from './ThemeProvider';

const SettingsPage: React.FC = () => {
  const { session } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
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

  useEffect(() => {
    if (searchParams.get('view') === 'password') {
        setIsPassExpanded(true);
        const element = document.getElementById('password-section');
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchParams]);

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

  const SettingItem: React.FC<{ icon: React.ReactNode, title: string, subtitle?: string, to?: string, onClick?: () => void, danger?: boolean }> = ({ icon, title, subtitle, to, onClick, danger }) => {
    const content = (
      <div className={`flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all ${danger ? 'text-red-600' : 'text-slate-700 dark:text-slate-200'}`}>
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-2xl ${danger ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
            {icon}
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-tight">{title}</p>
            {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-300" />
      </div>
    );

    if (to) return <Link to={to} className="block">{content}</Link>;
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up pb-20">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight italic uppercase">Paramètres</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Gérez votre compte et vos préférences.</p>
      </div>

      {/* Theme Toggler */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden p-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
              <div className="p-3 rounded-2xl bg-isig-blue/10 text-isig-blue">
                  {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              </div>
              <div>
                  <p className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-white">Apparence</p>
                  <p className="text-xs text-slate-400 font-medium">Basculez entre clair et sombre</p>
              </div>
          </div>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-isig-blue' : 'bg-slate-200'}`}
          >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Compte & Sécurité</h2>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
            <SettingItem icon={<User size={20}/>} title="Éditer le profil" subtitle="Changer nom, bio et photos" to={`/profile/${session?.user.id}`} />
            
            <div className="bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800" id="password-section">
                <button onClick={() => setIsPassExpanded(!isPassExpanded)} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-200">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"><Shield size={20}/></div>
                        <div className="text-left">
                            <p className="font-black text-sm uppercase tracking-tight">Sécurité</p>
                            <p className="text-xs text-slate-400 font-medium">Changer de mot de passe</p>
                        </div>
                    </div>
                    {isPassExpanded ? <ChevronUp size={18} className="text-isig-blue" /> : <ChevronDown size={18} className="text-slate-300" />}
                </button>
                {isPassExpanded && (
                    <div className="px-5 pb-8 animate-fade-in">
                        <form onSubmit={handleChangePassword} className="space-y-4 bg-slate-50 dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                             {passwordError && <p className="text-red-500 text-xs font-bold flex items-center"><AlertCircle size={14} className="mr-2"/>{passwordError}</p>}
                             {passwordSuccess && <p className="text-emerald-500 text-xs font-bold flex items-center"><CheckCircle size={14} className="mr-2"/>Mis à jour avec succès !</p>}
                             <input type="password" placeholder="Nouveau mot de passe" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-isig-blue font-bold text-sm dark:text-white" />
                             <input type="password" placeholder="Confirmer le mot de passe" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-isig-blue font-bold text-sm dark:text-white" />
                             <button type="submit" disabled={loading} className="w-full py-4 bg-isig-blue text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest">{loading ? <Spinner /> : "Mettre à jour"}</button>
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

      {/* --- Footer Links (Identical logic, update styles) --- */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden mb-12">
        <SettingItem icon={<LogOut size={20}/>} title="Déconnexion" subtitle="Quitter votre session actuelle" onClick={handleSignOut} danger />
      </div>
    </div>
  );
};

export default SettingsPage;
