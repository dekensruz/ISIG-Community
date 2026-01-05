
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { X, Send, CheckCircle, MessageSquareText } from 'lucide-react';
import Spinner from './Spinner';

interface FeedbackModalProps {
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !session?.user) return;

    setLoading(true);
    const { error } = await supabase.from('feedbacks').insert({
        user_id: session.user.id,
        content: content.trim()
    });
    setLoading(false);

    if (!error) {
        setSuccess(true);
        setTimeout(onClose, 2500);
    } else {
        alert("Erreur lors de l'envoi : " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[110] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3 text-isig-orange">
                    <MessageSquareText size={24} />
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">Feedback</h2>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-all"><X size={24} /></button>
            </div>

            {success ? (
                <div className="text-center py-10 animate-fade-in">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} className="text-emerald-500" />
                    </div>
                    <p className="text-lg font-black text-slate-800">Merci !</p>
                    <p className="text-slate-500 font-medium">Votre message a été envoyé à l'équipe.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Une suggestion ? Un bug à signaler ? Dites-nous tout pour améliorer la communauté.
                    </p>
                    <textarea 
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Écrivez votre message ici..."
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-2 focus:ring-isig-orange outline-none font-medium text-slate-700 h-40 resize-none transition-all"
                        required
                    />
                    <button 
                        type="submit"
                        disabled={loading || !content.trim()}
                        className="w-full py-4 bg-isig-orange text-white font-black rounded-2xl shadow-lg shadow-isig-orange/20 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs flex items-center justify-center"
                    >
                        {loading ? <Spinner /> : <><Send size={16} className="mr-2"/> Envoyer</>}
                    </button>
                </form>
            )}
        </div>
    </div>
  );
};

export default FeedbackModal;
