import React, { useState } from 'react';
import { Pill } from './Pill';
import { ArrowUp, ArrowDown, MessageSquare, Share2 } from 'lucide-react';

export interface ReviewItem {
  id: string;
  title: string;
  author: string;
  excerpt: string;
  initialUpvotes?: number;
  initialDownvotes?: number;
}

export interface ReviewCardProps {
  review: ReviewItem;
  onComment?: (id: string) => void;
  onShare?: (id: string) => void;
  className?: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  onComment,
  onShare,
  className = '',
}) => {
  const [vote, setVote] = useState<number>(0);
  const [upvotes, setUpvotes] = useState(review.initialUpvotes || 12);
  const [downvotes, setDownvotes] = useState(review.initialDownvotes || 1);

  const handleVote = (direction: 1 | -1) => {
    if (vote === direction) {
      // Toggle off
      setVote(0);
      if (direction === 1) setUpvotes((v) => v - 1);
      else setDownvotes((v) => v - 1);
    } else {
      // Switch vote
      if (vote === 1) setUpvotes((v) => v - 1);
      if (vote === -1) setDownvotes((v) => v - 1);

      setVote(direction);
      if (direction === 1) setUpvotes((v) => v + 1);
      else setDownvotes((v) => v + 1);
    }
  };

  return (
    <article className={`review-card ${className}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h3>{review.title}</h3>
          <div style={{ color: 'var(--muted)', fontSize: '11px' }}>{review.author}</div>
        </div>
        <Pill variant="neutral">Reader review</Pill>
      </div>

      <p style={{ margin: '10px 0 14px', fontSize: '12px', lineHeight: 1.65, color: 'var(--muted)' }}>
        {review.excerpt}
      </p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleVote(1)}
          aria-pressed={vote === 1}
          className={`vote-btn ${vote === 1 ? 'selected' : ''}`}
          style={{
            border: '1px solid var(--border)',
            borderRadius: '999px',
            padding: '7px 11px',
            background: vote === 1 ? 'var(--accent-soft)' : 'var(--surface)',
            color: vote === 1 ? 'var(--accent)' : 'var(--muted)',
            borderColor: vote === 1 ? 'var(--accent)' : 'var(--border)',
            fontSize: '11px',
            fontWeight: 650,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <ArrowUp size={13} /> Helpful {upvotes}
        </button>

        <button
          type="button"
          onClick={() => handleVote(-1)}
          aria-pressed={vote === -1}
          className={`vote-btn down ${vote === -1 ? 'selected' : ''}`}
          style={{
            border: '1px solid var(--border)',
            borderRadius: '999px',
            padding: '7px 11px',
            background: vote === -1 ? 'var(--danger)' : 'var(--surface)',
            color: vote === -1 ? 'var(--danger-text)' : 'var(--muted)',
            borderColor: vote === -1 ? '#e6b8b4' : 'var(--border)',
            fontSize: '11px',
            fontWeight: 650,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <ArrowDown size={13} /> Not helpful {downvotes}
        </button>

        <button
          type="button"
          onClick={() => onComment && onComment(review.id)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: '999px',
            padding: '7px 11px',
            background: 'var(--surface)',
            color: 'var(--muted)',
            fontSize: '11px',
            fontWeight: 650,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <MessageSquare size={13} /> Comments (4)
        </button>

        <button
          type="button"
          onClick={() => onShare && onShare(review.id)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: '999px',
            padding: '7px 11px',
            background: 'var(--surface)',
            color: 'var(--muted)',
            fontSize: '11px',
            fontWeight: 650,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Share2 size={13} /> Share
        </button>
      </div>
    </article>
  );
};
