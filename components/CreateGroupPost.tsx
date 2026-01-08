
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Paperclip, X, FileText, Send, AlertCircle } from 'lucide-react';
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
    return () => { 
        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl); 
        }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
    }
    
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Limite de taille (ex: 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
          setError("Le fichier est trop volumineux (max 10MB).");
          return;
      }

      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file) {
      setError("La publication ne peut pas être vide.");
      return;
    }
    if (!session?.user) {
      setError("Session expirée. Reconnectez-vous.");
      return;
    }

    setUploading(true);
    setError(null);

    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    try {
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `group-media/${groupId}/${session.user.id}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('media').getPublicUrl(fileName);
          mediaUrl = data.publicUrl;
          mediaType = file.type || 'application/octet-stream';
        }

        const { data, error: insertError } = await supabase.from('group_posts').insert({
          user_id: session.user.id,
          group_id: groupId,
          content,
          media_url: mediaUrl,
          media_type: mediaType
        }).select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`).single();

        if (insertError) throw insertError;
        
        setContent('');
        handleRemoveFile();
        onPostCreated(data as any);
    } catch (err: any) {
        console.error("Upload error:", err);
        setError(err.message || "Erreur lors de l'envoi. Vérifiez votre connexion.");
    } finally {
        setUploading(false);
    }
  };
  
  return (
    <div className="bg-white p-4 rounded-3xl shadow-soft border border-slate-100">
      <form onSubmit={handlePost}>
        <textarea
            className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none resize-none font-medium text-slate-700 min-h-[100px]"
            placeholder="Une question ou un document pour le groupe ?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
        />
        
        {file && (
            <div className="mt-3 relative inline-block animate-fade-in-up">
                {previewUrl ? (
                    <img src={previewUrl} alt="Aperçu" className="rounded-2xl max-h-48 w-auto shadow-md border border-slate-100" />
                ) : (
                    <div className="flex items-center p-3 bg-slate-100 rounded-xl border border-slate-200">
                        <FileText className="text-isig-blue mr-3" />
                        <p className="text-xs font-bold text-slate-600 max-w-[150px] truncate">{file.name}</p>
                    </div>
                )}
                <button 
                    type="button" 
                    onClick={handleRemoveFile} 
                    className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors z-10"
                >
                    <X size={16} />
                </button>
            </div>
        )}

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50">
            <label 
              htmlFor="group-file-upload-input"
              className="text-slate-400 hover:text-isig-blue p-3 rounded-2xl hover:bg-slate-50 transition-all flex-shrink-0 cursor-pointer flex items-center space-x-2"
            >
                <Paperclip size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Ajouter un fichier</span>
                <input 
                  id="group-file-upload-input"
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                />
            </label>
            <button 
                type="submit" 
                disabled={uploading || (!content.trim() && !file)} 
                className="bg-isig-orange text-white font-black py-3 px-8 rounded-2xl hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center shadow-lg shadow-isig-orange/20 uppercase tracking-widest text-[10px]"
            >
                {uploading ? <Spinner /> : <><Send size={14} className="mr-2"/>Publier</>}
            </button>
        </div>
      </form>
      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-600 rounded-xl flex items-center text-[10px] font-bold border border-red-100 animate-pulse">
            <AlertCircle size={14} className="mr-2" />
            <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default CreateGroupPost;
