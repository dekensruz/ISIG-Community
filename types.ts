
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  student_id?: string;
  major?: string;
  promotion?: string;
  gender?: 'M' | 'F';
  skills?: string[];
  courses?: string[];
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  updated_at: string;
  birth_date?: string;
  show_birth_year?: boolean;
  last_seen_at?: string;
  role: 'user' | 'admin';
  theme: 'light' | 'dark';
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'document' | 'link';
  created_at: string;
  likes_count: number;
  profiles: Profile; 
  comments: Comment[];
  likes: Like[];
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: Profile;
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

export interface Group {
    id: string;
    created_at: string;
    name: string;
    description?: string;
    created_by: string;
    avatar_url?: string;
    is_private: boolean;
    profiles: Profile;
    group_members: GroupMember[];
    group_join_requests: GroupJoinRequest[];
}

export interface GroupJoinRequest {
    id: string;
    group_id: string;
    user_id: string;
    created_at: string;
    profiles: Profile;
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
    likes_count: number;
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
  profiles: Profile;
  parent_comment_id?: string;
  replies?: GroupPostComment[];
}

export interface GroupPostLike {
    id: string;
    group_post_id: string;
    user_id: string;
}

export interface Feedback {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles?: Profile;
}

export interface Conversation {
    id: string;
    created_at: string;
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
    profiles?: Profile;
    is_read?: boolean;
    updated_at?: string;
    replying_to_message_id?: string;
    replied_to?: Message;
    media_url?: string;
    media_type?: string;
}

export interface Notification {
    id: string;
    user_id: string;
    actor_id: string;
    type: 'new_like' | 'new_group_like' | 'new_comment' | 'new_group_post' | 'new_message' | 'new_follower' | 'group_join_request' | 'group_member_joined' | 'new_group_comment' | 'new_comment_reply' | 'new_group_comment_reply' | 'group_request_accepted' | 'group_member_left' | 'group_admin_promotion';
    post_id?: string;
    group_id?: string;
    group_post_id?: string;
    conversation_id?: string;
    is_read: boolean;
    created_at: string;
    profiles: Profile;
}
