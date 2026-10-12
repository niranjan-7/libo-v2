import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  BookWorkDto,
  BookCopyDto,
  CatalogSearchResponse,
  FloorPlanResponse,
  RackDetailResponse,
  InventoryStatsResponse,
  OrgRole,
} from '@library/contracts';
import { CatalogService } from './catalog.service';
import { CatalogQueryDto, CreateBookCopyDto, InventoryQueryDto } from './dto/catalog.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';

@Controller('organizations/:orgId/libraries/:libraryId')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * Search and filter the library catalog
   */
  @Get('catalog')
  async searchCatalog(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Query() query: CatalogQueryDto,
  ): Promise<CatalogSearchResponse> {
    return this.catalogService.searchCatalog(orgId, libraryId, query);
  }

  /**
   * Get work details, published editions, and physical copy inventory in this library
   */
  @Get('catalog/:bookId')
  async getBookDetails(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('bookId') bookId: string,
  ): Promise<BookWorkDto> {
    return this.catalogService.getBookDetails(orgId, libraryId, bookId);
  }

  /**
   * Copy inventory lookup with condition/status filters and KPI summary
   */
  @Get('inventory')
  async getInventory(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Query() query: InventoryQueryDto,
  ): Promise<{ items: BookCopyDto[]; stats: InventoryStatsResponse; total: number }> {
    return this.catalogService.getInventory(orgId, libraryId, query);
  }

  /**
   * Register a new physical copy into the library's physical inventory
   */
  @Post('inventory')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async createCopy(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Body() dto: CreateBookCopyDto,
  ): Promise<BookCopyDto> {
    return this.catalogService.createCopy(orgId, libraryId, dto);
  }

  /**
   * Floor plan visual map with spatial fixtures linked to logical racks
   */
  @Get('floor-plan')
  async getFloorPlan(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Query('floor') floorNumber?: string,
  ): Promise<FloorPlanResponse> {
    const floor = floorNumber ? parseInt(floorNumber, 10) : 1;
    return this.catalogService.getFloorPlan(orgId, libraryId, floor);
  }

  /**
   * Shelf-by-shelf copy inspection for a specific rack fixture
   */
  @Get('locations/racks/:rackCode/shelves')
  async getRackShelves(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('rackCode') rackCode: string,
  ): Promise<RackDetailResponse> {
    return this.catalogService.getRackShelves(orgId, libraryId, rackCode);
  }

  /**
   * Explicitly re-seed demo catalog and locations for this library
   */
  @Post('catalog/seed')
  @HttpCode(HttpStatus.OK)
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async seedDemo(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.catalogService.seedLibrary(orgId, libraryId);
    return { success: true, message: 'Demo catalog successfully populated.' };
  }
}
