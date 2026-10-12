import React, { useState } from 'react';
import { Pill } from './Pill';
import {
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Share2,
  Star,
  ShieldAlert,
  Send,
  Loader2,
  Check,
} from 'lucide-react';
import { ReviewStatus } from '@library/contracts';

export interface ReviewItem {
  id: string;
  title: string;
  author: string;
  excerpt: string;
  rating?: number;
  status?: ReviewStatus;
  initialUpvotes?: number;
  initialDownvotes?: number;
  initialUserVote?: 1 | -1 | 0;
  commentsCount?: number;
  createdAt?: string;
}

export interface ReviewCardProps {
  review: ReviewItem;
  currentUserId?: string;
  isStaff?: boolean;
  onVote?: (id: string, vote: 1 | -1 | 0) => Promise<void>;
  onComment?: (id: string) => void;
  onAddComment?: (id: string, text: string) => Promise<void>;
  onModerate?: (id: string, status: ReviewStatus) => Promise<void>;
  onShare?: (id: string) => void;
  comments?: Array<{ commentId: string; authorName: string; body: string; createdAt: string }>;
  isLoadingComments?: boolean;
  className?: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  currentUserId,
  isStaff = false,
  onVote,
  onComment,
  onAddComment,
  onModerate,
  onShare,
  comments = [],
  isLoadingComments = false,
  className = '',
}) => {
  const [userVote, setUserVote] = useState<number>(review.initialUserVote || 0);
  const [upvotes, setUpvotes] = useState<number>(review.initialUpvotes || 0);
  const [downvotes, setDownvotes] = useState<number>(review.initialDownvotes || 0);
  const [isVoting, setIsVoting] = useState<boolean>(false);

  const [showComments, setShowComments] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleVote = async (direction: 1 | -1) => {
    if (isVoting) return;

    const previousVote = userVote;
    const previousUpvotes = upvotes;
    const previousDownvotes = downvotes;

    let targetVote: 1 | -1 | 0;
    if (userVote === direction) {
      // Toggle off / remove vote
      targetVote = 0;
      setUserVote(0);
      if (direction === 1) setUpvotes((v) => Math.max(0, v - 1));
      else setDownvotes((v) => Math.max(0, v - 1));
    } else {
      // Switch or apply vote
      targetVote = direction;
      if (userVote === 1) setUpvotes((v) => Math.max(0, v - 1));
      if (userVote === -1) setDownvotes((v) => Math.max(0, v - 1));

      setUserVote(direction);
      if (direction === 1) setUpvotes((v) => v + 1);
      else setDownvotes((v) => v + 1);
    }

    if (onVote) {
      setIsVoting(true);
      try {
        await onVote(review.id, targetVote);
      } catch {
        // Rollback on error
        setUserVote(previousVote);
        setUpvotes(previousUpvotes);
        setDownvotes(previousDownvotes);
      } finally {
        setIsVoting(false);
      }
    }
  };

  const handleCommentToggle = () => {
    const nextState = !showComments;
    setShowComments(nextState);
    if (nextState && onComment) {
      onComment(review.id);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmittingComment || !onAddComment) return;

    setIsSubmittingComment(true);
    try {
      await onAddComment(review.id, commentText.trim());
      setCommentText('');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare(review.id);
    } else {
      const shareUrl = `${window.location.origin}?reviewId=${review.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const rating = review.rating || 5;

  return (
    <article
      className={`review-card ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Top Header: Title, Author, Rating & Status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            {/* 5-star Rating */}
            <div style={{ display: 'flex', gap: '2px', color: '#f59e0b' }} aria-label={`Rating: ${rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={14}
                  fill={star <= rating ? '#f59e0b' : 'none'}
                  stroke={star <= rating ? '#f59e0b' : 'var(--muted)'}
                />
              ))}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {rating}.0
            </span>
          </div>

          <h3 style={{ margin: '2px 0 4px', fontSize: '15px', fontWeight: 750, color: 'var(--text)' }}>
            {review.title}
          </h3>
          <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
            By <strong style={{ color: 'var(--text-secondary)' }}>{review.author}</strong>
            {review.createdAt && ` \u2022 ${new Date(review.createdAt).toLocaleDateString()}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {review.status && review.status !== 'PUBLISHED' && (
            <Pill variant={review.status === 'FLAGGED' ? 'yellow' : 'red'}>
              {review.status}
            </Pill>
          )}
          <Pill variant="neutral">Verified reader</Pill>
        </div>
      </div>

      {/* Review Body */}
      <p style={{ margin: '4px 0 8px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
        {review.excerpt}
      </p>

      {/* Action Buttons: Helpful, Not Helpful, Comments, Share, Staff Moderation */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Upvote / Helpful Button */}
        <button
          type="button"
          onClick={() => handleVote(1)}
          disabled={isVoting}
          aria-pressed={userVote === 1}
          aria-label={`Helpful review. Currently ${upvotes} upvotes.`}
          className={`vote-btn ${userVote === 1 ? 'selected' : ''}`}
          style={{
            border: `1px solid ${userVote === 1 ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '999px',
            padding: '7px 12px',
            background: userVote === 1 ? 'var(--accent-soft)' : 'var(--surface)',
            color: userVote === 1 ? 'var(--accent)' : 'var(--muted)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowUp size={14} /> Helpful {upvotes > 0 ? `(${upvotes})` : ''}
        </button>

        {/* Downvote / Not Helpful Button */}
        <button
          type="button"
          onClick={() => handleVote(-1)}
          disabled={isVoting}
          aria-pressed={userVote === -1}
          aria-label={`Not helpful review. Currently ${downvotes} downvotes.`}
          className={`vote-btn down ${userVote === -1 ? 'selected' : ''}`}
          style={{
            border: `1px solid ${userVote === -1 ? 'var(--status-danger-text)' : 'var(--border)'}`,
            borderRadius: '999px',
            padding: '7px 12px',
            background: userVote === -1 ? 'color-mix(in srgb, var(--status-danger-text) 12%, transparent)' : 'var(--surface)',
            color: userVote === -1 ? 'var(--status-danger-text)' : 'var(--muted)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowDown size={14} /> Not helpful {downvotes > 0 ? `(${downvotes})` : ''}
        </button>

        {/* Comments Toggle Button */}
        <button
          type="button"
          onClick={handleCommentToggle}
          aria-expanded={showComments}
          aria-label={`Toggle comments thread. ${review.commentsCount || comments.length} comments.`}
          style={{
            border: '1px solid var(--border)',
            borderRadius: '999px',
            padding: '7px 12px',
            background: showComments ? 'var(--canvas)' : 'var(--surface)',
            color: showComments ? 'var(--text)' : 'var(--muted)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <MessageSquare size={14} /> Comments (
          {comments.length > 0 ? comments.length : review.commentsCount || 0})
        </button>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share review deep link"
          style={{
            border: '1px solid var(--border)',
            borderRadius: '999px',
            padding: '7px 12px',
            background: 'var(--surface)',
            color: copied ? 'var(--status-success-text)' : 'var(--muted)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {copied ? <Check size={14} /> : <Share2 size={14} />} {copied ? 'Copied Link' : 'Share'}
        </button>

        {/* Staff Moderation Actions */}
        {isStaff && onModerate && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ShieldAlert size={12} /> Moderation:
            </span>
            {review.status !== 'PUBLISHED' && (
              <button
                type="button"
                onClick={() => onModerate(review.id, 'PUBLISHED')}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 650,
                  background: 'var(--surface)',
                  color: 'var(--status-success-text)',
                  cursor: 'pointer',
                }}
              >
                Publish
              </button>
            )}
            {review.status !== 'FLAGGED' && (
              <button
                type="button"
                onClick={() => onModerate(review.id, 'FLAGGED')}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 650,
                  background: 'var(--surface)',
                  color: 'var(--status-warning-text)',
                  cursor: 'pointer',
                }}
              >
                Flag
              </button>
            )}
            {review.status !== 'HIDDEN' && (
              <button
                type="button"
                onClick={() => onModerate(review.id, 'HIDDEN')}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 650,
                  background: 'var(--surface)',
                  color: 'var(--status-danger-text)',
                  cursor: 'pointer',
                }}
              >
                Hide
              </button>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Threaded Comments Section */}
      {showComments && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {isLoadingComments ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '12px', padding: '8px 0' }}>
              <Loader2 size={14} className="animate-spin" /> Loading discussion...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '12px', fontStyle: 'italic', padding: '4px 0' }}>
              No comments yet on this review. Be the first to join the conversation!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {comments.map((c) => (
                <div
                  key={c.commentId}
                  style={{
                    background: 'var(--canvas)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '11px', color: 'var(--text)' }}>{c.authorName}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* New Comment Submission Input */}
          {onAddComment && (
            <form onSubmit={handleSubmitComment} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Write a thoughtful comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--canvas)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || isSubmittingComment}
                style={{
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 650,
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                  opacity: commentText.trim() ? 1 : 0.6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isSubmittingComment ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Reply
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
};
