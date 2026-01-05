
import React, { useState } from 'react';
import { useAuth } from '../App';
import { User, Settings, Shield, Bell, Info, ExternalLink, ChevronRight, LogOut, X, Lock, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Spinner from './Spinner';

const SettingsPage: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  
  // States pour les modaux
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // States pour le changement de mot de passe
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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
        setTimeout(() => {
            setShowPasswordModal(false);
            setPasswordSuccess(false);
            setNewPassword('');
            setConfirmPassword('');
        }, 2000);
    }
  };

  const SettingItem: React.FC<{ icon: React.ReactNode, title: string, subtitle?: string, to?: string, onClick?: () => void, danger?: boolean }> = ({ icon, title, subtitle, to, onClick, danger }) => {
    const content = (
      <div className={`flex items-center justify-between p-5 hover:bg-slate-50 transition-all ${danger ? 'text-red-600' : 'text-slate-700'}`}>
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-2xl ${danger ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
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
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase">Paramètres</h1>
        <p className="text-slate-500 font-medium mt-1">Gérez votre compte et vos préférences.</p>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Compte & Sécurité</h2>
        </div>
        <div className="divide-y divide-slate-50">
            <SettingItem icon={<User size={20}/>} title="Éditer le profil" subtitle="Changer nom, bio et photos" to={`/profile/${session?.user.id}`} />
            <SettingItem icon={<Shield size={20}/>} title="Mot de passe" subtitle="Modifier votre mot de passe" onClick={() => setShowPasswordModal(true)} />
            <SettingItem icon={<Bell size={20}/>} title="Notifications" subtitle="Gérer les alertes push" to="/notifications" />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">À propos</h2>
        </div>
        <div className="divide-y divide-slate-50">
            <div className="p-8">
                <div className="flex items-center space-x-4 mb-6">
                    <img src="https://i.ibb.co/d0GY63vw/Logo-transparent.png" alt="ISIG Logo" className="w-16 h-16 drop-shadow-lg" />
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase italic">ISIG Community</h3>
                    </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    ISIG Community est le réseau social académique exclusif de l'ISIG Goma. Conçu pour favoriser la collaboration, le partage de ressources et l'innovation technologique entre étudiants de toutes promotions.
                </p>
                <div className="mt-8 pt-8 border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Créateur de la plateforme</p>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100 group">
                        <div className="flex items-center space-x-4">
                            <img 
                                src="https://i.ibb.co/8nMGzv9X/527452060-602830646229470-3538579722418400104-n.jpg" 
                                alt="Dekens Ruzuba" 
                                className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-isig-blue/20"
                            />
                            <div>
                                <p className="font-black text-slate-800 text-sm">Dekens Ruzuba</p>
                                <p className="text-[10px] font-bold text-slate-400">Software Engineer & Designer</p>
                            </div>
                        </div>
                        <a href="http://portfoliodek.netlify.app/" target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-xl shadow-sm hover:text-isig-blue hover:shadow-md transition-all">
                            <ExternalLink size={20} />
                        </a>
                    </div>
                </div>
            </div>
            <SettingItem icon={<Info size={20}/>} title="Politique de confidentialité" subtitle="Vos données sont protégées" onClick={() => setShowPrivacyModal(true)} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden mb-12">
        <SettingItem icon={<LogOut size={20}/>} title="Déconnexion" subtitle="Quitter votre session actuelle" onClick={handleSignOut} danger />
      </div>

      {/* Modal Politique de Confidentialité */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">Confidentialité</h2>
                    <button onClick={() => setShowPrivacyModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                    <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
                    <p className="text-slate-700 font-bold leading-relaxed">
                        Vos données sont sauvegardées de manière sécurisée.
                    </p>
                </div>
                <button 
                    onClick={() => setShowPrivacyModal(false)}
                    className="w-full mt-6 py-4 bg-isig-blue text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest text-xs"
                >
                    Fermer
                </button>
            </div>
        </div>
      )}

      {/* Modal Changement de Mot de Passe */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight italic text-isig-blue">Mot de passe</h2>
                    <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                </div>
                
                {passwordSuccess ? (
                    <div className="text-center py-6">
                        <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4" />
                        <p className="text-lg font-black text-slate-800">Mise à jour réussie !</p>
                    </div>
                ) : (
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        {passwordError && <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-100">{passwordError}</p>}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Nouveau mot de passe</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none font-bold text-sm"
                                placeholder="Min. 6 caractères"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Confirmer</label>
                            <input 
                                type="password" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none font-bold text-sm"
                                placeholder="Confirmez"
                                required
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 py-4 bg-isig-blue text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center"
                        >
                            {loading ? <Spinner /> : "Mettre à jour"}
                        </button>
                    </form>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
