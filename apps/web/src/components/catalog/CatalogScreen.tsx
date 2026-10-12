import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { BookWorkDto } from '@library/contracts';
import { BookCard } from '../ui/BookCard';
import { TextInput, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Pill';
import { Card } from '../ui/Card';
import { LoadingState, EmptyState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import { Search, Sparkles, RefreshCw } from 'lucide-react';

interface CatalogScreenProps {
  onSelectBook: (bookId: string) => void;
  onLocateRack?: (rackCode: string) => void;
}

const CATEGORIES = [
  'All',
  'Fiction',
  'Nonfiction',
  'Science Fiction',
  'Thriller',
  'Mystery',
];

export const CatalogScreen: React.FC<CatalogScreenProps> = ({ onSelectBook }) => {
  const { currentOrg, currentLibrary } = useAuth();
  const { showToast } = useToast();

  const [books, setBooks] = useState<BookWorkDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available'>('all');
  const [sortOption, setSortOption] = useState<'relevance' | 'title' | 'year'>('relevance');

  const fetchCatalog = useCallback(async () => {
    if (!currentOrg || !currentLibrary) return;

    setLoading(true);
    try {
      const res = await api.catalog.search(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        {
          search: searchTerm || undefined,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          sort: sortOption,
          limit: 50,
        },
      );
      setBooks(res.items);
      setTotal(res.total);
    } catch (err: any) {
      showToast(err.message || 'Failed to load catalog', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, currentLibrary, searchTerm, selectedCategory, statusFilter, sortOption, showToast]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleSeedDemo = async () => {
    if (!currentOrg || !currentLibrary) return;
    setSeeding(true);
    try {
      await api.catalog.seedDemo(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
      );
      showToast('Demo catalog and floor racks seeded successfully!', 'success');
      await fetchCatalog();
    } catch (err: any) {
      showToast(err.message || 'Failed to seed demo catalog', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: '0 0 6px 0',
            }}
          >
            Catalog & Search
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
            Browse conceptual titles and inspect live copy inventory for <strong>{currentLibrary?.name}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchCatalog}
            disabled={loading}
            iconLeft={<RefreshCw size={14} className={loading ? 'spin' : ''} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSeedDemo}
            disabled={seeding}
            iconLeft={<Sparkles size={14} />}
          >
            {seeding ? 'Seeding...' : 'Seed Demo Data'}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center' }}>
          <TextInput
            placeholder="Search by work title, author name, or ISBN..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            prefixIcon={<Search size={16} />}
          />

          <div style={{ width: '180px' }}>
            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as 'all' | 'available')}
              options={[
                { value: 'all', label: 'All Availability' },
                { value: 'available', label: 'In Stock Only' },
              ]}
            />
          </div>

          <div style={{ width: '180px' }}>
            <Select
              value={sortOption}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortOption(e.target.value as any)}
              options={[
                { value: 'relevance', label: 'Sort: Relevance' },
                { value: 'title', label: 'Sort: Title (A-Z)' },
                { value: 'year', label: 'Sort: Newest First' },
              ]}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginRight: '4px' }}>
            Genres:
          </span>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              active={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Chip>
          ))}
        </div>
      </Card>

      {/* Catalog Results Grid */}
      {loading ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <LoadingState message="Searching library catalog..." />
        </div>
      ) : books.length === 0 ? (
        <EmptyState
          title="No Books Found"
          description={
            searchTerm || selectedCategory !== 'All'
              ? 'No books match your active filter criteria. Try adjusting your search term or category.'
              : 'This library currently has no books in its catalog. Seed demo data to populate titles, shelves, and physical copies.'
          }
          action={{
            label: 'Seed Demo Catalog',
            onClick: handleSeedDemo,
          }}
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Showing <strong>{books.length}</strong> of <strong>{total}</strong> works
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '24px',
            }}
          >
            {books.map((b) => {
              const primaryAuthor = b.authors[0]?.name || 'Unknown Author';
              const primaryCategory = b.categories[0]?.name || 'Fiction';
              const bookItem = {
                id: b.bookId,
                title: b.title,
                author: primaryAuthor,
                year: b.publicationYear || 2021,
                tag: primaryCategory,
                status: b.availableCopies > 0 ? 'Available' : 'On loan',
                copies: b.availableCopies,
                rating: b.averageRating.toFixed(1),
              };

              return (
                <BookCard
                  key={b.bookId}
                  book={bookItem}
                  onExplore={() => onSelectBook(b.bookId)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
