
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Post } from '../types';
import { X, Save } from 'lucide-react';
import Spinner from './Spinner';

interface EditPostModalProps {
  post: Post;
  onClose: () => void;
}

const EditPostModal: React.FC<EditPostModalProps> = ({ post, onClose }) => {
  const [content, setContent] = useState(post.content);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('posts').update({ content }).eq('id', post.id);
    setLoading(false);
    if (!error) {
      window.location.reload();
    } else {
      alert("Erreur lors de la mise à jour");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Modifier la publication</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24} /></button>
        </div>
        <form onSubmit={handleUpdate} className="space-y-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-6 min-h-[150px] outline-none focus:ring-2 focus:ring-isig-blue text-slate-700 font-medium transition-all resize-none"
            placeholder="Écrivez quelque chose..."
          />
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">Annuler</button>
            <button type="submit" disabled={loading} className="flex-[2] bg-isig-blue text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center">
              {loading ? <Spinner /> : <><Save size={20} className="mr-2" /> Enregistrer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPostModal;
