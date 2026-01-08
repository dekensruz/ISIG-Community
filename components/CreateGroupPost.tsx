
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Paperclip, X, FileText, Send, AlertCircle, ImageIcon } from 'lucide-react';
import { GroupPost } from '../types';
import Spinner from './Spinner';

interface CreateGroupPostProps {
  groupId: string;
  onPostCreated: (newPost?: GroupPost) => void;
}

const CreateGroupPost: React.FC<CreateGroupPostProps> = ({ groupId, onPostCreated }) => {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Nettoyer l'URL de l'aperçu pour éviter les fuites de mémoire
    return () => { if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError("Fichier trop lourd (max 15Mo)");
      return;
    }

    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file) return;
    if (!session?.user) return;

    setUploading(true);
    setError(null);

    try {
      let mediaUrl, mediaType;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `group-posts/${groupId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('media').upload(path, file);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('media').getPublicUrl(path);
        mediaUrl = data.publicUrl;
        mediaType = file.type;
      }

      const { data, error: insErr } = await supabase.from('group_posts').insert({
        group_id: groupId,
        user_id: session.user.id,
        content,
        media_url: mediaUrl,
        media_type: mediaType
      }).select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`).single();

      if (insErr) throw insErr;

      setContent('');
      removeFile();
      onPostCreated(data as any);
    } catch (err: any) {
      setError(err.message || "Erreur d'envoi");
    } finally {
      setUploading(true); // Petit délai visuel
      setTimeout(() => setUploading(false), 500);
    }
  };

  return (
    <div className="bg-white p-5 rounded-[2rem] shadow-soft border border-slate-100 animate-fade-in">
      <form onSubmit={handleSubmit}>
        <textarea
            className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none resize-none font-medium text-slate-700 min-h-[100px] text-sm"
            placeholder="Écrire quelque chose au groupe..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
        />
        
        {/* APERÇU CRITIQUE - Toujours visible en haut du bouton d'envoi */}
        {(file || previewUrl) && (
            <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 relative animate-fade-in-up">
                <button type="button" onClick={removeFile} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg z-10 hover:bg-red-600 transition-colors">
                    <X size={16} />
                </button>
                
                {previewUrl ? (
                    <div className="rounded-xl overflow-hidden shadow-sm ring-1 ring-slate-200">
                        <img src={previewUrl} alt="Aperçu" className="w-full max-h-48 object-cover" />
                    </div>
                ) : (
                    <div className="flex items-center space-x-3 p-2">
                        <div className="p-3 bg-isig-blue/10 rounded-xl text-isig-blue">
                            <FileText size={24} />
                        </div>
                        <p className="text-xs font-black text-slate-600 truncate flex-1">{file?.name}</p>
                    </div>
                )}
            </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
            <div className="flex items-center space-x-1">
                <label 
                  htmlFor="group-post-file-mobile"
                  className="flex items-center space-x-2 text-slate-500 hover:text-isig-blue p-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                    <Paperclip size={22} />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Joindre</span>
                </label>
                <input 
                  id="group-post-file-mobile"
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                />
            </div>

            <button 
                type="submit" 
                disabled={uploading || (!content.trim() && !file)}
                className="bg-isig-orange text-white font-black py-3 px-8 rounded-2xl hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center shadow-lg shadow-isig-orange/20 uppercase tracking-widest text-[10px] active:scale-95"
            >
                {uploading ? <Spinner /> : <><Send size={14} className="mr-2"/>Publier</>}
            </button>
        </div>
      </form>
      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-600 rounded-xl flex items-center text-[9px] font-black border border-red-100 animate-pulse uppercase tracking-wider">
            <AlertCircle size={14} className="mr-2" />
            <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default CreateGroupPost;
