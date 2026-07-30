import React, { useState, useEffect, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Loader2, MessageCircle, Sparkles,
} from 'lucide-react';
import { CommentReactionButton } from '@/components/ui/ReactionButton';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeComments, addComment, toggleCommentReaction,
  writeNotification,
  type RawComment,
} from '@/lib/firestore';
import type { User } from '@/lib/mockData';
import { myReactionEmoji } from '@/lib/reactions';
import { mockPosts } from '@/lib/mockData';
import type { Post } from '@/lib/mockData';
import { PostCard } from '@/pages/Home';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';

// ─── Comment row ──────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  postId,
  currentUserId,
  currentUser,
}: {
  comment: RawComment;
  postId: string;
  currentUserId?: string;
  currentUser?: User;
}) {
  const [reactions, setReactions] = useState<Record<string, string[]>>(comment.reactions ?? {});

  async function handleReact(emoji: string) {
    if (!currentUserId || !currentUser) return;
    // Optimistic update
    const current = reactions;
    const updated: Record<string, string[]> = {};
    for (const [e, users] of Object.entries(current)) {
      const filtered = users.filter(id => id !== currentUserId);
      if (filtered.length > 0) updated[e] = filtered;
    }
    const hadThis = (current[emoji] ?? []).includes(currentUserId);
    if (!hadThis) updated[emoji] = [...(updated[emoji] ?? []), currentUserId];
    setReactions(updated);
    if (isFirebaseConfigured) {
      toggleCommentReaction(postId, comment.id, currentUserId, emoji).catch(err => {
        console.error(err);
        setReactions(current); // revert on error
      });
      // Notify the comment author when this is a new reaction (not a removal)
      if (!hadThis && comment.authorId && comment.authorId !== currentUserId) {
        writeNotification(comment.authorId, 'like_comment', currentUser as unknown as User, {
          postId,
          commentId: comment.id,
          message: `${currentUser.displayName} reacted ${emoji} to your comment`,
        }).catch(console.error);
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 py-3"
    >
      <Link href={`/profile/${comment.authorId}`} className="flex-shrink-0">
        <UserAvatar
          userId={comment.authorId}
          fallbackName={comment.author.displayName}
          fallbackSrc={comment.author.avatarUrl || undefined}
          size={38}
          className="cursor-pointer hover:opacity-90 transition-opacity"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-[#111] rounded-[16px] px-3.5 py-2.5">
          <Link href={`/profile/${comment.authorId}`}>
            <span className="font-bold text-[13px] text-white hover:underline">
              {comment.author.displayName}
            </span>
          </Link>
          <p className="text-[13.5px] text-[#BDBDBD] mt-0.5 leading-snug">{comment.text}</p>
        </div>
        <div className="flex items-center gap-4 mt-1.5 ml-1">
          <span className="text-[11.5px] text-[rgba(255,255,255,0.45)]">
            {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
          </span>
          <CommentReactionButton
            reactions={reactions}
            myReaction={myReactionEmoji(reactions, currentUserId ?? '')}
            onReact={handleReact}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PostDetail() {
  const [, params] = useRoute('/post/:postId');
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const postId = params?.postId ?? '';

  // ── Resolve post ──────────────────────────────────────────────────────────
  const [post, setPost] = useState<Post | null>(null);
  const [postLoading, setPostLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    if (isFirebaseConfigured) {
      import('firebase/firestore').then(async ({ getFirestore, doc, getDoc }) => {
        try {
          const db = getFirestore();
          const snap = await getDoc(doc(db, 'posts', postId));
          if (snap.exists()) {
            const d = snap.data();
            setPost({
              id: snap.id,
              authorId: d.authorId ?? '',
              author: {
                id: d.authorId ?? '',
                displayName: d.authorName ?? '',
                handle: d.authorHandle ?? '',
                bio: '', avatarUrl: d.authorAvatar ?? '', coverUrl: '',
                interests: [], followers: 0, following: 0,
                postCount: 0, badges: [], joinedAt: new Date(),
              },
              content: d.content ?? '',
              imageUrl: d.imageUrl,
              likes: d.likes ?? 0,
              comments: d.comments ?? 0,
              shares: d.shares ?? 0,
              liked: false,
              saved: false,
              createdAt: d.createdAt?.toDate?.() ?? new Date(),
              communityId: d.communityId,
              sparkPrompt: d.sparkPrompt,
            });
          } else {
            setPost(null);
          }
        } catch {
          setPost(null);
        } finally { setPostLoading(false); }
      });
    } else {
      const found = mockPosts.find(p => p.id === postId) ?? null;
      setPost(found);
      setPostLoading(false);
    }
  }, [postId]);

  // ── Comments ──────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<RawComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  useEffect(() => {
    if (!postId) { return undefined; }
    if (isFirebaseConfigured) {
      setCommentsLoading(true);
      const unsub = subscribeComments(postId, data => {
        setComments(data);
        setCommentsLoading(false);
      });
      return unsub;
    }
    setComments([]);
    setCommentsLoading(false);
    return undefined;
  }, [postId]);

  // ── Compose ───────────────────────────────────────────────────────────────
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    if (!text.trim() || !currentUser || sending || !postId) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      if (isFirebaseConfigured) {
        await addComment(postId, currentUser, body, post?.authorId);
        // subscribeComments will update the list
      } else {
        const stub: RawComment = {
          id: `c-${Date.now()}`,
          authorId: currentUser.id,
          author: currentUser,
          text: body,
          reactions: {},
          replyCount: 0,
          createdAt: new Date(),
        };
        setComments(prev => [...prev, stub]);
        if (post) setPost(p => p ? { ...p, comments: p.comments + 1 } : p);
      }
    } catch { setText(body); } finally { setSending(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (postLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={28} className="text-[#EC4899] animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <p className="text-6xl mb-4">🌿</p>
        <h2 className="text-[20px] font-black text-white mb-2">Post not found</h2>
        <p className="text-[14px] text-[rgba(255,255,255,0.45)] mb-8">It may have been deleted or never existed.</p>
        <button
          onClick={() => setLocation('/')}
          className="px-6 py-2.5 rounded-full text-[14px] font-black text-white"
          style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-32">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-[#1a1a1a] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation('/')}
          className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors flex-shrink-0"
        >
          <ArrowLeft size={20} className="text-[#BDBDBD]" />
        </button>
        <div>
          <h1 className="font-black text-[16px] text-white">Post</h1>
          <p className="text-[12px] text-[rgba(255,255,255,0.45)]">
            {formatDistanceToNow(post.createdAt, { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Post card */}
      <div className="pt-3">
        <PostCard
          post={post}
          index={0}
          onSave={() => {}}
        />
      </div>

      {/* Comments section */}
      <div className="px-4 mt-1">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle size={16} className="text-[#EC4899]" />
          <h2 className="font-black text-[15px] text-white">
            {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
          </h2>
        </div>

        {commentsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="text-[#EC4899] animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-14 text-center"
          >
            <div className="w-14 h-14 rounded-[20px] bg-[#1a1a1a] flex items-center justify-center mb-3">
              <Sparkles size={24} className="text-[rgba(255,255,255,0.35)]" />
            </div>
            <p className="font-bold text-[15px] text-[#BDBDBD] mb-1">Be the first to comment</p>
            <p className="text-[13px] text-[rgba(255,255,255,0.45)]">Share your thoughts below.</p>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map(c => (
              <CommentRow
                key={c.id}
                comment={c}
                postId={postId}
                currentUserId={currentUser?.id}
                currentUser={currentUser ?? undefined}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Compose bar */}
      {currentUser && (
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 px-4 z-20">
          <div className="flex items-end gap-2.5 bg-[#111] rounded-[20px] border border-black/[0.07] shadow-lg px-3 py-2">
            <UserAvatar
              userId={currentUser.id}
              fallbackName={currentUser.displayName}
              fallbackSrc={currentUser.avatarUrl || undefined}
              size={34}
              className="flex-shrink-0 mb-0.5"
            />
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              rows={1}
              placeholder="Write a comment…"
              className="flex-1 resize-none text-[14px] bg-transparent outline-none text-white placeholder:text-[#555] max-h-24 py-1.5"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white mb-0.5 disabled:opacity-40 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
            >
              {sending
                ? <Loader2 size={15} className="animate-spin" />
                : <Send size={15} />}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
