import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  CollectionDto,
  BadgeDto,
  ReaderBadgeDto,
  ReviewPolicyConfigDto,
  CollectionVisibility,
  OrgRole,
} from '@library/contracts';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Pill, Chip } from '../ui/Pill';
import { LoadingState, ErrorState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import {
  FolderHeart,
  Award,
  Settings,
  Plus,
  Share2,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Check,
  Lock,
  Globe,
  EyeOff,
  ShieldAlert,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';

interface CommunityScreenProps {
  onSelectBook?: (bookId: string) => void;
}

export const CommunityScreen: React.FC<CommunityScreenProps> = ({ onSelectBook }) => {
  const { currentOrg, currentLibrary, currentRole, user } = useAuth();
  const { showToast } = useToast();

  const isStaff = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  const [activeSubTab, setActiveSubTab] = useState<'collections' | 'badges' | 'policies'>('collections');

  // Collections state
  const [collections, setCollections] = useState<CollectionDto[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<CollectionDto | null>(null);
  const [loadingCollections, setLoadingCollections] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>('');
  const [createDesc, setCreateDesc] = useState<string>('');
  const [createVisibility, setCreateVisibility] = useState<CollectionVisibility>('PUBLIC');
  const [submittingCollection, setSubmittingCollection] = useState<boolean>(false);
  const [reordering, setReordering] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Badges state
  const [badges, setBadges] = useState<BadgeDto[]>([]);
  const [myBadges, setMyBadges] = useState<ReaderBadgeDto[]>([]);
  const [loadingBadges, setLoadingBadges] = useState<boolean>(false);

  // Review Policy state
  const [policy, setPolicy] = useState<ReviewPolicyConfigDto | null>(null);
  const [requireBorrow, setRequireBorrow] = useState<boolean>(false);
  const [minAgeDays, setMinAgeDays] = useState<number>(0);
  const [savingPolicy, setSavingPolicy] = useState<boolean>(false);

  // Load Collections
  const fetchCollections = useCallback(async () => {
    if (!currentOrg) return;
    setLoadingCollections(true);
    try {
      const data = await api.community.getCollections(currentOrg.organization.organizationId);
      setCollections(data);
      if (selectedCollection) {
        const refreshed = await api.community.getCollectionDetails(
          currentOrg.organization.organizationId,
          selectedCollection.collectionId,
        );
        setSelectedCollection(refreshed);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load collections', 'error');
    } finally {
      setLoadingCollections(false);
    }
  }, [currentOrg, selectedCollection, showToast]);

  // Load Badges
  const fetchBadges = useCallback(async () => {
    if (!currentOrg) return;
    setLoadingBadges(true);
    try {
      const [allBadges, earned] = await Promise.all([
        api.community.getBadges(currentOrg.organization.organizationId),
        api.community.getMyBadges(currentOrg.organization.organizationId),
      ]);
      setBadges(allBadges);
      setMyBadges(earned);
    } catch (err: any) {
      showToast(err.message || 'Failed to load badges', 'error');
    } finally {
      setLoadingBadges(false);
    }
  }, [currentOrg, showToast]);

  // Load Policy
  const fetchPolicy = useCallback(async () => {
    if (!currentOrg || !currentLibrary) return;
    try {
      const p = await api.community.getPolicy(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
      );
      setPolicy(p);
      setRequireBorrow(p.requireBorrowHistory);
      setMinAgeDays(p.minAccountAgeDays);
    } catch (err: any) {
      showToast(err.message || 'Failed to load review policy', 'error');
    }
  }, [currentOrg, currentLibrary, showToast]);

  useEffect(() => {
    fetchCollections();
  }, [currentOrg]);

  useEffect(() => {
    if (activeSubTab === 'badges') {
      fetchBadges();
    } else if (activeSubTab === 'policies') {
      fetchPolicy();
    }
  }, [activeSubTab, fetchBadges, fetchPolicy]);

  // Select Collection details
  const handleOpenCollection = async (collId: string) => {
    if (!currentOrg) return;
    try {
      const details = await api.community.getCollectionDetails(
        currentOrg.organization.organizationId,
        collId,
      );
      setSelectedCollection(details);
    } catch (err: any) {
      showToast(err.message || 'Failed to open collection details', 'error');
    }
  };

  // Create Collection
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !createTitle.trim()) return;

    setSubmittingCollection(true);
    try {
      const created = await api.community.createCollection(currentOrg.organization.organizationId, {
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        visibility: createVisibility,
      });
      setCollections((prev) => [created, ...prev]);
      setSelectedCollection(created);
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateVisibility('PUBLIC');
      showToast('Collection created successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to create collection', 'error');
    } finally {
      setSubmittingCollection(false);
    }
  };

  // Reorder books atomically
  const handleMoveBook = async (index: number, direction: -1 | 1) => {
    if (!currentOrg || !selectedCollection || !selectedCollection.books) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedCollection.books.length) return;

    const reorderedList = [...selectedCollection.books];
    const temp = reorderedList[index];
    reorderedList[index] = reorderedList[targetIndex];
    reorderedList[targetIndex] = temp;

    const bookIds = reorderedList.map((b) => b.bookId);

    setReordering(true);
    try {
      const updated = await api.community.reorderCollectionBooks(
        currentOrg.organization.organizationId,
        selectedCollection.collectionId,
        bookIds,
      );
      setSelectedCollection(updated);
      showToast('Book sequence updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to reorder books', 'error');
    } finally {
      setReordering(false);
    }
  };

  // Remove book from collection
  const handleRemoveBook = async (bookId: string) => {
    if (!currentOrg || !selectedCollection) return;
    try {
      const updated = await api.community.removeBookFromCollection(
        currentOrg.organization.organizationId,
        selectedCollection.collectionId,
        bookId,
      );
      setSelectedCollection(updated);
      showToast('Book removed from collection', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove book', 'error');
    }
  };

  // Share deep link
  const handleShareCollection = (collId: string) => {
    const url = `${window.location.origin}?collectionId=${collId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(collId);
      showToast('Collection share link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(null), 2500);
    });
  };

  // Save Policy
  const handleSavePolicy = async () => {
    if (!currentOrg || !currentLibrary) return;
    setSavingPolicy(true);
    try {
      const updated = await api.community.updatePolicy(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        {
          requireBorrowHistory: requireBorrow,
          minAccountAgeDays: minAgeDays,
        },
      );
      setPolicy(updated);
      showToast('Branch review policy updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update review policy', 'error');
    } finally {
      setSavingPolicy(false);
    }
  };

  const isOwnerOfSelected = selectedCollection?.creatorUserId === user?.userId;
  const canEditSelected = isOwnerOfSelected || isStaff;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontFamily: 'var(--font-heading)' }}>
            Community, Collections & Badges
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
            Discover reader-curated collections, track reading badges, and manage community policies.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant={activeSubTab === 'collections' ? 'primary' : 'secondary'}
            size="sm"
            iconLeft={<FolderHeart size={14} />}
            onClick={() => { setActiveSubTab('collections'); setSelectedCollection(null); }}
          >
            Collections
          </Button>
          <Button
            variant={activeSubTab === 'badges' ? 'primary' : 'secondary'}
            size="sm"
            iconLeft={<Award size={14} />}
            onClick={() => setActiveSubTab('badges')}
          >
            Badges & Awards
          </Button>
          {isStaff && (
            <Button
              variant={activeSubTab === 'policies' ? 'primary' : 'secondary'}
              size="sm"
              iconLeft={<Settings size={14} />}
              onClick={() => setActiveSubTab('policies')}
            >
              Review Policies
            </Button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: COLLECTIONS */}
      {activeSubTab === 'collections' && (
        <div>
          {selectedCollection ? (
            /* Selected Collection Detail View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedCollection(null)}
                >
                  &larr; Back to All Collections
                </Button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={copiedLink === selectedCollection.collectionId ? <Check size={14} /> : <Share2 size={14} />}
                    onClick={() => handleShareCollection(selectedCollection.collectionId)}
                  >
                    {copiedLink === selectedCollection.collectionId ? 'Link Copied' : 'Share Deep Link'}
                  </Button>
                </div>
              </div>

              {/* Collection Banner Card */}
              <Card style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className="pill green">
                        {selectedCollection.visibility === 'PUBLIC' && <Globe size={12} />}
                        {selectedCollection.visibility === 'PRIVATE' && <Lock size={12} />}
                        {selectedCollection.visibility === 'UNLISTED' && <EyeOff size={12} />}
                        {selectedCollection.visibility}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Curated by <strong>{selectedCollection.creatorName || 'Reader'}</strong>
                        {isOwnerOfSelected && ' (You)'}
                      </span>
                    </div>

                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px' }}>
                      {selectedCollection.title}
                    </h2>
                    {selectedCollection.description && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                        {selectedCollection.description}
                      </p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)' }}>
                      {selectedCollection.books?.length || 0}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Curated Titles</div>
                  </div>
                </div>
              </Card>

              {/* Ordered Book Items */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 750, margin: '0 0 12px' }}>
                  Curated Titles & Sequence
                </h3>

                {(!selectedCollection.books || selectedCollection.books.length === 0) ? (
                  <Card style={{ padding: '32px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--muted)', margin: 0 }}>
                      No books have been added to this collection yet. Browse the catalog to curate titles!
                    </p>
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedCollection.books.map((b, idx) => (
                      <Card
                        key={b.bookId}
                        style={{
                          padding: '16px 20px',
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto',
                          gap: '16px',
                          alignItems: 'center',
                        }}
                      >
                        {/* Position Indicator */}
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'var(--canvas)',
                            border: '1px solid var(--border)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '13px',
                            fontWeight: 800,
                            color: 'var(--accent)',
                          }}
                        >
                          #{b.position}
                        </div>

                        {/* Book Metadata */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong
                              style={{
                                fontSize: '14px',
                                color: 'var(--text)',
                                cursor: onSelectBook ? 'pointer' : 'default',
                              }}
                              onClick={() => onSelectBook && onSelectBook(b.bookId)}
                            >
                              {b.title}
                            </strong>
                            {b.availableCopies > 0 ? (
                              <Pill variant="green">{b.availableCopies} Copies Available</Pill>
                            ) : (
                              <Pill variant="yellow">On Loan</Pill>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                            {b.authors.map((a) => a.name).join(', ') || 'Unknown Author'}
                          </div>
                        </div>

                        {/* Reordering Controls & Actions */}
                        {canEditSelected && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={idx === 0 || reordering}
                              onClick={() => handleMoveBook(idx, -1)}
                              title="Move book up in sequence"
                              aria-label="Move up"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={idx === (selectedCollection.books?.length || 0) - 1 || reordering}
                              onClick={() => handleMoveBook(idx, 1)}
                              title="Move book down in sequence"
                              aria-label="Move down"
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              style={{ color: 'var(--status-danger-text)' }}
                              onClick={() => handleRemoveBook(b.bookId)}
                              title="Remove from collection"
                              aria-label="Remove book"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* All Collections Cards List */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 750, margin: 0 }}>
                  Active Book Collections ({collections.length})
                </h2>
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={<Plus size={14} />}
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Collection
                </Button>
              </div>

              {loadingCollections ? (
                <Card style={{ padding: '32px', textAlign: 'center' }}>
                  <LoadingState message="Loading community collections..." />
                </Card>
              ) : collections.length === 0 ? (
                <Card style={{ padding: '36px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'var(--canvas)',
                      display: 'inline-grid',
                      placeItems: 'center',
                      color: 'var(--muted)',
                      marginBottom: '12px',
                    }}
                  >
                    <FolderHeart size={22} />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px' }}>
                    No collections yet
                  </h3>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px' }}>
                    Curate your favorite books, reading lists, or study paths and share them with the library community.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={<Plus size={14} />}
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Collection
                  </Button>
                </Card>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {collections.map((coll) => (
                    <Card
                      key={coll.collectionId}
                      style={{
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onClick={() => handleOpenCollection(coll.collectionId)}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span className="pill neutral" style={{ fontSize: '10px' }}>
                            {coll.visibility}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {coll.bookCount} {coll.bookCount === 1 ? 'Book' : 'Books'}
                          </span>
                        </div>

                        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 750, color: 'var(--text)' }}>
                          {coll.title}
                        </h3>
                        {coll.description && (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, lineClamp: 2 }}>
                            {coll.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          By {coll.creatorName || 'Reader'}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Copy share link"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareCollection(coll.collectionId);
                            }}
                          >
                            <Share2 size={13} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: BADGES & ACHIEVEMENTS */}
      {activeSubTab === 'badges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 750, margin: '0 0 4px' }}>
              Your Earned Badges ({myBadges.length})
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
              Recognitions awarded for borrowing milestones, insightful reviews, and curating public collections.
            </p>
          </div>

          {loadingBadges ? (
            <Card style={{ padding: '32px', textAlign: 'center' }}>
              <LoadingState message="Loading your badges and milestones..." />
            </Card>
          ) : myBadges.length === 0 ? (
            <Card style={{ padding: '28px', textAlign: 'center' }}>
              <Award size={28} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
              <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
                You have not earned any community badges yet. Check out a book, write a review, or create a public collection to unlock achievements!
              </p>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {myBadges.map((b) => (
                <Card
                  key={b.badgeId}
                  style={{
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--accent)',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Award size={22} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '14px', display: 'block', color: 'var(--text)' }}>
                      {b.name}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                      {b.description}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 650, marginTop: '2px', display: 'block' }}>
                      Earned {new Date(b.earnedAt).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* All System Badges Directory */}
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, margin: '0 0 12px' }}>
              All System Badges Catalog
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {badges.map((b) => {
                const isEarned = myBadges.some((mb) => mb.code === b.code);
                return (
                  <Card key={b.badgeId} style={{ padding: '18px', opacity: isEarned ? 1 : 0.75 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{b.name}</strong>
                      <span className={`pill ${isEarned ? 'green' : 'neutral'}`} style={{ fontSize: '10px' }}>
                        {isEarned ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4 }}>
                      {b.description}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: REVIEW POLICIES (STAFF ONLY) */}
      {activeSubTab === 'policies' && isStaff && (
        <Card style={{ padding: '28px', maxWidth: '640px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 750, margin: '0 0 6px' }}>
            Branch Review & Community Policies
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 24px' }}>
            Configure eligibility criteria for reader book critiques at {currentLibrary?.name}.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requireBorrow}
                onChange={(e) => setRequireBorrow(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
              />
              <div>
                <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text)' }}>
                  Require Prior Borrowing History
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Readers must have checked out a copy of this title before they are allowed to submit a review.
                </span>
              </div>
            </label>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 650, marginBottom: '6px' }}>
                Minimum Account Age (Days)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={minAgeDays}
                onChange={(e) => setMinAgeDays(Number(e.target.value))}
                style={{
                  width: '140px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--canvas)',
                  color: 'var(--text)',
                  fontSize: '13px',
                }}
              />
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                Require user membership to be active for at least this many days before writing reviews (0 = disabled).
              </span>
            </div>

            <div style={{ marginTop: '8px' }}>
              <Button
                variant="primary"
                onClick={handleSavePolicy}
                disabled={savingPolicy}
                iconLeft={savingPolicy ? <Loader2 size={14} className="animate-spin" /> : undefined}
              >
                {savingPolicy ? 'Saving Policy...' : 'Save Policy Changes'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* CREATE COLLECTION MODAL */}
      {showCreateModal && (
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
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '28px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 750 }}>
                Create Book Collection
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '6px' }}>
                  Collection Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Essential Modern Sci-Fi"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
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

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell readers about the theme and reasons behind this list..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
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

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '6px' }}>
                  Visibility
                </label>
                <select
                  value={createVisibility}
                  onChange={(e) => setCreateVisibility(e.target.value as CollectionVisibility)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--canvas)',
                    color: 'var(--text)',
                    fontSize: '13px',
                  }}
                >
                  <option value="PUBLIC">Public (Visible in Community Catalog & unlocks Curator badge)</option>
                  <option value="PRIVATE">Private (Visible only to you)</option>
                  <option value="UNLISTED">Unlisted (Accessible only via shared deep link)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={submittingCollection || !createTitle.trim()}
                  iconLeft={submittingCollection ? <Loader2 size={14} className="animate-spin" /> : undefined}
                >
                  {submittingCollection ? 'Creating...' : 'Create Collection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
