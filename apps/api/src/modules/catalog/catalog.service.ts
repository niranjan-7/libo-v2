import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import {
  BookWorkDto,
  BookEditionDto,
  BookCopyDto,
  CatalogSearchResponse,
  FloorPlanResponse,
  RackDetailResponse,
  InventoryStatsResponse,
  CopyStatus,
  CopyCondition,
} from '@library/contracts';
import { CatalogQueryDto, CreateBookCopyDto, InventoryQueryDto } from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly tenantConnectionService: TenantConnectionService) {}

  /**
   * Searches the conceptual book catalog with library-scoped copy counts.
   * If the catalog is completely empty, it automatically seeds initial demo data.
   */
  async searchCatalog(
    organizationId: string,
    libraryId: string,
    query: CatalogQueryDto,
  ): Promise<CatalogSearchResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // Auto-seed initial catalog if library has 0 books
    const bookCountRes = await tenantDs.query(`SELECT COUNT(*) as count FROM "books"`);
    if (parseInt(bookCountRes[0]?.count || '0', 10) === 0) {
      await this.seedLibraryDemoCatalog(tenantDs, libraryId);
    }

    const { search, category, status, sort = 'relevance', limit = 20, offset = 0 } = query;

    // 1. Build Query
    const filterClauses: string[] = [`b.status = 'ACTIVE'`];
    const filterParams: any[] = [];
    let pIdx = 1;

    if (search && search.trim()) {
      filterParams.push(`%${search.trim().toLowerCase()}%`);
      filterClauses.push(`(
        LOWER(b.title) LIKE $${pIdx} OR
        LOWER(COALESCE(a.name, '')) LIKE $${pIdx} OR
        LOWER(COALESCE(e.isbn, '')) LIKE $${pIdx}
      )`);
      pIdx++;
    }

    if (category && category !== 'all') {
      filterParams.push(category.toLowerCase());
      filterClauses.push(`LOWER(COALESCE(cat.name, '')) = $${pIdx}`);
      pIdx++;
    }

    let orderBy = 'b.created_at DESC';
    if (sort === 'title') orderBy = 'b.title ASC';
    else if (sort === 'year') orderBy = 'b.created_at DESC';

    const baseSql = `
      FROM "books" b
      LEFT JOIN "book_authors" ba ON ba.book_id = b.book_id
      LEFT JOIN "authors" a ON a.author_id = ba.author_id
      LEFT JOIN "book_categories" bc ON bc.book_id = b.book_id
      LEFT JOIN "categories" cat ON cat.category_id = bc.category_id
      LEFT JOIN "book_editions" e ON e.book_id = b.book_id
      WHERE ${filterClauses.join(' AND ')}
    `;

    // 2. Count distinct books
    const countSql = `SELECT COUNT(DISTINCT b.book_id) as total ${baseSql}`;
    const countRes = await tenantDs.query(countSql, filterParams);
    const total = parseInt(countRes[0]?.total || '0', 10);

    // 3. Fetch books with aggregated authors, categories, and copy counts for THIS library
    const libParamIdx = pIdx;
    const limitParamIdx = pIdx + 1;
    const offsetParamIdx = pIdx + 2;

    const selectSql = `
      SELECT
        b.book_id,
        b.title,
        b.subtitle,
        b.synopsis,
        b.cover_url,
        b.status,
        b.created_at,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('authorId', a.author_id, 'name', a.name))
          FILTER (WHERE a.author_id IS NOT NULL), '[]'
        ) as authors,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('categoryId', cat.category_id, 'name', cat.name))
          FILTER (WHERE cat.category_id IS NOT NULL), '[]'
        ) as categories,
        (
          SELECT COUNT(*)
          FROM "book_copies" c
          JOIN "book_editions" ed ON ed.edition_id = c.edition_id
          WHERE ed.book_id = b.book_id AND c.library_id = $${libParamIdx}
        ) as total_copies,
        (
          SELECT COUNT(*)
          FROM "book_copies" c
          JOIN "book_editions" ed ON ed.edition_id = c.edition_id
          WHERE ed.book_id = b.book_id AND c.library_id = $${libParamIdx} AND c.status = 'AVAILABLE'
        ) as available_copies
      ${baseSql}
      GROUP BY b.book_id
      ORDER BY ${orderBy}
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;

    const selectParams = [...filterParams, libraryId, limit, offset];
    const rows = await tenantDs.query(selectSql, selectParams);

    const items: BookWorkDto[] = rows.map((r: any) => ({
      bookId: r.book_id,
      title: r.title,
      subtitle: r.subtitle || undefined,
      synopsis: r.synopsis || undefined,
      coverUrl: r.cover_url || undefined,
      status: r.status,
      authors: typeof r.authors === 'string' ? JSON.parse(r.authors) : r.authors,
      categories: typeof r.categories === 'string' ? JSON.parse(r.categories) : r.categories,
      totalCopies: parseInt(r.total_copies || '0', 10),
      availableCopies: parseInt(r.available_copies || '0', 10),
      averageRating: 4.5, // Seed/default rating
      reviewCount: 12,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    // Filter by available status if requested
    const filteredItems = status === 'available'
      ? items.filter((item) => item.availableCopies > 0)
      : items;

    return {
      items: filteredItems,
      total,
      limit,
      offset,
    };
  }

  /**
   * Retrieves single work details, editions, and all physical copies located in this library.
   */
  async getBookDetails(
    organizationId: string,
    libraryId: string,
    bookId: string,
  ): Promise<BookWorkDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // 1. Fetch Book
    const bookRows = await tenantDs.query(
      `SELECT * FROM "books" WHERE book_id = $1`,
      [bookId],
    );
    if (bookRows.length === 0) {
      throw new NotFoundException(`Book ${bookId} not found`);
    }
    const book = bookRows[0];

    // 2. Fetch Authors
    const authors = await tenantDs.query(
      `SELECT a.author_id as "authorId", a.name, a.biography
       FROM "authors" a
       JOIN "book_authors" ba ON ba.author_id = a.author_id
       WHERE ba.book_id = $1`,
      [bookId],
    );

    // 3. Fetch Categories
    const categories = await tenantDs.query(
      `SELECT c.category_id as "categoryId", c.name
       FROM "categories" c
       JOIN "book_categories" bc ON bc.category_id = c.category_id
       WHERE bc.book_id = $1`,
      [bookId],
    );

    // 4. Fetch Editions & Copies for THIS library
    const editions = await tenantDs.query(
      `SELECT
        e.edition_id as "editionId",
        e.book_id as "bookId",
        e.isbn,
        e.edition_label as "editionLabel",
        e.format,
        e.language,
        e.publication_date as "publicationDate",
        e.replacement_cost as "replacementCost",
        p.publisher_id as "publisherId",
        p.name as "publisherName"
       FROM "book_editions" e
       JOIN "publishers" p ON p.publisher_id = e.publisher_id
       WHERE e.book_id = $1`,
      [bookId],
    );

    // 5. Fetch all copies of these editions in this library
    const editionIds = editions.map((e: any) => e.editionId);
    let copiesByEdition: Record<string, BookCopyDto[]> = {};

    if (editionIds.length > 0) {
      const copyRows = await tenantDs.query(
        `SELECT
          c.copy_id as "copyId",
          c.library_id as "libraryId",
          c.edition_id as "editionId",
          c.barcode,
          c.status,
          c.condition,
          hl.location_id as "homeLocationId",
          hl.code as "homeLocationCode",
          hl.name as "homeLocationName",
          hl.location_type as "homeLocationType",
          hl.floor_id as "homeFloorId",
          cl.location_id as "currentLocationId",
          cl.code as "currentLocationCode",
          cl.name as "currentLocationName"
         FROM "book_copies" c
         JOIN "locations" hl ON hl.location_id = c.home_location_id
         LEFT JOIN "locations" cl ON cl.location_id = c.current_location_id
         WHERE c.edition_id = ANY($1::uuid[]) AND c.library_id = $2`,
        [editionIds, libraryId],
      );

      for (const row of copyRows) {
        if (!copiesByEdition[row.editionId]) copiesByEdition[row.editionId] = [];
        copiesByEdition[row.editionId].push({
          copyId: row.copyId,
          libraryId: row.libraryId,
          editionId: row.editionId,
          barcode: row.barcode,
          status: row.status as CopyStatus,
          condition: row.condition as CopyCondition,
          bookId: book.book_id,
          bookTitle: book.title,
          editionLabel: 'Standard',
          format: 'Paperback',
          homeLocation: {
            locationId: row.homeLocationId,
            libraryId: row.libraryId,
            floorId: row.homeFloorId,
            code: row.homeLocationCode,
            name: row.homeLocationName,
            locationType: row.homeLocationType,
          },
          currentLocation: row.currentLocationId ? {
            locationId: row.currentLocationId,
            libraryId: row.libraryId,
            floorId: row.homeFloorId,
            code: row.currentLocationCode,
            name: row.currentLocationName,
            locationType: 'SHELF',
          } : null,
        });
      }
    }

    const editionDtos: BookEditionDto[] = editions.map((e: any) => ({
      editionId: e.editionId,
      bookId: e.bookId,
      publisher: {
        publisherId: e.publisherId,
        name: e.publisherName,
      },
      isbn: e.isbn || undefined,
      editionLabel: e.editionLabel,
      format: e.format,
      language: e.language,
      publicationDate: e.publicationDate ? new Date(e.publicationDate).toISOString().slice(0, 10) : undefined,
      replacementCost: parseFloat(e.replacementCost),
      copies: copiesByEdition[e.editionId] || [],
    }));

    const allCopies = Object.values(copiesByEdition).flat();

    return {
      bookId: book.book_id,
      title: book.title,
      subtitle: book.subtitle || undefined,
      synopsis: book.synopsis || undefined,
      coverUrl: book.cover_url || undefined,
      status: book.status,
      authors,
      categories,
      editions: editionDtos,
      totalCopies: allCopies.length,
      availableCopies: allCopies.filter((c) => c.status === CopyStatus.AVAILABLE).length,
      averageRating: 4.5,
      reviewCount: 14,
      createdAt: new Date(book.created_at).toISOString(),
    };
  }

  /**
   * Retrieves physical copy inventory and metrics for the library desk.
   */
  async getInventory(
    organizationId: string,
    libraryId: string,
    query: InventoryQueryDto,
  ): Promise<{ items: BookCopyDto[]; stats: InventoryStatsResponse; total: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // Auto-seed if 0 copies
    const copyCountRes = await tenantDs.query(
      `SELECT COUNT(*) as count FROM "book_copies" WHERE library_id = $1`,
      [libraryId],
    );
    if (parseInt(copyCountRes[0]?.count || '0', 10) === 0) {
      await this.seedLibraryDemoCatalog(tenantDs, libraryId);
    }

    const { search, status, condition, limit = 25, offset = 0 } = query;

    let where = [`c.library_id = $1`];
    let params: any[] = [libraryId];
    let pIdx = 2;

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where.push(`(
        LOWER(c.barcode) LIKE $${pIdx} OR
        LOWER(b.title) LIKE $${pIdx} OR
        LOWER(hl.name) LIKE $${pIdx}
      )`);
      pIdx++;
    }

    if (status) {
      params.push(status);
      where.push(`c.status = $${pIdx}`);
      pIdx++;
    }

    if (condition) {
      params.push(condition);
      where.push(`c.condition = $${pIdx}`);
      pIdx++;
    }

    const baseSql = `
      FROM "book_copies" c
      JOIN "book_editions" e ON e.edition_id = c.edition_id
      JOIN "books" b ON b.book_id = e.book_id
      JOIN "locations" hl ON hl.location_id = c.home_location_id
      LEFT JOIN "locations" cl ON cl.location_id = c.current_location_id
      WHERE ${where.join(' AND ')}
    `;

    const countRes = await tenantDs.query(`SELECT COUNT(*) as total ${baseSql}`, params);
    const total = parseInt(countRes[0]?.total || '0', 10);

    const selectSql = `
      SELECT
        c.copy_id as "copyId",
        c.library_id as "libraryId",
        c.edition_id as "editionId",
        c.barcode,
        c.status,
        c.condition,
        b.book_id as "bookId",
        b.title as "bookTitle",
        e.edition_label as "editionLabel",
        e.format,
        e.isbn,
        (
          SELECT a.name
          FROM "authors" a
          JOIN "book_authors" ba ON ba.author_id = a.author_id
          WHERE ba.book_id = b.book_id
          LIMIT 1
        ) as "authorName",
        hl.location_id as "homeLocationId",
        hl.code as "homeLocationCode",
        hl.name as "homeLocationName",
        hl.location_type as "homeLocationType",
        hl.floor_id as "homeFloorId",
        cl.location_id as "currentLocationId",
        cl.code as "currentLocationCode",
        cl.name as "currentLocationName"
      ${baseSql}
      ORDER BY c.created_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    params.push(limit, offset);
    const rows = await tenantDs.query(selectSql, params);

    const items: BookCopyDto[] = rows.map((r: any) => ({
      copyId: r.copyId,
      libraryId: r.libraryId,
      editionId: r.editionId,
      barcode: r.barcode,
      status: r.status,
      condition: r.condition,
      bookId: r.bookId,
      bookTitle: r.bookTitle,
      editionLabel: r.editionLabel,
      format: r.format,
      isbn: r.isbn,
      authorName: r.authorName,
      homeLocation: {
        locationId: r.homeLocationId,
        libraryId: r.libraryId,
        floorId: r.homeFloorId,
        code: r.homeLocationCode,
        name: r.homeLocationName,
        locationType: r.homeLocationType,
      },
      currentLocation: r.currentLocationId ? {
        locationId: r.currentLocationId,
        libraryId: r.libraryId,
        floorId: r.homeFloorId,
        code: r.currentLocationCode,
        name: r.currentLocationName,
        locationType: 'SHELF',
      } : null,
    }));

    // Stats
    const statsRows = await tenantDs.query(
      `SELECT
        COUNT(*) as "totalCopies",
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as "availableCopies",
        COUNT(*) FILTER (WHERE status = 'LOANED') as "loanedCopies",
        COUNT(*) FILTER (WHERE status IN ('LOST', 'DAMAGED', 'WITHDRAWN') OR condition = 'DAMAGED') as "exceptionsCount"
       FROM "book_copies"
       WHERE library_id = $1`,
      [libraryId],
    );

    const stats: InventoryStatsResponse = {
      totalCopies: parseInt(statsRows[0]?.totalCopies || '0', 10),
      availableCopies: parseInt(statsRows[0]?.availableCopies || '0', 10),
      loanedCopies: parseInt(statsRows[0]?.loanedCopies || '0', 10),
      exceptionsCount: parseInt(statsRows[0]?.exceptionsCount || '0', 10),
    };

    return { items, stats, total };
  }

  /**
   * Creates a new physical copy in the library inventory.
   */
  async createCopy(
    organizationId: string,
    libraryId: string,
    dto: CreateBookCopyDto,
  ): Promise<BookCopyDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // Verify barcode uniqueness within this library
    const existing = await tenantDs.query(
      `SELECT copy_id FROM "book_copies" WHERE library_id = $1 AND barcode = $2`,
      [libraryId, dto.barcode],
    );
    if (existing.length > 0) {
      throw new ConflictException(`Barcode '${dto.barcode}' is already in use in this library`);
    }

    const [newCopy] = await tenantDs.query(
      `INSERT INTO "book_copies" (
        "library_id", "edition_id", "barcode", "condition", "status", "home_location_id", "current_location_id"
      ) VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING *`,
      [libraryId, dto.editionId, dto.barcode, dto.condition, dto.status, dto.homeLocationId],
    );

    // Return with edition and book title
    const details = await tenantDs.query(
      `SELECT b.title as "bookTitle", e.edition_label as "editionLabel", e.format, e.isbn, l.name as "locationName", l.code as "locationCode"
       FROM "book_editions" e
       JOIN "books" b ON b.book_id = e.book_id
       JOIN "locations" l ON l.location_id = $1
       WHERE e.edition_id = $2`,
      [dto.homeLocationId, dto.editionId],
    );

    const meta = details[0] || {};
    return {
      copyId: newCopy.copy_id,
      libraryId,
      editionId: dto.editionId,
      barcode: newCopy.barcode,
      status: newCopy.status,
      condition: newCopy.condition,
      bookId: newCopy.edition_id,
      bookTitle: meta.bookTitle || 'Book',
      editionLabel: meta.editionLabel || 'Standard',
      format: meta.format || 'Paperback',
      isbn: meta.isbn,
      homeLocation: {
        locationId: dto.homeLocationId,
        libraryId,
        floorId: '',
        code: meta.locationCode || 'LOC',
        name: meta.locationName || 'Shelf',
        locationType: 'SHELF',
      },
    };
  }

  /**
   * Retrieves the published floor plan fixtures linked to logical racks for the reader flow.
   */
  async getFloorPlan(
    organizationId: string,
    libraryId: string,
    floorNumber: number = 1,
  ): Promise<FloorPlanResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // 1. Resolve floor
    let floorRows = await tenantDs.query(
      `SELECT * FROM "library_floors" WHERE library_id = $1 AND floor_number = $2`,
      [libraryId, floorNumber],
    );
    if (floorRows.length === 0) {
      await this.seedLibraryDemoCatalog(tenantDs, libraryId);
      floorRows = await tenantDs.query(
        `SELECT * FROM "library_floors" WHERE library_id = $1 AND floor_number = $2`,
        [libraryId, floorNumber],
      );
    }
    const floor = floorRows[0];

    // 2. Resolve latest version
    const versionRows = await tenantDs.query(
      `SELECT * FROM "floor_plan_versions"
       WHERE floor_id = $1
       ORDER BY (status = 'PUBLISHED') DESC, version_number DESC
       LIMIT 1`,
      [floor.floor_id],
    );
    const version = versionRows[0];

    // 3. Resolve spatial layouts linked to logical rack locations
    const fixtureRows = await tenantDs.query(
      `SELECT
        s.element_id as "elementId",
        s.element_type as "elementType",
        s.x, s.y, s.width, s.height, s.rotation,
        s.linked_location_id as "linkedLocationId",
        l.code as "linkedRackCode",
        (
          SELECT COUNT(*)
          FROM "book_copies" bc
          JOIN "locations" shelf ON shelf.location_id = bc.home_location_id
          WHERE shelf.parent_location_id = s.linked_location_id AND bc.library_id = $1 AND bc.status = 'AVAILABLE'
        ) as "availableCopiesCount"
       FROM "spatial_layouts" s
       LEFT JOIN "locations" l ON l.location_id = s.linked_location_id
       WHERE s.version_id = $2
       ORDER BY l.code ASC`,
      [libraryId, version.version_id],
    );

    const fixtures = fixtureRows.map((f: any) => {
      const availCount = parseInt(f.availableCopiesCount || '0', 10);
      return {
        elementId: f.elementId,
        elementType: f.elementType,
        x: parseFloat(f.x),
        y: parseFloat(f.y),
        width: parseFloat(f.width),
        height: parseFloat(f.height),
        rotation: parseFloat(f.rotation),
        linkedLocationId: f.linkedLocationId,
        linkedRackCode: f.linkedRackCode ? f.linkedRackCode.replace(/^F\d+-R?/, '') : undefined,
        hasBooks: availCount > 0,
        availableCopiesCount: availCount,
      };
    });

    return {
      floorId: floor.floor_id,
      floorName: floor.name,
      floorNumber: floor.floor_number,
      canvasWidth: parseFloat(floor.canvas_width),
      canvasHeight: parseFloat(floor.canvas_height),
      versionNumber: version.version_number,
      fixtures,
    };
  }

  /**
   * Retrieves shelf-by-shelf copies and titles on a specific rack.
   */
  async getRackShelves(
    organizationId: string,
    libraryId: string,
    rackCode: string,
  ): Promise<RackDetailResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // Normalize rackCode (e.g. 'A' -> 'F1-RA' or exact code match)
    const normalizedCode = rackCode.length === 1 ? `F1-R${rackCode.toUpperCase()}` : rackCode.toUpperCase();

    const rackRows = await tenantDs.query(
      `SELECT l.*, f.name as "floorName"
       FROM "locations" l
       JOIN "library_floors" f ON f.floor_id = l.floor_id
       WHERE l.library_id = $1 AND (l.code = $2 OR l.code = $3)`,
      [libraryId, normalizedCode, rackCode],
    );

    if (rackRows.length === 0) {
      throw new NotFoundException(`Rack '${rackCode}' not found in this library`);
    }
    const rack = rackRows[0];

    // Fetch child shelves for this rack
    const shelfRows = await tenantDs.query(
      `SELECT * FROM "locations"
       WHERE library_id = $1 AND parent_location_id = $2 AND location_type = 'SHELF'
       ORDER BY code ASC`,
      [libraryId, rack.location_id],
    );

    const shelves: RackDetailResponse['shelves'] = [];

    for (let i = 0; i < shelfRows.length; i++) {
      const shelf = shelfRows[i];
      const shelfNum = i + 1;

      // Fetch copies placed on this shelf
      const copiesRows = await tenantDs.query(
        `SELECT
          c.copy_id as "copyId",
          c.library_id as "libraryId",
          c.edition_id as "editionId",
          c.barcode,
          c.status,
          c.condition,
          b.book_id as "bookId",
          b.title as "bookTitle",
          e.edition_label as "editionLabel",
          e.format,
          e.isbn,
          (
            SELECT a.name
            FROM "authors" a
            JOIN "book_authors" ba ON ba.author_id = a.author_id
            WHERE ba.book_id = b.book_id
            LIMIT 1
          ) as "authorName"
         FROM "book_copies" c
         JOIN "book_editions" e ON e.edition_id = c.edition_id
         JOIN "books" b ON b.book_id = e.book_id
         WHERE c.library_id = $1 AND c.home_location_id = $2`,
        [libraryId, shelf.location_id],
      );

      const copies: BookCopyDto[] = copiesRows.map((r: any) => ({
        copyId: r.copyId,
        libraryId: r.libraryId,
        editionId: r.editionId,
        barcode: r.barcode,
        status: r.status,
        condition: r.condition,
        bookId: r.bookId,
        bookTitle: r.bookTitle,
        editionLabel: r.editionLabel,
        format: r.format,
        isbn: r.isbn,
        authorName: r.authorName,
        homeLocation: {
          locationId: shelf.location_id,
          libraryId,
          floorId: rack.floor_id,
          code: shelf.code,
          name: shelf.name,
          locationType: 'SHELF',
        },
      }));

      const uniqueTitles = new Set(copies.map((c) => c.bookTitle)).size;
      shelves.push({
        shelfNumber: shelfNum,
        shelfLocationId: shelf.location_id,
        shelfCode: shelf.code,
        totalCopies: copies.length,
        availableCopies: copies.filter((c) => c.status === CopyStatus.AVAILABLE).length,
        uniqueTitlesCount: uniqueTitles,
        copies,
      });
    }

    return {
      rackCode: rack.code.replace(/^F\d+-R?/, ''),
      rackName: rack.name,
      rackLocationId: rack.location_id,
      floorName: rack.floorName,
      shelves,
    };
  }

  /**
   * Seeds demo catalog for a specific organization and library.
   */
  async seedLibrary(organizationId: string, libraryId: string): Promise<void> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.seedLibraryDemoCatalog(tenantDs, libraryId);
  }

  /**
   * Internal Seeder: Seeds standard works, editions, hierarchical locations,
   * spatial layouts, and physical copies matching the reference prototype.
   */
  async seedLibraryDemoCatalog(tenantDs: DataSource, libraryId: string): Promise<void> {
    this.logger.log(`Seeding catalog, editions, locations & physical inventory for library ${libraryId}...`);

    // 1. Authors
    const authorValues = [
      ['Matt Haig', 'British author of speculative fiction and children\'s novels.'],
      ['Susan Orlean', 'American journalist and author of The Library Book.'],
      ['Carlos Ruiz Zafón', 'Spanish novelist known for The Cemetery of Forgotten Books series.'],
      ['Alex Michaelides', 'British-Cypriot author and screenwriter.'],
      ['Markus Zusak', 'Australian writer best known for The Book Thief.'],
      ['Andy Weir', 'American novelist and software engineer.'],
      ['Frank Herbert', 'American science-fiction author best known for the novel Dune.'],
      ['Tara Westover', 'American memoirist and historian.'],
    ];

    const authorsMap: Record<string, string> = {};
    for (const [name, bio] of authorValues) {
      const [res] = await tenantDs.query(
        `INSERT INTO "authors" ("name", "biography") VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING author_id`,
        [name, bio],
      );
      if (res?.author_id) authorsMap[name] = res.author_id;
      else {
        const found = await tenantDs.query(`SELECT author_id FROM "authors" WHERE name = $1`, [name]);
        authorsMap[name] = found[0]?.author_id;
      }
    }

    // 2. Publishers
    const publisherNames = ['Viking Press', 'Simon & Schuster', 'HarperCollins', 'Celadon Books', 'Knopf', 'Ballantine Books', 'Chilton Books', 'Random House'];
    const publishersMap: Record<string, string> = {};
    for (const pName of publisherNames) {
      const [res] = await tenantDs.query(
        `INSERT INTO "publishers" ("name") VALUES ($1) ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name" RETURNING publisher_id`,
        [pName],
      );
      publishersMap[pName] = res.publisher_id;
    }

    // 3. Categories
    const categoryNames = ['Fiction', 'Nonfiction', 'Mystery', 'Thriller', 'Science Fiction', 'Biography'];
    const categoriesMap: Record<string, string> = {};
    for (const cName of categoryNames) {
      const [res] = await tenantDs.query(
        `INSERT INTO "categories" ("name") VALUES ($1) ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name" RETURNING category_id`,
        [cName],
      );
      categoriesMap[cName] = res.category_id;
    }

    // 4. Books
    const booksData = [
      {
        title: 'The Midnight Library',
        author: 'Matt Haig',
        publisher: 'Viking Press',
        category: 'Fiction',
        isbn: '978-0-00-000000-0',
        synopsis: 'Between ordinary days and unexpected choices, this story explores the paths a life can take and the people who shape it.',
        format: 'Paperback',
        year: 2020,
      },
      {
        title: 'The Library Book',
        author: 'Susan Orlean',
        publisher: 'Simon & Schuster',
        category: 'Nonfiction',
        isbn: '978-1-00-000000-1',
        synopsis: 'An ode to public libraries and an investigation into the mysterious 1986 Los Angeles Public Library fire.',
        format: 'Hardcover',
        year: 2018,
      },
      {
        title: 'The Shadow of the Wind',
        author: 'Carlos Ruiz Zafón',
        publisher: 'HarperCollins',
        category: 'Mystery',
        isbn: '978-1-00-000000-2',
        synopsis: 'In post-war Barcelona, a young boy is taken by his antiquarian book dealer father to the Cemetery of Forgotten Books.',
        format: 'Paperback',
        year: 2005,
      },
      {
        title: 'The Silent Patient',
        author: 'Alex Michaelides',
        publisher: 'Celadon Books',
        category: 'Thriller',
        isbn: '978-1-00-000000-3',
        synopsis: 'A psychotherapist becomes obsessed with uncovering the motive of a woman who murders her husband then goes silent.',
        format: 'Paperback',
        year: 2019,
      },
      {
        title: 'The Book Thief',
        author: 'Markus Zusak',
        publisher: 'Knopf',
        category: 'Fiction',
        isbn: '978-1-00-000000-4',
        synopsis: 'Narrated by Death, a young girl living outside Munich scratches out an existence by stealing books during WWII.',
        format: 'Paperback',
        year: 2006,
      },
      {
        title: 'Project Hail Mary',
        author: 'Andy Weir',
        publisher: 'Ballantine Books',
        category: 'Science Fiction',
        isbn: '978-1-00-000000-5',
        synopsis: 'Ryland Grace is the sole survivor on a desperate, last-chance mission to save humanity from an interstellar disaster.',
        format: 'Hardcover',
        year: 2021,
      },
      {
        title: 'Dune',
        author: 'Frank Herbert',
        publisher: 'Chilton Books',
        category: 'Science Fiction',
        isbn: '978-0-44-117271-9',
        synopsis: 'Set on the desert planet Arrakis, Dune tells the story of Paul Atreides and the battle for the universe\'s most valuable spice.',
        format: 'Paperback',
        year: 1965,
      },
      {
        title: 'Educated',
        author: 'Tara Westover',
        publisher: 'Random House',
        category: 'Nonfiction',
        isbn: '978-0-39-959050-4',
        synopsis: 'An unforgettable memoir about a young girl who leaves her survivalist family in Idaho to pursue higher education.',
        format: 'Paperback',
        year: 2018,
      },
    ];

    const editionsMap: Record<string, string> = {};
    for (const b of booksData) {
      const [bookRes] = await tenantDs.query(
        `INSERT INTO "books" ("title", "synopsis", "status")
         VALUES ($1, $2, 'ACTIVE') RETURNING book_id`,
        [b.title, b.synopsis],
      );
      const bId = bookRes.book_id;

      // Link author
      if (authorsMap[b.author]) {
        await tenantDs.query(
          `INSERT INTO "book_authors" ("book_id", "author_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [bId, authorsMap[b.author]],
        );
      }

      // Link category
      if (categoriesMap[b.category]) {
        await tenantDs.query(
          `INSERT INTO "book_categories" ("book_id", "category_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [bId, categoriesMap[b.category]],
        );
      }

      // Create Edition
      const [edRes] = await tenantDs.query(
        `INSERT INTO "book_editions" (
          "book_id", "publisher_id", "isbn", "edition_label", "format", "language", "publication_date", "replacement_cost"
        ) VALUES ($1, $2, $3, 'Standard', $4, 'English', $5, 500.00) RETURNING edition_id`,
        [bId, publishersMap[b.publisher], b.isbn, b.format, `${b.year}-01-01`],
      );
      editionsMap[b.title] = edRes.edition_id;
    }

    // 5. Hierarchical Locations & Floors for this Library
    const [floorRes] = await tenantDs.query(
      `INSERT INTO "library_floors" ("library_id", "name", "floor_number", "canvas_width", "canvas_height")
       VALUES ($1, 'Floor 1', 1, 1200.00, 800.00)
       ON CONFLICT ("library_id", "floor_number") DO UPDATE SET "name" = EXCLUDED."name"
       RETURNING floor_id`,
      [libraryId],
    );
    const floorId = floorRes.floor_id;

    // Create Main Zone
    const [zoneRes] = await tenantDs.query(
      `INSERT INTO "locations" ("library_id", "floor_id", "location_type", "code", "name")
       VALUES ($1, $2, 'ZONE', 'F1-ZONE-MAIN', 'Main Reading & Stacks')
       ON CONFLICT ("library_id", "code") DO UPDATE SET "name" = EXCLUDED."name"
       RETURNING location_id`,
      [libraryId, floorId],
    );
    const zoneId = zoneRes.location_id;

    // Create Racks A, B, C, D, E, F under Main Zone
    const racks = ['A', 'B', 'C', 'D', 'E', 'F'];
    const rackLocations: Record<string, string> = {};
    const shelfLocations: Record<string, string> = {};

    for (const r of racks) {
      const rackCode = `F1-R${r}`;
      const [rRes] = await tenantDs.query(
        `INSERT INTO "locations" ("library_id", "floor_id", "parent_location_id", "location_type", "code", "name")
         VALUES ($1, $2, $3, 'RACK', $4, $5)
         ON CONFLICT ("library_id", "code") DO UPDATE SET "name" = EXCLUDED."name"
         RETURNING location_id`,
        [libraryId, floorId, zoneId, rackCode, `Rack ${r}`],
      );
      rackLocations[r] = rRes.location_id;

      // Create Shelves 1 to 6 under this rack
      for (let s = 1; s <= 6; s++) {
        const shelfCode = `F1-R${r}-S${s}`;
        const [sRes] = await tenantDs.query(
          `INSERT INTO "locations" ("library_id", "floor_id", "parent_location_id", "location_type", "code", "name")
           VALUES ($1, $2, $3, 'SHELF', $4, $5)
           ON CONFLICT ("library_id", "code") DO UPDATE SET "name" = EXCLUDED."name"
           RETURNING location_id`,
          [libraryId, floorId, rRes.location_id, shelfCode, `Shelf ${s}`],
        );
        shelfLocations[`${r}-${s}`] = sRes.location_id;
      }
    }

    // 6. Create Floor Plan Version & Spatial Layout Fixtures
    const [verRes] = await tenantDs.query(
      `INSERT INTO "floor_plan_versions" ("floor_id", "version_number", "status", "created_by_user_id", "published_at")
       VALUES ($1, 1, 'PUBLISHED', '00000000-0000-0000-0000-000000000000', NOW())
       ON CONFLICT ("floor_id", "version_number") DO UPDATE SET "status" = 'PUBLISHED'
       RETURNING version_id`,
      [floorId],
    );
    const versionId = verRes.version_id;

    // Fixture Positions matching prototype 3x2 grid
    const fixtureCoords: Record<string, { x: number; y: number }> = {
      A: { x: 150, y: 150 },
      B: { x: 450, y: 150 },
      C: { x: 750, y: 150 },
      D: { x: 150, y: 450 },
      E: { x: 450, y: 450 },
      F: { x: 750, y: 450 },
    };

    for (const r of racks) {
      const coord = fixtureCoords[r];
      await tenantDs.query(
        `INSERT INTO "spatial_layouts" (
          "version_id", "linked_location_id", "element_type", "x", "y", "width", "height", "rotation"
        ) VALUES ($1, $2, 'RACK', $3, $4, 180.00, 90.00, 0.0)
        ON CONFLICT DO NOTHING`,
        [versionId, rackLocations[r], coord.x, coord.y],
      );
    }

    // 7. Seed Physical Copies Matching Reference Prototype
    const copiesData = [
      { title: 'The Midnight Library', barcode: 'CP-00142', rack: 'A', shelf: 2, status: 'AVAILABLE', condition: 'GOOD' },
      { title: 'The Midnight Library', barcode: 'CP-00143', rack: 'A', shelf: 2, status: 'AVAILABLE', condition: 'GOOD' },
      { title: 'The Midnight Library', barcode: 'CP-00310', rack: 'C', shelf: 3, status: 'AVAILABLE', condition: 'GOOD' },
      { title: 'The Library Book', barcode: 'CP-00088', rack: 'A', shelf: 2, status: 'LOANED', condition: 'MINOR_WEAR' },
      { title: 'Educated', barcode: 'CP-00121', rack: 'A', shelf: 3, status: 'AVAILABLE', condition: 'GOOD' },
      { title: 'The Book Thief', barcode: 'CP-00031', rack: 'A', shelf: 5, status: 'AVAILABLE', condition: 'GOOD' },
      { title: 'Project Hail Mary', barcode: 'CP-00201', rack: 'B', shelf: 1, status: 'AVAILABLE', condition: 'GOOD' },
      { title: 'Dune', barcode: 'CP-00234', rack: 'B', shelf: 3, status: 'LOANED', condition: 'DAMAGED' },
    ];

    for (const cp of copiesData) {
      const editionId = editionsMap[cp.title];
      const shelfId = shelfLocations[`${cp.rack}-${cp.shelf}`];
      if (editionId && shelfId) {
        await tenantDs.query(
          `INSERT INTO "book_copies" (
            "library_id", "edition_id", "barcode", "status", "condition", "home_location_id", "current_location_id"
          ) VALUES ($1, $2, $3, $4, $5, $6, $6)
          ON CONFLICT ("library_id", "barcode") DO UPDATE SET "status" = EXCLUDED."status"`,
          [libraryId, editionId, cp.barcode, cp.status, cp.condition, shelfId],
        );
      }
    }

    this.logger.log(`Seed complete for library ${libraryId}. 8 works, 8 editions, 6 racks, 36 shelves, 8 physical copies provisioned.`);
  }
}
