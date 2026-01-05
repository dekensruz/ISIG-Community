
import React from 'react';
import { useAuth } from '../App';
import { User, Settings, Shield, Bell, Info, ExternalLink, ChevronRight, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

const SettingsPage: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
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
            <SettingItem icon={<Shield size={20}/>} title="Mot de passe" subtitle="Sécuriser votre accès" onClick={() => alert('Fonctionnalité de changement de mot de passe à venir via mail de récupération.')} />
            <SettingItem icon={<Bell size={20}/>} title="Notifications" subtitle="Gérer les alertes push" to="/notifications" />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">À propos d'ISIG Community</h2>
        </div>
        <div className="divide-y divide-slate-50">
            <div className="p-8">
                <div className="flex items-center space-x-4 mb-6">
                    <img src="https://i.ibb.co/d0GY63vw/Logo-transparent.png" alt="ISIG Logo" className="w-16 h-16 drop-shadow-lg" />
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase italic">ISIG Community</h3>
                        <p className="text-xs font-bold text-isig-blue">Version 2.0.1 - Academic Network</p>
                    </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    ISIG Community est le réseau social académique exclusif de l'ISIG Goma. Conçu pour favoriser la collaboration, le partage de ressources et l'innovation technologique entre étudiants de toutes promotions.
                </p>
                <div className="mt-8 pt-8 border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Créateur de la plateforme</p>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100 group">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-2xl bg-isig-blue flex items-center justify-center text-white font-black text-xl shadow-lg shadow-isig-blue/20">DR</div>
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
            <SettingItem icon={<Info size={20}/>} title="Politique de confidentialité" subtitle="Vos données sont protégées" onClick={() => alert('Vos données sont stockées de manière sécurisée sur Supabase.')} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden mb-12">
        <SettingItem icon={<LogOut size={20}/>} title="Déconnexion" subtitle="Quitter votre session actuelle" onClick={handleSignOut} danger />
      </div>
    </div>
  );
};

export default SettingsPage;
