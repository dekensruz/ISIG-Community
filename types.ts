import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  student_id?: string;
  major?: string;
  promotion?: string;
  skills?: string[];
  courses?: string[];
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  updated_at: string;
  birth_date?: string;
  show_birth_year?: boolean;
  last_seen_at?: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'document' | 'link';
  created_at: string;
  profiles: Profile; // Joined data
  comments: Comment[];
  likes: Like[];
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: Profile; // Joined data
  parent_comment_id?: string;
  replies?: Comment[];
}

export interface Like {
    id: string;
    post_id: string;
    user_id: string;
}

export interface AppUser extends User {
    profile: Profile;
}

// Nouvelles interfaces pour les Groupes
export interface Group {
    id: string;
    created_at: string;
    name: string;
    description?: string;
    created_by: string;
    avatar_url?: string;
    is_private: boolean; // Nouveau champ
    profiles: Profile; // Créateur du groupe
    group_members: GroupMember[]; // Liste des membres
    group_join_requests: GroupJoinRequest[]; // Liste des demandes
}

export interface GroupJoinRequest {
    id: string;
    group_id: string;
    user_id: string;
    created_at: string;
    profiles: Profile; // User making the request
}

export interface GroupMember {
    group_id: string;
    user_id: string;
    joined_at: string;
    role: 'admin' | 'member';
    profiles: Profile;
}

export interface GroupPost {
    id: string;
    group_id: string;
    user_id: string;
    content: string;
    media_url?: string;
    media_type?: string;
    created_at: string;
    profiles: Profile;
    group_post_comments: GroupPostComment[];
    group_post_likes: GroupPostLike[];
}

export interface GroupPostComment {
  id: string;
  group_post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: Profile; // Joined data
  parent_comment_id?: string;
  replies?: GroupPostComment[];
}

export interface GroupPostLike {
    id: string;
    group_post_id: string;
    user_id: string;
}

// Types for Chat
export interface Conversation {
    id: string;
    created_at: string;
    // These will be processed in the front-end
    other_participant: Profile;
    last_message: Message | null;
    unread_count: number;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    profiles?: Profile; // Sender's profile
    is_read?: boolean;
    updated_at?: string;
    replying_to_message_id?: string;
    replied_to?: Message; // Joined data for the message being replied to
    media_url?: string;
    media_type?: string;
}

// Types for Notifications
export interface Notification {
    id: string;
    user_id: string; // The user who receives the notification
    actor_id: string; // The user who triggered the notification
    type: 'new_like' | 'new_group_like' | 'new_comment' | 'new_group_post' | 'new_message' | 'new_follower' | 'group_join_request' | 'group_member_joined' | 'new_group_comment' | 'new_comment_reply' | 'new_group_comment_reply' | 'group_request_accepted' | 'group_member_left' | 'group_admin_promotion';
    post_id?: string;
    group_id?: string;
    group_post_id?: string;
    conversation_id?: string;
    is_read: boolean;
    created_at: string;
    profiles: Profile; // Joined data for the actor
}