
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Feedback } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LayoutDashboard, MessageSquareText, ChevronLeft } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../App';

const AdminFeedbacksPage: React.FC = () => {
  const { session } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
        if (!session?.user) return;
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        setIsAdmin(data?.role === 'admin');
    };
    checkAdmin();
  }, [session]);

  useEffect(() => {
    if (isAdmin) {
        fetchFeedbacks();
    }
  }, [isAdmin]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    // Correction de la requête : utiliser la clé étrangère explicite vers profiles
    const { data, error } = await supabase
        .from('feedbacks')
        .select(`
            id,
            content,
            created_at,
            user_id,
            profiles:user_id (*)
        `)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Erreur chargement feedbacks:", error);
    } else {
        setFeedbacks(data as any);
    }
    setLoading(false);
  };

  if (isAdmin === false) return <Navigate to="/" />;
  if (isAdmin === null || loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
        <div className="flex items-center justify-between mb-8">
            <Link to="/settings" className="p-3 bg-white rounded-2xl shadow-sm hover:bg-slate-50 transition-all text-slate-400">
                <ChevronLeft size={24} />
            </Link>
            <div className="text-right">
                <h1 className="text-3xl font-black text-slate-800 italic uppercase tracking-tight">Panel Admin</h1>
                <p className="text-slate-500 font-medium">Gestion des retours utilisateurs</p>
            </div>
        </div>

        <div className="space-y-6">
            {feedbacks.length > 0 ? feedbacks.map((f, index) => (
                <div key={f.id} className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-100 animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <Avatar avatarUrl={f.profiles?.avatar_url} name={f.profiles?.full_name || 'Étudiant'} size="md" />
                            <div>
                                <p className="font-extrabold text-slate-800 text-sm">{f.profiles?.full_name || 'Utilisateur inconnu'}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: fr })}</p>
                            </div>
                        </div>
                        <div className="p-2 bg-isig-orange/10 text-isig-orange rounded-xl"><MessageSquareText size={18}/></div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-slate-700 font-medium leading-relaxed italic">"{f.content}"</p>
                    </div>
                </div>
            )) : (
                <div className="text-center py-24 bg-white rounded-[3rem] border border-slate-100 shadow-soft">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquareText size={32} className="text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Aucun feedback dans la base de données.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default AdminFeedbacksPage;
