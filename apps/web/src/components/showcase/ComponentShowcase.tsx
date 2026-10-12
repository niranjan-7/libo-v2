import React, { useState } from 'react';
import { Heading, Text, Eyebrow, Kicker } from '../ui/Typography';
import { Button, IconButton } from '../ui/Button';
import { FormField, TextInput, SearchInput, Select, Textarea } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { Pill, StatusBadge, Chip } from '../ui/Pill';
import { Card, KpiCard } from '../ui/Card';
import { BookCard, BookItem } from '../ui/BookCard';
import { ReviewCard, ReviewItem } from '../ui/ReviewCard';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../ui/Table';
import { Tabs, TabPanel } from '../ui/Tabs';
import { Dialog } from '../ui/Dialog';
import { NoticeBox } from '../ui/Notice';
import { EmptyState, LoadingState, ErrorState, ProgressBar } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import { useTheme } from '../../theme/ThemeContext';
import {
  Palette,
  Moon,
  Sun,
  Plus,
  Trash2,
  Bookmark,
  Share2,
  CheckCircle,
  AlertTriangle,
  Info,
  BookOpen,
  Library,
  Users,
  Settings,
  Shield,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { AppearanceDrawer } from '../theme/AppearanceDrawer';

const SAMPLE_BOOKS: BookItem[] = [
  {
    id: 1,
    title: 'The Midnight Library',
    author: 'Matt Haig',
    year: 2020,
    tag: 'Fiction',
    status: 'Available',
    copies: 4,
    rating: '4.4',
    isbn: '978-0-00-000000-0',
  },
  {
    id: 2,
    title: 'The Library Book',
    author: 'Susan Orlean',
    year: 2018,
    tag: 'Nonfiction',
    status: 'On loan',
    copies: 2,
    rating: '4.2',
    isbn: '978-1-00-000000-1',
  },
  {
    id: 3,
    title: 'The Shadow of the Wind',
    author: 'Carlos Ruiz Zafón',
    year: 2005,
    tag: 'Mystery',
    status: 'Waitlist',
    copies: 0,
    rating: '4.5',
    isbn: '978-1-00-000000-2',
  },
  {
    id: 4,
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    year: 2021,
    tag: 'Science Fiction',
    status: 'Available',
    copies: 3,
    rating: '4.7',
    isbn: '978-1-00-000000-5',
  },
];

const SAMPLE_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1',
    title: 'A thoughtful, hopeful read',
    author: 'Maya R. &bull; The Midnight Library',
    excerpt: 'A moving story about second chances and the lives we might have lived. The narrative balance of wonder and philosophy stayed with me for weeks.',
    initialUpvotes: 18,
    initialDownvotes: 1,
  },
  {
    id: 'rev-2',
    title: 'Fast-paced science adventure',
    author: 'Arun S. &bull; Project Hail Mary',
    excerpt: 'Imaginative, warm, and surprisingly emotional. The technical problems are solving puzzles with heart and high stakes.',
    initialUpvotes: 24,
    initialDownvotes: 2,
  },
];

