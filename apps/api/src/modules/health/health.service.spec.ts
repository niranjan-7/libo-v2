import { HealthService } from './health.service';
import { DataSource } from 'typeorm';

describe('HealthService', () => {
  let service: HealthService;
  let isInitializedState = true;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    isInitializedState = true;
    mockQuery = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

    const mockDataSource = {
      get isInitialized() {
        return isInitializedState;
      },
      query: mockQuery,
    } as unknown as DataSource;

    service = new HealthService(mockDataSource);
  });

  it('should return status ok when database query succeeds', async () => {
    const result = await service.checkHealth();
    expect(result.status).toBe('ok');
    expect(result.database.controlPlane).toBe('connected');
    expect(typeof result.database.latencyMs).toBe('number');
    expect(result.version).toBe('0.1.0');
  });

  it('should return status degraded when database query fails', async () => {
    mockQuery.mockRejectedValue(new Error('Connection lost'));
    const result = await service.checkHealth();
    expect(result.status).toBe('degraded');
    expect(result.database.controlPlane).toBe('disconnected');
    expect(result.database.message).toBe('Connection lost');
  });

  it('should return degraded if DataSource is not initialized', async () => {
    isInitializedState = false;
    const result = await service.checkHealth();
    expect(result.status).toBe('degraded');
    expect(result.database.controlPlane).toBe('disconnected');
    expect(result.database.message).toContain('not initialized');
  });
});
