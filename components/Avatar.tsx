
import React from 'react';

interface AvatarProps {
  avatarUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  shape?: 'circle' | 'square';
}

const Avatar: React.FC<AvatarProps> = ({ avatarUrl, name, size = 'md', className = '', shape = 'circle' }) => {
  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const names = fullName.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };
  
  const sizeClasses = {
    sm: 'h-8 w-8 min-w-[2rem] min-h-[2rem] text-[10px]',
    md: 'h-10 w-10 min-w-[2.5rem] min-h-[2.5rem] text-xs',
    lg: 'h-12 w-12 min-w-[3rem] min-h-[3rem] text-sm',
    xl: 'h-16 w-16 min-w-[4rem] min-h-[4rem] text-lg',
    '2xl': 'h-24 w-24 min-w-[6rem] min-h-[6rem] text-2xl',
    '3xl': 'h-32 w-32 min-w-[8rem] min-h-[8rem] text-4xl',
  };
  
  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-2xl',
  }

  const colorClasses = [
    'bg-isig-blue', 'bg-isig-orange', 'bg-indigo-500', 'bg-emerald-500', 'bg-rose-500'
  ];

  const getColor = (str: string) => {
    if (!str) return colorClasses[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colorClasses[Math.abs(hash % colorClasses.length)];
  };

  // Ajout de flex-shrink-0 pour empêcher la compression dans les listes
  const finalClassName = `flex-shrink-0 ${sizeClasses[size]} ${shapeClasses[shape]} ${className} shadow-sm overflow-hidden`;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${finalClassName} object-cover border-2 border-white`}
      />
    );
  }

  return (
    <div
      className={`${finalClassName} flex items-center justify-center font-extrabold text-white border-2 border-white ${getColor(name)}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
