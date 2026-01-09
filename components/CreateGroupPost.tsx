
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
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        setPreviewUrl(null);
      }
    } else {
        setFile(null);
    }
  };

  const handleRemoveFile = () => {
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

  const handlePost = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && !file && !previewUrl) {
      setError("La publication ne peut pas être vide.");
      return;
    }
    if (!session?.user) {
      setError("Vous devez être connecté pour publier.");
      return;
    }

    setUploading(true);
    setError(null);

    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    try {
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
        setError(err.message || "Une erreur est survenue.");
        console.error(err);
    } finally {
        setUploading(false);
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 animate-fade-in-up">
      <div className="space-y-4">
        <textarea
            ref={textareaRef}
            className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none resize-none font-medium text-slate-700 min-h-[100px] transition-all overflow-hidden"
            placeholder="Partagez quelque chose avec le groupe..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              adjustHeight();
            }}
        />

        {previewUrl && (
            <div className="relative inline-block group">
                <img src={previewUrl} alt="Aperçu" className="rounded-2xl max-h-48 w-auto shadow-md border border-slate-100" />
                <button
                type="button"
                onClick={handleRemoveFile}
                className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1.5 shadow-lg hover:bg-red-500 transition-colors"
                >
                <X size={16} />
                </button>
            </div>
        )}

        {file && !previewUrl && (
            <div className="flex items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <FileText className="text-isig-blue mr-3" />
                <p className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{file.name}</p>
                <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="ml-auto text-slate-400 hover:text-red-500 transition-colors p-1"
                >
                    <X size={20} />
                </button>
            </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-slate-50">
            <button 
                type="button" 
                onClick={triggerFileInput}
                className="text-slate-400 hover:text-isig-blue p-3 rounded-2xl hover:bg-slate-50 transition-all flex items-center space-x-2"
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

            <button
                type="button"
                onClick={() => handlePost()}
                disabled={uploading || (!content.trim() && !file)}
                className="bg-isig-orange text-white font-black py-3.5 px-8 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-[10px] flex items-center space-x-2"
            >
                {uploading ? <Spinner /> : <><Send size={14} className="mr-2" />Publier</>}
            </button>
        </div>
        {error && (
            <div className="flex items-center space-x-2 text-red-500 p-2 bg-red-50 rounded-xl border border-red-100 animate-pulse">
                <AlertCircle size={14} />
                <span className="text-[10px] font-bold uppercase">{error}</span>
            </div>
        )}
      </div>
    </div>
  );
};

export default CreateGroupPost;
