import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  BookWorkDto,
  ReviewDto,
  ReviewCommentDto,
  ReviewEligibilityDto,
  ReviewStatus,
  OrgRole,
} from '@library/contracts';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge, Chip } from '../ui/Pill';
import { LoadingState, ErrorState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import { ReviewCard } from '../ui/ReviewCard';
import {
  ArrowLeft,
  MapPin,
  Building,
  Barcode,
  Calendar,
  BookmarkPlus,
  Star,
  MessageSquare,
  PenLine,
  X,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface BookDetailsScreenProps {
  bookId: string;
  onBack: () => void;
  onLocateOnMap?: (rackCode: string) => void;
}

export const BookDetailsScreen: React.FC<BookDetailsScreenProps> = ({
  bookId,
  onBack,
  onLocateOnMap,
}) => {
  const { currentOrg, currentLibrary, currentRole, user } = useAuth();
  const { showToast } = useToast();
  const [book, setBook] = useState<BookWorkDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservingEditionId, setReservingEditionId] = useState<string | null>(null);

  // Reviews & Community state
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);
  const [eligibility, setEligibility] = useState<ReviewEligibilityDto | null>(null);
  const [showWriteModal, setShowWriteModal] = useState<boolean>(false);
  const [newRating, setNewRating] = useState<number>(5);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newBody, setNewBody] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Comments per review map
  const [reviewComments, setReviewComments] = useState<Record<string, ReviewCommentDto[]>>({});
  const [loadingCommentsMap, setLoadingCommentsMap] = useState<Record<string, boolean>>({});

  const isStaff = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  const handleReserveEdition = async (editionId: string, label: string) => {
    if (!currentOrg || !currentLibrary) return;
    setReservingEditionId(editionId);
    try {
      const res = await api.circulation.createReservation(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        { editionId },
      );

      if (res.status === 'ALLOCATED') {
        showToast(`Hold placed for ${label}! An available physical copy has been allocated.`, 'success');
      } else {
        showToast(`Waitlisted for ${label}! You are #${res.queuePosition} in the reservation queue.`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to place reservation hold', 'error');
    } finally {
      setReservingEditionId(null);
    }
  };

  const fetchReviewsAndEligibility = useCallback(async () => {
    if (!currentOrg || !currentLibrary || !bookId) return;
    setLoadingReviews(true);
    try {
      const [reviewList, elig] = await Promise.all([
        api.community.getReviewsForBook(currentOrg.organization.organizationId, bookId),
        api.community.checkEligibility(
          currentOrg.organization.organizationId,
          bookId,
          currentLibrary.libraryId,
        ),
      ]);
      setReviews(reviewList);
      setEligibility(elig);
    } catch {
      // Non-blocking error
    } finally {
      setLoadingReviews(false);
    }
  }, [currentOrg, currentLibrary, bookId]);

  useEffect(() => {
    fetchReviewsAndEligibility();
  }, [fetchReviewsAndEligibility]);

  const handleVoteReview = async (reviewId: string, vote: 1 | -1 | 0) => {
    if (!currentOrg) return;
    const res = await api.community.voteReview(
      currentOrg.organization.organizationId,
      reviewId,
      vote,
    );
    setReviews((prev) =>
      prev.map((r) =>
        r.reviewId === reviewId
          ? {
              ...r,
              upvotesCount: res.upvotesCount,
              downvotesCount: res.downvotesCount,
              score: res.score,
              userVote: res.userVote as any,
            }
          : r,
      ),
    );
  };

  const handleLoadComments = async (reviewId: string) => {
    if (!currentOrg || loadingCommentsMap[reviewId]) return;
    setLoadingCommentsMap((prev) => ({ ...prev, [reviewId]: true }));
    try {
      const list = await api.community.getComments(currentOrg.organization.organizationId, reviewId);
      setReviewComments((prev) => ({ ...prev, [reviewId]: list }));
    } catch (err: any) {
      showToast(err.message || 'Failed to load comments', 'error');
    } finally {
      setLoadingCommentsMap((prev) => ({ ...prev, [reviewId]: false }));
    }
  };

  const handleAddComment = async (reviewId: string, text: string) => {
    if (!currentOrg) return;
    try {
      const newComment = await api.community.createComment(
        currentOrg.organization.organizationId,
        reviewId,
        { body: text },
      );
      setReviewComments((prev) => ({
        ...prev,
        [reviewId]: [...(prev[reviewId] || []), newComment],
      }));
      setReviews((prev) =>
        prev.map((r) =>
          r.reviewId === reviewId ? { ...r, commentsCount: r.commentsCount + 1 } : r,
        ),
      );
      showToast('Comment posted successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to post comment', 'error');
      throw err;
    }
  };

  const handleModerateReview = async (reviewId: string, status: ReviewStatus) => {
    if (!currentOrg) return;
    try {
      const updated = await api.community.moderateReview(
        currentOrg.organization.organizationId,
        reviewId,
        { status },
      );
      setReviews((prev) =>
        prev.map((r) => (r.reviewId === reviewId ? { ...r, status: updated.status } : r)),
      );
      showToast(`Review status updated to ${status}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update review status', 'error');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !currentLibrary || !newTitle.trim() || !newBody.trim()) return;

    setSubmittingReview(true);
    setReviewError(null);
    try {
      const created = await api.community.createReview(currentOrg.organization.organizationId, {
        bookId,
        libraryId: currentLibrary.libraryId,
        rating: newRating,
        title: newTitle.trim(),
        body: newBody.trim(),
      });
      setReviews((prev) => [created, ...prev]);
      setShowWriteModal(false);
      setNewTitle('');
      setNewBody('');
      setNewRating(5);
      showToast('Thank you! Your review has been published.', 'success');
      fetchReviewsAndEligibility();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to publish review');
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (!currentOrg || !currentLibrary || !bookId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    api.catalog
      .getBookDetails(currentOrg.organization.organizationId, currentLibrary.libraryId, bookId)
      .then((data) => {
        if (isMounted) setBook(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load book details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentOrg, currentLibrary, bookId]);

  if (loading) {
    return (
      <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
        <LoadingState message="Loading work details and physical copies..." />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div style={{ padding: '24px' }}>
        <Button variant="ghost" onClick={onBack} iconLeft={<ArrowLeft size={16} />}>
          Back to Catalog
        </Button>
        <div style={{ marginTop: '20px' }}>
          <ErrorState
            title="Book Not Found"
            message={error || 'Unable to retrieve conceptual work or edition details.'}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  const primaryCategory = book.categories[0]?.name || 'General';
  const getPaletteClass = (tag: string) => {
    const lower = tag.toLowerCase();
    if (lower.includes('nonfiction')) return 'nonfiction';
    if (lower.includes('mystery')) return 'mystery';
    if (lower.includes('thriller')) return 'thriller';
    if (lower.includes('sci') || lower.includes('space')) return 'scifi';
    return 'fiction';
  };
  const palette = getPaletteClass(primaryCategory);

  const authorsText = book.authors.map((a) => a.name).join(', ') || 'Unknown Author';
  const allCopies = (book.editions || []).flatMap((e) => e.copies || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Bar Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button variant="secondary" onClick={onBack} iconLeft={<ArrowLeft size={16} />}>
          Back to Catalog
        </Button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Chip>Library: {currentLibrary?.name}</Chip>
          <Chip active>{book.availableCopies} Copies Available</Chip>
        </div>
      </div>

      {/* Book Work Hero Card */}
      <Card
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '32px',
          padding: '32px',
          alignItems: 'start',
        }}
      >
        {/* Cover Art */}
        <div
          className={`cover-art ${palette}`}
          style={{
            width: '180px',
            height: '260px',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span className="cover-kicker" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
            {primaryCategory}
          </span>
          <strong style={{ fontSize: '20px', lineHeight: 1.2, fontFamily: 'var(--font-heading)' }}>
            {book.title}
          </strong>
          <span className="cover-author" style={{ fontSize: '13px', opacity: 0.9 }}>
            {authorsText}
          </span>
          <i className="cover-orbit" aria-hidden="true" />
        </div>

        {/* Work Metadata & Synopsis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {book.categories.map((c) => (
                <Chip key={c.categoryId}>{c.name}</Chip>
              ))}
              <StatusBadge status={book.availableCopies > 0 ? 'AVAILABLE' : 'LOANED'} />
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: '0 0 6px 0',
              }}
            >
              {book.title}
            </h1>
            {book.subtitle && (
              <p style={{ color: 'var(--muted)', fontSize: '16px', margin: '0 0 8px 0' }}>
                {book.subtitle}
              </p>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>
              Written by <strong style={{ color: 'var(--text)' }}>{authorsText}</strong> &bull; {book.publicationYear || 2021}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '20px',
              padding: '12px 16px',
              background: 'var(--canvas)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              width: 'fit-content',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Rating</span>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>★ {book.averageRating} / 5</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border)' }} />
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Reviews</span>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{book.reviewCount} readers</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border)' }} />
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Physical Copies</span>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)' }}>
                {book.availableCopies} avail / {book.totalCopies} total
              </div>
            </div>
          </div>

          {book.synopsis && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px 0' }}>
                Synopsis
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '14px', margin: 0 }}>
                {book.synopsis}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Published Editions Section */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', margin: '0 0 16px 0' }}>
          Published Editions ({book.editions?.length || 0})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {(book.editions || []).map((ed) => (
            <Card key={ed.editionId} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>
                    {ed.editionLabel} Edition
                  </h3>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {ed.format} &bull; {ed.language}
                  </span>
                </div>
                <Chip>₹{ed.replacementCost.toFixed(2)}</Chip>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={14} style={{ color: 'var(--muted)' }} />
                  <span>Publisher: <strong>{ed.publisher?.name || 'Standard'}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Barcode size={14} style={{ color: 'var(--muted)' }} />
                  <span>ISBN: <strong>{ed.isbn || 'N/A'}</strong></span>
                </div>
                {ed.publicationDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={14} style={{ color: 'var(--muted)' }} />
                    <span>Publication Date: <strong>{new Date(ed.publicationDate).toLocaleDateString()}</strong></span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={<BookmarkPlus size={14} />}
                  onClick={() => handleReserveEdition(ed.editionId, ed.editionLabel)}
                  disabled={reservingEditionId === ed.editionId}
                >
                  {reservingEditionId === ed.editionId ? 'Reserving...' : 'Place Hold'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Physical Copy Inventory for this Library */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', margin: '0 0 4px 0' }}>
              Physical Copies in {currentLibrary?.name}
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
              Physical copies tracked by unique barcode and rack/shelf logical locations.
            </p>
          </div>
        </div>

        {allCopies.length === 0 ? (
          <Card style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              No physical copies of this title are currently stocked at {currentLibrary?.name}.
            </p>
          </Card>
        ) : (
          <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--canvas)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Barcode</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Format</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Home Location</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Condition</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allCopies.map((copy) => {
                  const rackMatch = copy.homeLocation?.code.match(/F\d+-R([A-Z])/i);
                  const rackCode = rackMatch ? rackMatch[1].toUpperCase() : 'A';

                  return (
                    <tr key={copy.copyId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text)' }}>
                        {copy.barcode}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {copy.format}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} style={{ color: 'var(--accent)' }} />
                          <span>{copy.homeLocation?.name || copy.homeLocation?.code}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          Code: {copy.homeLocation?.code}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge status={copy.status} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <Chip>{copy.condition}</Chip>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {onLocateOnMap && (
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<MapPin size={13} />}
                            onClick={() => onLocateOnMap(rackCode)}
                          >
                            Locate on Map
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Community Reviews & Ratings Section */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', margin: 0 }}>
                Reader Reviews & Community Discussion
              </h2>
              {reviews.length > 0 && (
                <span
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    fontSize: '11px',
                    fontWeight: 750,
                    borderRadius: '999px',
                    padding: '2px 8px',
                  }}
                >
                  {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
              Honest critiques and ratings from fellow library readers and curators.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {eligibility && (
              <span
                style={{
                  fontSize: '11px',
                  color: eligibility.canReview ? 'var(--status-success-text)' : 'var(--muted)',
                  fontWeight: 650,
                }}
              >
                {eligibility.canReview
                  ? 'Eligible to review'
                  : eligibility.reason || 'Policy restricted'}
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              iconLeft={<PenLine size={14} />}
              onClick={() => {
                setReviewError(null);
                setShowWriteModal(true);
              }}
              disabled={eligibility ? !eligibility.canReview : false}
              title={eligibility?.reason}
            >
              Write Review
            </Button>
          </div>
        </div>

        {/* Reviews List */}
        {loadingReviews ? (
          <Card style={{ padding: '32px', textAlign: 'center' }}>
            <LoadingState message="Loading reader reviews and ratings..." />
          </Card>
        ) : reviews.length === 0 ? (
          <Card style={{ padding: '36px', textAlign: 'center' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--canvas)',
                display: 'inline-grid',
                placeItems: 'center',
                color: 'var(--muted)',
                marginBottom: '12px',
              }}
            >
              <MessageSquare size={20} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px' }}>No reviews yet</h3>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px', maxWidth: '380px', marginInline: 'auto' }}>
              Be the first reader to share your thoughts, critique, and rating for this work!
            </p>
            {eligibility?.canReview && (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<PenLine size={13} />}
                onClick={() => setShowWriteModal(true)}
              >
                Share Your Review
              </Button>
            )}
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {reviews.map((rev) => (
              <ReviewCard
                key={rev.reviewId}
                review={{
                  id: rev.reviewId,
                  title: rev.title,
                  author: rev.authorName,
                  excerpt: rev.body,
                  rating: rev.rating,
                  status: rev.status,
                  initialUpvotes: rev.upvotesCount,
                  initialDownvotes: rev.downvotesCount,
                  initialUserVote: rev.userVote as any,
                  commentsCount: rev.commentsCount,
                  createdAt: rev.createdAt,
                }}
                currentUserId={user?.userId}
                isStaff={isStaff}
                onVote={handleVoteReview}
                onComment={handleLoadComments}
                onAddComment={handleAddComment}
                onModerate={handleModerateReview}
                comments={reviewComments[rev.reviewId]}
                isLoadingComments={loadingCommentsMap[rev.reviewId]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Write Review Modal Dialog */}
      {showWriteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="write-review-title"
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '28px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <PenLine size={18} />
                </div>
                <div>
                  <h3 id="write-review-title" style={{ margin: 0, fontSize: '17px', fontWeight: 750 }}>
                    Write a Review
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Reviewing: <strong>{book.title}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowWriteModal(false)}
                aria-label="Close review modal"
              >
                <X size={18} />
              </button>
            </div>

            {reviewError && (
              <div
                style={{
                  background: 'color-mix(in srgb, var(--status-danger-text) 10%, transparent)',
                  border: '1px solid var(--status-danger-text)',
                  color: 'var(--status-danger-text)',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              >
                {reviewError}
              </div>
            )}

            <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Star Rating Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '6px' }}>
                  Your Rating
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      aria-label={`${star} star rating`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <Star
                        size={24}
                        fill={star <= newRating ? '#f59e0b' : 'none'}
                        stroke={star <= newRating ? '#f59e0b' : 'var(--muted)'}
                      />
                    </button>
                  ))}
                  <span style={{ fontSize: '13px', fontWeight: 700, marginLeft: '8px', color: 'var(--text)' }}>
                    {newRating}.0 / 5.0
                  </span>
                </div>
              </div>

              {/* Review Headline / Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '6px' }}>
                  Review Headline
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="e.g. A thrilling exploration of human resilience"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--canvas)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Review Body */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '6px' }}>
                  Your Detailed Critique
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Share what you liked, pacing, style, and who should read this work..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--canvas)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowWriteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={submittingReview || !newTitle.trim() || !newBody.trim()}
                  iconLeft={submittingReview ? <Loader2 size={14} className="animate-spin" /> : undefined}
                >
                  {submittingReview ? 'Publishing...' : 'Publish Review'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

