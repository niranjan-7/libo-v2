import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import { AuditService } from '../audit/audit.service';
import {
  LibraryFloorDto,
  FloorPlanVersionDto,
  FloorPlanVersionStatus,
  SpatialLayoutElementDto,
  ValidateFloorPlanResponse,
  PublishFloorPlanResponse,
  LogicalRackDto,
  FloorPlanResponse,
  FloorCirculationHeatmapResponse,
  RackCirculationHeatmapDto,
} from '@library/contracts';
import {
  CreateFloorDto,
  UpdateFloorDto,
  SaveFloorPlanDraftDto,
} from './dto/floor-plan.dto';

@Injectable()
export class FloorPlanService {
  private readonly logger = new Logger(FloorPlanService.name);

  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  private extractRow<T = any>(result: any): T {
    if (!result) return {} as T;
    if (Array.isArray(result)) {
      if (Array.isArray(result[0])) {
        return (result[0][0] || {}) as T;
      }
      return (result[0] || {}) as T;
    }
    return result as T;
  }

  // ==========================================
  // 1. FLOOR MANAGEMENT
  // ==========================================

  async getFloors(
    organizationId: string,
    libraryId: string,
  ): Promise<LibraryFloorDto[]> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const rows = await tenantDs.query(
      `SELECT * FROM "library_floors" WHERE "library_id" = $1 ORDER BY "floor_number" ASC`,
      [libraryId],
    );

