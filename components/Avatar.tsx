
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
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-12 w-12 text-sm',
    xl: 'h-16 w-16 text-lg',
    '2xl': 'h-24 w-24 text-2xl',
    '3xl': 'h-32 w-32 text-4xl',
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

  const finalClassName = `${sizeClasses[size]} ${shapeClasses[shape]} ${className} shadow-sm`;

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
