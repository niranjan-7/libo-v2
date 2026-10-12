import React from 'react';
import { StatusBadge } from './Pill';
import { Button } from './Button';
import { BookOpen, ArrowUpRight } from 'lucide-react';

export interface BookItem {
  id?: string | number;
  title: string;
  author: string;
  year: number | string;
  tag: string;
  status: string;
  copies: number;
  rating: string | number;
  isbn?: string;
}

export interface BookCardProps {
  book: BookItem;
  onExplore?: (book: BookItem) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onExplore,
  className = '',
  style,
}) => {
  // Map genre tag to gradient palette class
  const getPaletteClass = (tag: string) => {
    const lower = tag.toLowerCase();
    if (lower.includes('nonfiction')) return 'nonfiction';
    if (lower.includes('mystery')) return 'mystery';
    if (lower.includes('thriller')) return 'thriller';
    if (lower.includes('sci') || lower.includes('space')) return 'scifi';
    return 'fiction';
  };

  const palette = getPaletteClass(book.tag);

  return (
    <article className={`book-card modern-book-card ${className}`} style={style}>
      {/* Cover Art */}
      <div className={`book-cover cover-art ${palette}`}>
        <span className="cover-kicker">{book.tag.toUpperCase()}</span>
        <strong>{book.title}</strong>
        <span className="cover-author">{book.author}</span>
        <i className="cover-orbit" aria-hidden="true" />
      </div>

      {/* Book Information */}
      <div className="book-info">
        <div className="book-meta-top">
          <StatusBadge status={book.status} />
          <span className="rating" title={`${book.rating} out of 5 stars`}>
            ★ {book.rating}
          </span>
        </div>

        <h3>{book.title}</h3>
        <p className="book-byline">
          by {book.author} &bull; {book.year}
        </p>

        <div className="book-card-foot">
          <span className="book-copy-count">
            <span style={{ color: 'var(--accent)', fontWeight: 800 }}>▤</span>
            {book.copies} {book.copies === 1 ? 'copy' : 'copies'} &bull; {book.tag}
          </span>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onExplore && onExplore(book)}
            iconRight={<ArrowUpRight size={13} />}
          >
            Explore title
          </Button>
        </div>
      </div>
    </article>
  );
};
