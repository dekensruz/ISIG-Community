
import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import CreatePost from './CreatePost';
import { useQueryClient } from '@tanstack/react-query';

interface CreatePostModalProps {
  onClose: () => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const modalRoot = document.getElementById('modal-root');
  const queryClient = useQueryClient();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.body.style.overflow = 'auto';
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!modalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100] flex justify-center items-center p-4 animate-fade-in">
      <div 
        ref={modalRef} 
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-2 relative animate-fade-in-up"
      >
        <div className="absolute top-4 right-4 z-10">
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        {/* On réutilise le composant CreatePost existant */}
        <CreatePost 
            onPostCreated={() => {
                // Rafraichir le feed et fermer le modal
                queryClient.invalidateQueries({ queryKey: ['posts'] });
                onClose();
            }} 
        />
      </div>
    </div>,
    modalRoot
  );
};

export default CreatePostModal;