    return rows.map((r: any) => ({
      floorId: r.floor_id,
      libraryId: r.library_id,
      name: r.name,
      floorNumber: r.floor_number,
      canvasWidth: parseFloat(r.canvas_width),
      canvasHeight: parseFloat(r.canvas_height),
      coordinateUnit: r.coordinate_unit || 'px',
    }));
  }

  async getFloor(
    organizationId: string,
    libraryId: string,
    floorId: string,
  ): Promise<LibraryFloorDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const rows = await tenantDs.query(
      `SELECT * FROM "library_floors" WHERE "library_id" = $1 AND "floor_id" = $2`,
      [libraryId, floorId],
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Floor not found: ${floorId}`);
    }

    const r = rows[0];
    return {
      floorId: r.floor_id,
      libraryId: r.library_id,
      name: r.name,
      floorNumber: r.floor_number,
      canvasWidth: parseFloat(r.canvas_width),
      canvasHeight: parseFloat(r.canvas_height),
      coordinateUnit: r.coordinate_unit || 'px',
    };
  }

  async createFloor(
    organizationId: string,
    libraryId: string,
    staffUserId: string,
    dto: CreateFloorDto,
  ): Promise<LibraryFloorDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // Verify floor number uniqueness in this library
    const existing = await tenantDs.query(
      `SELECT "floor_id" FROM "library_floors" WHERE "library_id" = $1 AND "floor_number" = $2`,
      [libraryId, dto.floorNumber],
    );
    if (existing.length > 0) {
      throw new ConflictException(
        `Floor number ${dto.floorNumber} already exists in this library`,
      );
    }

    const canvasWidth = dto.canvasWidth || 1200.0;
    const canvasHeight = dto.canvasHeight || 800.0;

    const res = await tenantDs.query(
      `INSERT INTO "library_floors" ("library_id", "name", "floor_number", "canvas_width", "canvas_height", "coordinate_unit")
       VALUES ($1, $2, $3, $4, $5, 'px')
       RETURNING *`,
      [libraryId, dto.name.trim(), dto.floorNumber, canvasWidth, canvasHeight],
    );
    const created = this.extractRow<any>(res);

    // Auto-create initial draft version 1
    await tenantDs.query(
      `INSERT INTO "floor_plan_versions" ("floor_id", "version_number", "status", "created_by_user_id", "created_at")
       VALUES ($1, 1, 'DRAFT', $2, NOW())
       ON CONFLICT DO NOTHING`,
      [created.floor_id, staffUserId],
    );

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId: staffUserId,
        action: 'CREATE_FLOOR',
        entityType: 'FLOOR',
        entityId: created.floor_id,
        newValue: { name: dto.name, floorNumber: dto.floorNumber },
      });
    }

    return {
      floorId: created.floor_id,
      libraryId: created.library_id,
      name: created.name,
      floorNumber: created.floor_number,
      canvasWidth: parseFloat(created.canvas_width),
      canvasHeight: parseFloat(created.canvas_height),
      coordinateUnit: created.coordinate_unit || 'px',
    };
  }

  async updateFloor(
    organizationId: string,
    libraryId: string,
    floorId: string,
    staffUserId: string,
    dto: UpdateFloorDto,
  ): Promise<LibraryFloorDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const current = await this.getFloor(organizationId, libraryId, floorId);

    const newName = dto.name !== undefined ? dto.name.trim() : current.name;
    const newWidth = dto.canvasWidth !== undefined ? dto.canvasWidth : current.canvasWidth;
    const newHeight = dto.canvasHeight !== undefined ? dto.canvasHeight : current.canvasHeight;

    await tenantDs.query(
      `UPDATE "library_floors"
       SET "name" = $1, "canvas_width" = $2, "canvas_height" = $3
       WHERE "floor_id" = $4 AND "library_id" = $5`,
      [newName, newWidth, newHeight, floorId, libraryId],
    );

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId: staffUserId,
        action: 'UPDATE_FLOOR',
        entityType: 'FLOOR',
        entityId: floorId,
        newValue: { name: newName, canvasWidth: newWidth, canvasHeight: newHeight },
      });
    }

    return {
      floorId,
      libraryId,
      name: newName,
      floorNumber: current.floorNumber,
      canvasWidth: newWidth,
      canvasHeight: newHeight,
      coordinateUnit: current.coordinateUnit,
    };
  }

  async deleteFloor(
    organizationId: string,
    libraryId: string,
    floorId: string,
    staffUserId: string,
  ): Promise<void> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    await this.getFloor(organizationId, libraryId, floorId);

    await tenantDs.query(
      `DELETE FROM "library_floors" WHERE "floor_id" = $1 AND "library_id" = $2`,
      [floorId, libraryId],
    );

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId: staffUserId,
        action: 'DELETE_FLOOR',
        entityType: 'FLOOR',
        entityId: floorId,
      });
    }
  }

  // ==========================================
  // 2. VERSIONS & DRAFT EDITING
  // ==========================================

  async getVersions(
    organizationId: string,
    libraryId: string,
    floorId: string,
    isStaff = false,
  ): Promise<FloorPlanVersionDto[]> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.getFloor(organizationId, libraryId, floorId);

    const whereClause = isStaff
      ? `WHERE fpv.floor_id = $1`
      : `WHERE fpv.floor_id = $1 AND fpv.status = 'PUBLISHED'`;

    const query = `
      SELECT
        fpv.version_id,
        fpv.floor_id,
        fpv.version_number,
        fpv.status,
        fpv.created_by_user_id,
        fpv.published_at,
        fpv.created_at,
        (SELECT COUNT(*) FROM "spatial_layouts" WHERE version_id = fpv.version_id)::int AS "elementCount"
      FROM "floor_plan_versions" fpv
      ${whereClause}
      ORDER BY fpv.version_number DESC
    `;

    const rows = await tenantDs.query(query, [floorId]);

    return rows.map((r: any) => ({
      versionId: r.version_id,
      floorId: r.floor_id,
      versionNumber: r.version_number,
      status: r.status as FloorPlanVersionStatus,
      createdByUserId: r.created_by_user_id,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
      elementCount: parseInt(r.elementCount || '0', 10),
    }));
  }

  /**
   * Readers and catalog view only see the PUBLISHED version.
   * If unpublished or draft only, throws NotFoundException.
   */
  async getPublishedFloorPlan(
    organizationId: string,
    libraryId: string,
    floorIdOrNumber: string | number,
  ): Promise<FloorPlanResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // 1. Resolve floor
    let floorRows: any[];
    if (typeof floorIdOrNumber === 'number' || !floorIdOrNumber.includes('-')) {
      floorRows = await tenantDs.query(
        `SELECT * FROM "library_floors" WHERE "library_id" = $1 AND "floor_number" = $2`,
        [libraryId, Number(floorIdOrNumber)],
      );
    } else {
      floorRows = await tenantDs.query(
        `SELECT * FROM "library_floors" WHERE "library_id" = $1 AND "floor_id" = $2`,
        [libraryId, floorIdOrNumber],
      );
    }

    if (floorRows.length === 0) {
      throw new NotFoundException(`Floor not found in library: ${floorIdOrNumber}`);
    }
    const floor = floorRows[0];

    // 2. Resolve PUBLISHED version strictly
    const versionRows = await tenantDs.query(
      `SELECT * FROM "floor_plan_versions"
       WHERE "floor_id" = $1 AND "status" = 'PUBLISHED'
       ORDER BY "version_number" DESC
       LIMIT 1`,
      [floor.floor_id],
    );

    if (versionRows.length === 0) {
      throw new NotFoundException(
        `No published floor plan found for floor ${floor.name || floor.floor_number}`,
      );
    }
    const version = versionRows[0];

    // 3. Resolve spatial layouts linked to logical rack locations
    const fixtureRows = await tenantDs.query(
      `SELECT
        s.element_id as "elementId",
        s.element_type as "elementType",
        s.x, s.y, s.width, s.height, s.rotation, s.z_index as "zIndex",
        s.properties,
        s.linked_location_id as "linkedLocationId",
        l.code as "linkedRackCode",
        (
          SELECT COUNT(*)
          FROM "book_copies" bc
          JOIN "locations" shelf ON shelf.location_id = bc.home_location_id
          WHERE shelf.parent_location_id = s.linked_location_id
            AND bc.library_id = $1
            AND bc.status = 'AVAILABLE'
        ) as "availableCopiesCount"
       FROM "spatial_layouts" s
       LEFT JOIN "locations" l ON l.location_id = s.linked_location_id
       WHERE s.version_id = $2
       ORDER BY s.z_index ASC, l.code ASC`,
      [libraryId, version.version_id],
    );

    const fixtures = fixtureRows.map((f: any) => {
      const availCount = parseInt(f.availableCopiesCount || '0', 10);
      const props = typeof f.properties === 'string' ? JSON.parse(f.properties) : f.properties || {};
      const elementLabel = f.label || props.label || (f.elementType === 'RACK' ? (f.linkedRackCode ? `Rack ${f.linkedRackCode.replace(/^F\d+-R?/, '')}` : 'Rack Unit') : f.elementType);
      return {
        elementId: f.elementId,
        elementType: f.elementType,
        label: elementLabel,
        x: parseFloat(f.x),
        y: parseFloat(f.y),
        width: parseFloat(f.width),
        height: parseFloat(f.height),
        rotation: parseFloat(f.rotation || '0'),
        zIndex: parseInt(f.zIndex || '0', 10),
        properties: props,
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
      versionId: version.version_id,
      versionNumber: version.version_number,
      status: version.status as FloorPlanVersionStatus,
      fixtures,
    };
  }

  /**
   * Retrieves or creates active DRAFT version for floor plan studio.
   * If a published version exists, clones its layout elements into the new draft.
   */
  async getOrCreateDraft(
    organizationId: string,
    libraryId: string,
    floorId: string,
    userId: string,
  ): Promise<FloorPlanVersionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.getFloor(organizationId, libraryId, floorId);

    // 1. Check if active DRAFT already exists
    const draftRows = await tenantDs.query(
      `SELECT * FROM "floor_plan_versions"
       WHERE "floor_id" = $1 AND "status" = 'DRAFT'
       ORDER BY "version_number" DESC
       LIMIT 1`,
      [floorId],
    );

    let draftVersion: any;
    if (draftRows.length > 0) {
      draftVersion = draftRows[0];
    } else {
      // 2. Create next version number
      const maxRows = await tenantDs.query(
        `SELECT COALESCE(MAX(version_number), 0) as "maxVersion"
         FROM "floor_plan_versions"
         WHERE "floor_id" = $1`,
        [floorId],
      );
      const nextVersionNumber = parseInt(maxRows[0]?.maxVersion || '0', 10) + 1;

      // 3. Find latest published version to clone from
      const pubRows = await tenantDs.query(
        `SELECT * FROM "floor_plan_versions"
         WHERE "floor_id" = $1 AND "status" = 'PUBLISHED'
         ORDER BY "version_number" DESC
         LIMIT 1`,
        [floorId],
      );

      const res = await tenantDs.query(
        `INSERT INTO "floor_plan_versions" ("floor_id", "version_number", "status", "created_by_user_id", "created_at")
         VALUES ($1, $2, 'DRAFT', $3, NOW())
         RETURNING *`,
        [floorId, nextVersionNumber, userId],
      );
      draftVersion = this.extractRow<any>(res);

      // Clone elements from published version if present
      if (pubRows.length > 0) {
        const sourceVersionId = pubRows[0].version_id;
        await tenantDs.query(
          `INSERT INTO "spatial_layouts" ("version_id", "linked_location_id", "element_type", "x", "y", "width", "height", "rotation", "z_index", "properties")
           SELECT $1, "linked_location_id", "element_type", "x", "y", "width", "height", "rotation", "z_index", "properties"
           FROM "spatial_layouts"
           WHERE "version_id" = $2`,
          [draftVersion.version_id, sourceVersionId],
        );
      }
    }

    // 4. Load elements for this draft
    const elements = await this.getSpatialElements(tenantDs, draftVersion.version_id);

    return {
      versionId: draftVersion.version_id,
      floorId: draftVersion.floor_id,
      versionNumber: draftVersion.version_number,
      status: 'DRAFT',
      createdByUserId: draftVersion.created_by_user_id,
      publishedAt: draftVersion.published_at ? new Date(draftVersion.published_at).toISOString() : null,
      createdAt: new Date(draftVersion.created_at).toISOString(),
      elementCount: elements.length,
      elements,
    };
  }

  private async getSpatialElements(
    tenantDs: any,
    versionId: string,
  ): Promise<SpatialLayoutElementDto[]> {
    const rows = await tenantDs.query(
      `SELECT
         s.element_id,
         s.version_id,
         s.element_type,
         s.x, s.y, s.width, s.height, s.rotation, s.z_index,
         s.properties,
         s.linked_location_id,
         l.code as "linkedRackCode"
       FROM "spatial_layouts" s
       LEFT JOIN "locations" l ON l.location_id = s.linked_location_id
       WHERE s.version_id = $1
       ORDER BY s.z_index ASC, s.element_id ASC`,
      [versionId],
    );

    return rows.map((r: any) => {
      const props = typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties || {};
      const label = props.label || (r.element_type === 'RACK' ? (r.linkedRackCode ? `Rack ${r.linkedRackCode.replace(/^F\d+-R?/, '')}` : 'Rack Unit') : r.element_type);
      return {
        elementId: r.element_id,
        versionId: r.version_id,
        elementType: r.element_type,
        label,
        x: parseFloat(r.x),
        y: parseFloat(r.y),
        width: parseFloat(r.width),
        height: parseFloat(r.height),
        rotation: parseFloat(r.rotation || '0'),
        zIndex: parseInt(r.z_index || '0', 10),
        linkedLocationId: r.linked_location_id,
        linkedRackCode: r.linkedRackCode ? r.linkedRackCode.replace(/^F\d+-R?/, '') : undefined,
        properties: props,
      };
    });
  }

  /**
   * Saves spatial layout elements to draft version atomically.
   */
  async saveDraft(
    organizationId: string,
    libraryId: string,
    floorId: string,
    versionId: string,
    userId: string,
    dto: SaveFloorPlanDraftDto,
  ): Promise<FloorPlanVersionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.getFloor(organizationId, libraryId, floorId);

    // Verify version is DRAFT
    const versionRows = await tenantDs.query(
      `SELECT * FROM "floor_plan_versions" WHERE "version_id" = $1 AND "floor_id" = $2`,
      [versionId, floorId],
    );
    if (versionRows.length === 0) {
      throw new NotFoundException(`Version not found: ${versionId}`);
    }
    const version = versionRows[0];
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Cannot edit a published or archived version');
    }

    await tenantDs.transaction(async (tx) => {
      // Clear existing elements in draft
      await tx.query(`DELETE FROM "spatial_layouts" WHERE "version_id" = $1`, [versionId]);

      // Insert new elements
      for (const el of dto.elements) {
        const mergedProps = {
          ...(el.properties || {}),
          ...(el.label ? { label: el.label } : {}),
        };
        await tx.query(
          `INSERT INTO "spatial_layouts" (
            "version_id", "linked_location_id", "element_type", "x", "y", "width", "height", "rotation", "z_index", "properties"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            versionId,
            el.linkedLocationId || null,
            el.elementType,
            el.x,
            el.y,
            el.width,
            el.height,
            el.rotation || 0,
            el.zIndex || 0,
            JSON.stringify(mergedProps),
          ],
        );
      }
    });

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId: userId,
        action: 'SAVE_FLOOR_PLAN_DRAFT',
        entityType: 'FLOOR_PLAN_VERSION',
        entityId: versionId,
        newValue: { elementCount: dto.elements.length },
      });
    }

    const elements = await this.getSpatialElements(tenantDs, versionId);

    return {
      versionId: version.version_id,
      floorId: version.floor_id,
      versionNumber: version.version_number,
      status: 'DRAFT',
      createdByUserId: version.created_by_user_id,
      publishedAt: null,
      createdAt: new Date(version.created_at).toISOString(),
      elementCount: elements.length,
      elements,
    };
  }

  // ==========================================
  // 3. VALIDATION & PUBLISHING
  // ==========================================

  /**
   * Validates floor plan draft:
   * - Positive width and height dimensions
   * - Within canvas boundaries
   * - RACK elements must have a linkedLocationId
   * - No duplicate rack links
   * - Linked location exists and belongs to this library
   */
  async validateDraft(
    organizationId: string,
    libraryId: string,
    floorId: string,
    versionId: string,
  ): Promise<ValidateFloorPlanResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const floor = await this.getFloor(organizationId, libraryId, floorId);

    const versionRows = await tenantDs.query(
      `SELECT * FROM "floor_plan_versions" WHERE "version_id" = $1 AND "floor_id" = $2`,
      [versionId, floorId],
    );
    if (versionRows.length === 0) {
      throw new NotFoundException(`Version not found: ${versionId}`);
    }

    const elements = await this.getSpatialElements(tenantDs, versionId);

    const errors: string[] = [];
    const warnings: string[] = [];

    if (elements.length === 0) {
      warnings.push('Draft floor plan currently has 0 spatial layout elements.');
    }

    const rackLinkedIds: string[] = [];
    const rackOccurrences: Record<string, number> = {};

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const identifier = `Element #${i + 1} (${el.elementType})`;

      // 1. Dimensions validation
      if (el.width <= 0 || el.height <= 0) {
        errors.push(
          `${identifier} has invalid dimensions (width: ${el.width}, height: ${el.height}). Both dimensions must be greater than 0.`,
        );
      }

      // 2. Canvas boundaries check (allow reasonable margin)
      if (
        el.x < 0 ||
        el.y < 0 ||
        el.x + el.width > floor.canvasWidth + 50 ||
        el.y + el.height > floor.canvasHeight + 50
      ) {
        errors.push(
          `${identifier} is placed outside canvas boundaries (x: ${el.x}, y: ${el.y}, width: ${el.width}, height: ${el.height}, canvas: ${floor.canvasWidth}x${floor.canvasHeight}).`,
        );
      }

      // 3. Logical Rack Linking
      if (el.elementType === 'RACK') {
        if (!el.linkedLocationId) {
          errors.push(
            `${identifier} is not linked to any logical rack location. A physical rack fixture must connect to a logical rack location.`,
          );
        } else {
          rackLinkedIds.push(el.linkedLocationId);
          rackOccurrences[el.linkedLocationId] = (rackOccurrences[el.linkedLocationId] || 0) + 1;
        }
      }
    }

    // 4. Duplicate Rack Links Check
    for (const [locId, count] of Object.entries(rackOccurrences)) {
      if (count > 1) {
        errors.push(
          `Duplicate rack link: Logical rack location '${locId}' is linked to ${count} separate spatial elements. Each rack location must map to exactly one fixture.`,
        );
      }
    }

    // 5. Logical Rack Existence in Library Check
    if (rackLinkedIds.length > 0) {
      const locRows = await tenantDs.query(
        `SELECT "location_id", "code", "library_id"
         FROM "locations"
         WHERE "location_id" = ANY($1::uuid[]) AND "location_type" = 'RACK'`,
        [rackLinkedIds],
      );

      const foundIds = new Set(locRows.map((r: any) => r.location_id));
      for (const locId of rackLinkedIds) {
        if (!foundIds.has(locId)) {
          errors.push(
            `Linked logical location '${locId}' does not exist or is not a valid RACK in this library.`,
          );
        }
      }

      // Verify none belong to another library
      for (const r of locRows) {
        if (r.library_id !== libraryId) {
          errors.push(
            `Cross-library violation: Logical rack location '${r.code}' belongs to library '${r.library_id}', not active library '${libraryId}'.`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Publishes draft version.
   * Guarantees:
   * - Must pass validation.
   * - Atomically archives any previously published version on this floor.
   * - Sets this version status to PUBLISHED and published_at to NOW().
   * - Isolation: publishing one library's map cannot affect another library.
   */
  async publishDraft(
    organizationId: string,
    libraryId: string,
    floorId: string,
    versionId: string,
    userId: string,
  ): Promise<PublishFloorPlanResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.getFloor(organizationId, libraryId, floorId);

    // Validate draft
    const validation = await this.validateDraft(
      organizationId,
      libraryId,
      floorId,
      versionId,
    );
    if (!validation.isValid) {
      throw new BadRequestException(
        `Floor plan validation failed: ${validation.errors.join('; ')}`,
      );
    }

    const versionRows = await tenantDs.query(
      `SELECT * FROM "floor_plan_versions" WHERE "version_id" = $1 AND "floor_id" = $2`,
      [versionId, floorId],
    );
    if (versionRows.length === 0) {
      throw new NotFoundException(`Version not found: ${versionId}`);
    }
    const version = versionRows[0];

    const publishedAt = new Date().toISOString();

    await tenantDs.transaction(async (tx) => {
      // Archive any currently published version on this floor
      await tx.query(
        `UPDATE "floor_plan_versions"
         SET "status" = 'ARCHIVED'
         WHERE "floor_id" = $1 AND "status" = 'PUBLISHED'`,
        [floorId],
      );

      // Publish target draft version
      await tx.query(
        `UPDATE "floor_plan_versions"
         SET "status" = 'PUBLISHED', "published_at" = $1
         WHERE "version_id" = $2 AND "floor_id" = $3`,
        [publishedAt, versionId, floorId],
      );
    });

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId: userId,
        action: 'PUBLISH_FLOOR_PLAN_VERSION',
        entityType: 'FLOOR_PLAN_VERSION',
        entityId: versionId,
        newValue: { floorId, versionNumber: version.version_number, publishedAt },
      });
    }

    this.logger.log(
      `Floor plan v${version.version_number} on floor ${floorId} published by user ${userId}`,
    );

    return {
      versionId,
      versionNumber: version.version_number,
      status: 'PUBLISHED',
      publishedAt,
    };
  }

  /**
   * Restores a prior version into a new active draft version.
   */
  async restoreVersion(
    organizationId: string,
    libraryId: string,
    floorId: string,
    sourceVersionId: string,
    userId: string,
  ): Promise<FloorPlanVersionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.getFloor(organizationId, libraryId, floorId);

    // Verify source version exists
    const sourceRows = await tenantDs.query(
      `SELECT * FROM "floor_plan_versions" WHERE "version_id" = $1 AND "floor_id" = $2`,
      [sourceVersionId, floorId],
    );
    if (sourceRows.length === 0) {
      throw new NotFoundException(`Source version not found: ${sourceVersionId}`);
    }
    const source = sourceRows[0];

    // Get or create draft version
    const draft = await this.getOrCreateDraft(organizationId, libraryId, floorId, userId);

    // Clone source elements into the draft
    await tenantDs.transaction(async (tx) => {
      await tx.query(`DELETE FROM "spatial_layouts" WHERE "version_id" = $1`, [draft.versionId]);
      await tx.query(
        `INSERT INTO "spatial_layouts" ("version_id", "linked_location_id", "element_type", "x", "y", "width", "height", "rotation", "z_index", "properties")
         SELECT $1, "linked_location_id", "element_type", "x", "y", "width", "height", "rotation", "z_index", "properties"
         FROM "spatial_layouts"
         WHERE "version_id" = $2`,
        [draft.versionId, sourceVersionId],
      );
    });

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId: userId,
        action: 'RESTORE_FLOOR_PLAN_VERSION',
        entityType: 'FLOOR_PLAN_VERSION',
        entityId: draft.versionId,
        newValue: { sourceVersionId, sourceVersionNumber: source.version_number },
      });
    }

    const elements = await this.getSpatialElements(tenantDs, draft.versionId);
    return {
      ...draft,
      elementCount: elements.length,
      elements,
    };
  }

  // ==========================================
  // 4. LOGICAL RACK INSPECTION FOR LINKING
  // ==========================================

  async getLogicalRacks(
    organizationId: string,
    libraryId: string,
    floorId?: string,
  ): Promise<LogicalRackDto[]> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const params: any[] = [libraryId];
    let where = `l.library_id = $1 AND l.location_type = 'RACK'`;
    if (floorId) {
      params.push(floorId);
      where += ` AND l.floor_id = $2`;
    }

    const query = `
      SELECT
        l.location_id as "locationId",
        l.library_id as "libraryId",
        l.floor_id as "floorId",
        l.code,
        l.name,
        (
          SELECT COUNT(*)
          FROM "locations" shelf
          WHERE shelf.parent_location_id = l.location_id AND shelf.location_type = 'SHELF'
        )::int as "shelfCount",
        (
          SELECT COUNT(*)
          FROM "book_copies" bc
          JOIN "locations" shelf ON shelf.location_id = bc.home_location_id
          WHERE shelf.parent_location_id = l.location_id AND bc.library_id = $1
        )::int as "totalCopiesCount"
      FROM "locations" l
      WHERE ${where}
      ORDER BY l.code ASC
    `;

    const rows = await tenantDs.query(query, params);

    return rows.map((r: any) => ({
      locationId: r.locationId,
      libraryId: r.libraryId,
      floorId: r.floorId,
      code: r.code,
      name: r.name,
      shelfCount: parseInt(r.shelfCount || '0', 10),
      totalCopiesCount: parseInt(r.totalCopiesCount || '0', 10),
    }));
  }

  /**
   * Aggregates circulation heatmap metrics across all physical racks on a floor level.
   */
  async getCirculationHeatmap(
    organizationId: string,
    libraryId: string,
    floorId: string,
    timeRange: '30d' | '90d' | 'all' = '30d',
  ): Promise<FloorCirculationHeatmapResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const floor = await this.getFloor(organizationId, libraryId, floorId);

    // Build time interval condition
    let timeClause = '';
    if (timeRange === '30d') {
      timeClause = `AND ln.checked_out_at >= NOW() - INTERVAL '30 days'`;
    } else if (timeRange === '90d') {
      timeClause = `AND ln.checked_out_at >= NOW() - INTERVAL '90 days'`;
    }

    // 1. Query all racks on this floor with total loans, active loans, and total copies
    const query = `
      SELECT
        r.location_id as "locationId",
        r.code as "rackCode",
        r.name as "rackName",
        COALESCE(SUM(CASE WHEN ln.loan_id IS NOT NULL THEN 1 ELSE 0 END), 0)::int as "totalLoans",
        COALESCE(SUM(CASE WHEN ln.status = 'ACTIVE' THEN 1 ELSE 0 END), 0)::int as "activeLoans",
        COUNT(DISTINCT bc.copy_id)::int as "totalCopies"
      FROM "locations" r
      LEFT JOIN "locations" shelf ON shelf.parent_location_id = r.location_id AND shelf.location_type = 'SHELF'
      LEFT JOIN "book_copies" bc ON bc.home_location_id = shelf.location_id AND bc.library_id = $1
      LEFT JOIN "loans" ln ON ln.copy_id = bc.copy_id AND ln.library_id = $1 ${timeClause}
      WHERE r.library_id = $1 AND r.floor_id = $2 AND r.location_type = 'RACK'
      GROUP BY r.location_id, r.code, r.name
      ORDER BY "totalLoans" DESC, r.code ASC
    `;

    const rows = await tenantDs.query(query, [libraryId, floorId]);

    // 2. Query top genre and book title per rack
    const topMetadataQuery = `
      WITH ranked_metadata AS (
        SELECT
          r.location_id,
          cat.name as "genreName",
          b.title as "bookTitle",
          COUNT(ln.loan_id) as "loanCount",
          ROW_NUMBER() OVER (PARTITION BY r.location_id ORDER BY COUNT(ln.loan_id) DESC) as rn
        FROM "locations" r
        JOIN "locations" shelf ON shelf.parent_location_id = r.location_id AND shelf.location_type = 'SHELF'
        JOIN "book_copies" bc ON bc.home_location_id = shelf.location_id AND bc.library_id = $1
        JOIN "loans" ln ON ln.copy_id = bc.copy_id AND ln.library_id = $1 ${timeClause}
        JOIN "editions" ed ON ed.edition_id = bc.edition_id
        JOIN "books" b ON b.book_id = ed.book_id
        LEFT JOIN "categories" cat ON cat.category_id = ed.category_id
        WHERE r.library_id = $1 AND r.floor_id = $2 AND r.location_type = 'RACK'
        GROUP BY r.location_id, cat.name, b.title
      )
      SELECT location_id, "genreName", "bookTitle"
      FROM ranked_metadata
      WHERE rn = 1
    `;

    const topMetadataMap: Record<string, { topGenre?: string; topBookTitle?: string }> = {};
    try {
      const topMetaRows = await tenantDs.query(topMetadataQuery, [libraryId, floorId]);
      for (const m of topMetaRows) {
        topMetadataMap[m.location_id] = {
          topGenre: m.genreName || undefined,
          topBookTitle: m.bookTitle || undefined,
        };
      }
    } catch {
      // Non-fatal if categories or joins return empty
    }

    let maxLoans = 0;
    let totalFloorLoans = 0;
    let peakRackCode: string | undefined;

    const parsedRacks = rows.map((r: any) => {
      const totalLoans = parseInt(r.totalLoans || '0', 10);
      const activeLoans = parseInt(r.activeLoans || '0', 10);
      const totalCopies = parseInt(r.totalCopies || '0', 10);
      const turnoverRate = totalCopies > 0 ? parseFloat((totalLoans / totalCopies).toFixed(2)) : 0;
      const cleanRackCode = r.rackCode.replace(/^F\d+-R?/, '');

      totalFloorLoans += totalLoans;
      if (totalLoans > maxLoans) {
        maxLoans = totalLoans;
        peakRackCode = cleanRackCode;
      }

      return {
        locationId: r.locationId,
        rackCode: cleanRackCode,
        rackName: r.rackName,
        totalLoans,
        activeLoans,
        totalCopies,
        turnoverRate,
        heatScore: 0,
        topGenre: topMetadataMap[r.locationId]?.topGenre,
        topBookTitle: topMetadataMap[r.locationId]?.topBookTitle,
      };
    });

    const racks: RackCirculationHeatmapDto[] = parsedRacks.map((pr: any) => ({
      ...pr,
      heatScore: maxLoans > 0 ? parseFloat((pr.totalLoans / maxLoans).toFixed(2)) : 0,
    }));

    return {
      floorId,
      floorName: floor.name,
      floorNumber: floor.floorNumber,
      timeRange,
      totalFloorLoans,
      peakRackCode: maxLoans > 0 ? peakRackCode : undefined,
      peakLoanCount: maxLoans,
      racks,
    };
  }
}
