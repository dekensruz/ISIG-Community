
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { GroupPost } from '../types';
import { Paperclip, X, FileText, Send, AlertCircle } from 'lucide-react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 15 * 1024 * 1024) {
          setError("Fichier trop lourd (max 15Mo)");
          return;
      }
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        setPreviewUrl(null);
      }
      setError(null);
    }
  };

  const handleRemoveFile = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFile(null);
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileInput = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handlePost = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
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

    try {
        let mediaUrl: string | undefined = undefined;
        let mediaType: string | undefined = undefined;

        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `group-${groupId}-${session.user.id}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('media').getPublicUrl(fileName);
          mediaUrl = data.publicUrl;
          mediaType = file.type.startsWith('image/') ? 'image' : 'document';
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
        if (textareaRef.current) textareaRef.current.style.height = '100px';
        
        onPostCreated(data as any);
    } catch (err: any) {
        console.error("Group Post Upload error:", err);
        setError(err.message || "Une erreur est survenue lors de l'envoi.");
    } finally {
        setUploading(false);
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 animate-fade-in-up">
      <form onSubmit={handlePost} className="space-y-4">
        <textarea
            ref={textareaRef}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none resize-none font-medium text-slate-700 min-h-[100px] text-sm transition-all overflow-hidden"
            placeholder="Écrivez quelque chose au groupe..."
            value={content}
            onChange={(e) => {
                setContent(e.target.value);
                adjustHeight();
            }}
        />
        
        {previewUrl && (
            <div className="relative inline-block animate-fade-in-up">
                <img src={previewUrl} alt="Aperçu" className="rounded-2xl max-h-48 w-auto shadow-md border border-slate-100" />
                <button 
                    type="button" 
                    onClick={handleRemoveFile} 
                    className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1.5 shadow-lg hover:bg-red-500 transition-colors z-10"
                >
                    <X size={16} />
                </button>
            </div>
        )}

        {file && !previewUrl && (
            <div className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-100 relative">
                <FileText className="text-isig-blue mr-3" />
                <p className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{file.name}</p>
                <button type="button" onClick={handleRemoveFile} className="ml-auto text-slate-400 hover:text-red-500 transition-colors p-1"><X size={16}/></button>
            </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-slate-50">
            <div className="flex items-center">
                <button 
                  type="button"
                  onClick={triggerFileInput}
                  className="text-slate-400 hover:text-isig-blue p-3 rounded-2xl hover:bg-slate-50 transition-all flex items-center space-x-2 cursor-pointer outline-none"
                  aria-label="Joindre un fichier"
                >
                    <Paperclip size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Joindre</span>
                </button>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  className="hidden" 
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileChange} 
                />
            </div>
            
            <button 
                type="submit" 
                disabled={uploading || (!content.trim() && !file)}
                className="bg-isig-orange text-white font-black py-3.5 px-8 rounded-2xl hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center shadow-lg shadow-isig-orange/20 uppercase tracking-widest text-[10px] active:scale-95"
            >
                {uploading ? <Spinner /> : <><Send size={14} className="mr-2"/>Publier</>}
            </button>
        </div>

        {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl flex items-center text-[10px] font-bold border border-red-100">
                <AlertCircle size={14} className="mr-2" />
                <span>{error}</span>
            </div>
        )}
      </form>
    </div>
  );
};

export default CreateGroupPost;