export const ComponentShowcase: React.FC = () => {
  const { showToast } = useToast();
  const { theme, toggleDarkMode } = useTheme();

  // State controls for interactive test elements
  const [activeTab, setActiveTab] = useState('components');
  const [searchVal, setSearchVal] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [switchVal, setSwitchVal] = useState(true);
  const [progressVal, setProgressVal] = useState(68);
  const [viewportWidth, setViewportWidth] = useState<'full' | 'mobile'>('full');

  const tabs = [
    { id: 'components', label: 'Component Gallery' },
    { id: 'books', label: 'Editorial Book Cards' },
    { id: 'feedback', label: 'Feedback & States' },
    { id: 'tables', label: 'Tables & Layout' },
  ];

  return (
    <div
      style={{
        maxWidth: viewportWidth === 'mobile' ? '410px' : '1450px',
        margin: '0 auto',
        padding: '24px 20px 80px',
        transition: 'max-width 0.3s ease',
      }}
    >
      {/* Showcase Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          marginBottom: '28px',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-logo" style={{ width: '34px', height: '34px', fontSize: '16px' }}>
            UI
          </div>
          <div>
            <strong style={{ fontSize: '14px', display: 'block' }}>Design System & Component Showcase</strong>
            <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
              Recreated from library_platform_interactive_prototype_v2.html
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Viewport Width Switcher */}
          <Button
            variant={viewportWidth === 'full' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewportWidth('full')}
            iconLeft={<Laptop size={14} />}
          >
            Desktop (Full)
          </Button>

          <Button
            variant={viewportWidth === 'mobile' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewportWidth('mobile')}
            iconLeft={<Smartphone size={14} />}
          >
            Mobile (390px)
          </Button>

          {/* Theme & Dark Mode Controls */}
          <IconButton
            aria-label="Toggle theme appearance"
            title="Appearance settings"
            onClick={() => setIsAppearanceOpen(true)}
          >
            <Palette size={16} />
          </IconButton>

          <IconButton
            aria-label="Toggle dark mode"
            title="Dark mode"
            onClick={toggleDarkMode}
          >
            {theme.darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: Core Components Gallery */}
      <TabPanel id="components" activeTab={activeTab}>
        {/* Typography Section */}
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>CORE PRIMITIVES</Eyebrow>
          <Heading level={2}>Typography & Eyebrows</Heading>
          <Text muted size="small">
            Hierarchical typography using Inter system fonts with calibrated line-heights and negative letter-spacing.
          </Text>

          <Card style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <Kicker>COLLECTION KICKER</Kicker>
                <Heading level={1}>Heading Level 1 &bull; 34px Display</Heading>
                <Text size="base">
                  Standard body text at 14px. Designed for legibility in dense catalog views, search results, and patron account dashboards.
                </Text>
              </div>

              <div>
                <Heading level={2}>Heading Level 2 &bull; 20px Section Title</Heading>
                <Text size="small" muted>
                  Small muted text at 12px for bylines, metadata, and helper instructions.
                </Text>
              </div>

              <div>
                <Heading level={3}>Heading Level 3 &bull; 15px Card Heading</Heading>
                <Text size="tiny" muted>
                  Tiny text at 11px for timestamps, tags, and caption footnotes.
                </Text>
              </div>
            </div>
          </Card>
        </section>

        {/* Buttons & Icon Buttons */}
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>ACTIONS & TARGETS</Eyebrow>
          <Heading level={2}>Buttons & Touch Targets</Heading>
          <Text muted size="small">
            Variants with hover lift, active scale down, loading state spinners, and min-touch bounds ($&ge;38$px).
          </Text>

          <Card style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="primary" iconLeft={<Plus size={14} />}>
                Primary Button
              </Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="danger" iconLeft={<Trash2 size={14} />}>
                Danger Button
              </Button>
              <Button variant="primary" isLoading>
                Loading State
              </Button>
              <Button disabled>Disabled Button</Button>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
              <Button size="sm" variant="primary">Small (30px)</Button>
              <Button size="md" variant="primary">Medium (38px)</Button>
              <Button size="lg" variant="primary">Large (46px)</Button>
              <IconButton aria-label="Bookmark title" hasBadge>
                <Bookmark size={16} />
              </IconButton>
              <IconButton aria-label="Share title">
                <Share2 size={16} />
              </IconButton>
              <IconButton aria-label="Settings" variant="ghost">
                <Settings size={16} />
              </IconButton>
            </div>
          </Card>
        </section>

        {/* Form Inputs & Controls */}
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>FORM CONTROLS</Eyebrow>
          <Heading level={2}>Inputs, Searchbars & Switches</Heading>
          <Text muted size="small">
            Accessible forms with focus ring tokens, searchbar clears, and switch toggles.
          </Text>

          <Card style={{ marginTop: '14px' }}>
            <div className="grid-2">
              <div>
                <FormField label="Standard Text Input" hint="Provide a valid catalog title" required>
                  <TextInput placeholder="e.g. Clean Code" />
                </FormField>

                <FormField label="Search Bar with Clear Action">
                  <SearchInput
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    onClear={() => setSearchVal('')}
                    placeholder="Search books, authors, ISBNs..."
                  />
                </FormField>

                <FormField label="Dropdown Select">
                  <Select
                    options={[
                      { value: 'central', label: 'Central Library &bull; Main Branch' },
                      { value: 'west', label: 'West Campus Library' },
                      { value: 'children', label: "Children's Community Library" },
                    ]}
                  />
                </FormField>
              </div>

              <div>
                <FormField label="Textarea for Reviews or Notes" hint="Markdown formatting accepted">
                  <Textarea placeholder="Share your thoughts on this edition..." />
                </FormField>

                <FormField label="Validation Error Example" error="Barcode CP-999 is already assigned">
                  <TextInput error defaultValue="CP-999" />
                </FormField>

                <div style={{ paddingTop: '8px' }}>
                  <Switch
                    checked={switchVal}
                    onChange={setSwitchVal}
                    label="Automatic renewal notifications"
                    description="Sends notification 48 hours prior to due date"
                  />
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Badges, Pills & Chips */}
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>STATUS TAXONOMY</Eyebrow>
          <Heading level={2}>Status Badges, Pills & Filter Chips</Heading>
          <Text muted size="small">
            Semantic state representations matching the approved design palette.
          </Text>

          <Card style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
              <StatusBadge status="Available" />
              <StatusBadge status="Ready for pickup" />
              <StatusBadge status="On loan" />
              <StatusBadge status="Waitlisted" />
              <StatusBadge status="Overdue" />
              <StatusBadge status="Damaged" />
              <Pill variant="neutral" hasDot>Draft Layout</Pill>
              <Pill variant="green" hasDot>Online</Pill>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Chip
                active={selectedFilter === 'all'}
                count={12}
                onClick={() => setSelectedFilter('all')}
              >
                All books
              </Chip>
              <Chip
                active={selectedFilter === 'available'}
                count={8}
                onClick={() => setSelectedFilter('available')}
              >
                Available now
              </Chip>
              <Chip
                active={selectedFilter === 'fiction'}
                count={5}
                onClick={() => setSelectedFilter('fiction')}
              >
                Fiction
              </Chip>
              <Chip
                active={selectedFilter === 'nonfiction'}
                count={3}
                onClick={() => setSelectedFilter('nonfiction')}
              >
                Nonfiction
              </Chip>
            </div>
          </Card>
        </section>

        {/* KPI Cards */}
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>DASHBOARD METRICS</Eyebrow>
          <Heading level={2}>KPI Statistic Cards</Heading>
          <Text muted size="small">
            Bold numbers with uppercase labels and trend indicators.
          </Text>

          <div className="kpis-grid">
            <KpiCard
              label="ACTIVE LOANS"
              value="2 / 5"
              caption="Next due in 6 days"
              icon={<BookOpen size={18} />}
            />
            <KpiCard
              label="WALLET BALANCE"
              value="₹420.00"
              caption="Demo credits"
              trend={{ value: "+₹200.00", positive: true }}
            />
            <KpiCard
              label="ACTIVE BRANCHES"
              value="2 / 3"
              caption="1 slot remaining"
              icon={<Library size={18} />}
            />
            <KpiCard
              label="TOTAL PATRONS"
              value="146"
              caption="Across organization"
              icon={<Users size={18} />}
            />
          </div>
        </section>
      </TabPanel>

      {/* TAB 2: Book Cards & Reviews */}
      <TabPanel id="books" activeTab={activeTab}>
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>EDITORIAL SHELF</Eyebrow>
          <Heading level={2}>Improved Modern Library Book Cards</Heading>
          <Text muted size="small">
            Cover-art gradients, Georgia serif titles, orbit geometries, ratings, and copy counts.
          </Text>

          <div className="grid-2" style={{ marginTop: '16px' }}>
            {SAMPLE_BOOKS.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                onExplore={(item) =>
                  showToast(`Selected title: ${item.title}`, 'info')
                }
              />
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>SOCIAL DISCOVERY</Eyebrow>
          <Heading level={2}>Reader Reviews & Voting</Heading>
          <Text muted size="small">
            Accessible helpful voting with pressed state toggles and discussion triggers.
          </Text>

          <div className="grid-2" style={{ marginTop: '16px' }}>
            {SAMPLE_REVIEWS.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                onComment={(id) => showToast(`Opening comments for ${id}`, 'info')}
                onShare={(id) => showToast(`Review link copied for ${id}`, 'success')}
              />
            ))}
          </div>
        </section>
      </TabPanel>

      {/* TAB 3: Feedback & States */}
      <TabPanel id="feedback" activeTab={activeTab}>
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>NOTIFICATIONS & ALERTS</Eyebrow>
          <Heading level={2}>Notice Boxes & Toast Feedback</Heading>
          <Text muted size="small">
            Semantic alerts with accessible ARIA live regions and auto-dismissing toasts.
          </Text>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
            <NoticeBox variant="warn" title="Policy Notice">
              Currency, fine rates, and waiver rules are pending administrative sign-off. Values are illustrative.
            </NoticeBox>

            <NoticeBox variant="info" title="Tenant Database Isolated">
              This organization operates on a dedicated PostgreSQL tenant database. Cross-organization queries are blocked.
            </NoticeBox>

            <NoticeBox variant="success" title="Loan Extension Granted">
              Due date successfully updated to October 22, 2026. Extension fee debited from wallet.
            </NoticeBox>

            <NoticeBox variant="danger" title="Overdue Fine Accumulated">
              A daily overdue fine has been applied. Please return item to avoid borrowing suspension.
            </NoticeBox>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <Button
              variant="primary"
              onClick={() => showToast('Action completed successfully!', 'success')}
            >
              Trigger Success Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => showToast('Reservation placed in queue position #2', 'info')}
            >
              Trigger Info Toast
            </Button>
            <Button
              variant="danger"
              onClick={() => showToast('Failed to check out: copy is reserved', 'error')}
            >
              Trigger Error Toast
            </Button>
          </div>
        </section>

        {/* Empty, Loading, and Error States */}
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>STATE INDICATORS</Eyebrow>
          <Heading level={2}>Empty, Loading & Error States</Heading>
          <Text muted size="small">
            Clean fallback layouts when records are missing, fetching, or failing.
          </Text>

          <div className="grid-2" style={{ marginTop: '14px' }}>
            <EmptyState
              title="This shelf is currently empty"
              description="No physical copies are presently assigned to Rack A, Shelf 4. Scan barcodes to reshelve items here."
              action={{
                label: 'Scan Items',
                onClick: () => showToast('Opening scanner...', 'info'),
              }}
            />

            <ErrorState
              title="Database connection timed out"
              message="Could not reach the tenant database replica. Verify local network connection."
              onRetry={() => showToast('Retrying tenant database connection...', 'info')}
            />
          </div>

          <Card style={{ marginTop: '16px' }}>
            <LoadingState
              message="Fetching live circulation records..."
              submessage="Synchronizing with isolated tenant database"
            />
          </Card>

          <Card style={{ marginTop: '16px' }}>
            <Heading level={3}>Progress Bar</Heading>
            <ProgressBar value={progressVal} label="Reading Goal Progress (17 / 25)" />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <Button size="sm" onClick={() => setProgressVal((v) => Math.max(0, v - 10))}>- 10%</Button>
              <Button size="sm" onClick={() => setProgressVal((v) => Math.min(100, v + 10))}>+ 10%</Button>
            </div>
          </Card>
        </section>

        {/* Dialog / Modal Trigger */}
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>OVERLAYS</Eyebrow>
          <Heading level={2}>Modal Dialogs & Drawers</Heading>
          <Text muted size="small">
            Focus-trapped dialogs with blur backdrops and escape key dismissal.
          </Text>

          <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
            <Button variant="primary" onClick={() => setIsDialogOpen(true)}>
              Open Demo Dialog
            </Button>
            <Button variant="secondary" onClick={() => setIsAppearanceOpen(true)}>
              Open Appearance Drawer
            </Button>
          </div>

          <Dialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            title="Reserve Physical Copy"
            description="Central Library &bull; Rack A, Shelf 2"
            icon={<BookOpen size={20} />}
            footer={
              <>
                <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsDialogOpen(false);
                    showToast('Reservation confirmed! Hold window starts upon delivery.', 'success');
                  }}
                >
                  Confirm Hold
                </Button>
              </>
            }
          >
            <Text size="base">
              You are requesting <strong>The Midnight Library</strong> (Paperback edition). A notification will be dispatched when this copy is placed on the reservation shelf.
            </Text>
            <NoticeBox variant="info" style={{ marginTop: '12px' }}>
              Standard pickup window is 72 hours from notification delivery.
            </NoticeBox>
          </Dialog>
        </section>
      </TabPanel>

      {/* TAB 4: Tables & Data Display */}
      <TabPanel id="tables" activeTab={activeTab}>
        <section style={{ marginBottom: '36px' }}>
          <Eyebrow>DATA GRID</Eyebrow>
          <Heading level={2}>Responsive Tables</Heading>
          <Text muted size="small">
            Data table with horizontal overflow wrapper, uppercase headers, hover rows, and status badges.
          </Text>

          <Table style={{ marginTop: '14px' }}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Book Title & Author</TableHeaderCell>
                <TableHeaderCell>Copy Barcode</TableHeaderCell>
                <TableHeaderCell>Physical Location</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell style={{ textAlign: 'right' }}>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <strong className="table-title">The Midnight Library</strong>
                  <br />
                  <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Matt Haig &bull; Paperback</span>
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace' }}>CP-00142</TableCell>
                <TableCell>Floor 1 &bull; Rack A &bull; Shelf 2</TableCell>
                <TableCell><StatusBadge status="Available" /></TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  <Button size="sm" variant="secondary" onClick={() => showToast('Inspecting CP-00142', 'info')}>
                    View Copy
                  </Button>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <strong className="table-title">The Library Book</strong>
                  <br />
                  <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Susan Orlean &bull; Hardcover</span>
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace' }}>CP-00088</TableCell>
                <TableCell>On Loan &bull; Maya R.</TableCell>
                <TableCell><StatusBadge status="On loan" /></TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  <Button size="sm" variant="secondary" onClick={() => showToast('Inspecting CP-00088', 'info')}>
                    View Loan
                  </Button>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <strong className="table-title">Dune</strong>
                  <br />
                  <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Frank Herbert &bull; Paperback</span>
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace' }}>CP-00234</TableCell>
                <TableCell>Service Desk &bull; Inspection</TableCell>
                <TableCell><StatusBadge status="Damaged" /></TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  <Button size="sm" variant="secondary" onClick={() => showToast('Reviewing exception...', 'info')}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>
      </TabPanel>

      {/* Slide-out Appearance Drawer */}
      <AppearanceDrawer
        isOpen={isAppearanceOpen}
        onClose={() => setIsAppearanceOpen(false)}
      />
    </div>
  );
};
