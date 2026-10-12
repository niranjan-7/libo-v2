import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { BookWorkDto } from '@library/contracts';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge, Chip } from '../ui/Pill';
import { LoadingState, ErrorState } from '../ui/StateIndicators';
import {
  ArrowLeft,
  MapPin,
  Building,
  Barcode,
  Calendar,
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
  const { currentOrg, currentLibrary } = useAuth();
  const [book, setBook] = useState<BookWorkDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
};
