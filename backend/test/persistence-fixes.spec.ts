import { ConflictException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoriesService } from '../src/organization/categories/categories.service';
import { LabelsService } from '../src/organization/labels/labels.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Fix 2 & Fix 3: Persistence Regression Tests', () => {
  const userId = '00000000-0000-4000-8000-000000000001';

  describe('CategoriesService — Archived Category Collisions & Reactivation', () => {
    let service: CategoriesService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        sessionCategory: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      };
      service = new CategoriesService(mockPrisma);
    });

    it('creates a new category when no existing record exists', async () => {
      mockPrisma.sessionCategory.findFirst.mockResolvedValue(null);
      mockPrisma.sessionCategory.create.mockResolvedValue({
        id: 'cat-1',
        userId,
        name: 'Mathematics',
        color: '#6366F1',
        isArchived: false,
      });

      const result = await service.create(userId, { name: 'Mathematics', color: '#6366F1' });

      expect(mockPrisma.sessionCategory.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'Mathematics',
          color: '#6366F1',
        },
      });
      expect(result.id).toBe('cat-1');
      expect(result.isArchived).toBe(false);
    });

    it('reactivates an archived category preserving its ID', async () => {
      // First check for active category returns null
      // Second check for archived category returns archived record
      mockPrisma.sessionCategory.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'cat-archived-1',
          userId,
          name: 'Physics',
          color: '#10B981',
          isArchived: true,
        });

      mockPrisma.sessionCategory.update.mockResolvedValue({
        id: 'cat-archived-1',
        userId,
        name: 'Physics',
        color: '#3B82F6',
        isArchived: false,
      });

      const result = await service.create(userId, { name: 'Physics', color: '#3B82F6' });

      expect(mockPrisma.sessionCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-archived-1' },
        data: {
          isArchived: false,
          name: 'Physics',
          color: '#3B82F6',
        },
      });
      expect(result.id).toBe('cat-archived-1');
      expect(result.isArchived).toBe(false);
      expect(mockPrisma.sessionCategory.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException (409) if an active category with the same name exists', async () => {
      mockPrisma.sessionCategory.findFirst.mockResolvedValueOnce({
        id: 'cat-active-1',
        userId,
        name: 'Chemistry',
        color: '#EF4444',
        isArchived: false,
      });

      await expect(
        service.create(userId, { name: 'chemistry' }), // testing case-insensitivity
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.sessionCategory.create).not.toHaveBeenCalled();
      expect(mockPrisma.sessionCategory.update).not.toHaveBeenCalled();
    });

    it('handles P2002 unique constraint race condition during concurrent creation', async () => {
      mockPrisma.sessionCategory.findFirst
        .mockResolvedValueOnce(null) // initial active check passes
        .mockResolvedValueOnce(null) // initial archived check passes
        .mockResolvedValueOnce({    // post-race check finds archived category
          id: 'cat-race-archived',
          userId,
          name: 'Biology',
          color: '#10B981',
          isArchived: true,
        });

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`userId`,`name`)',
        { code: 'P2002', clientVersion: '6.0.0' },
      );
      mockPrisma.sessionCategory.create.mockRejectedValue(p2002Error);

      mockPrisma.sessionCategory.update.mockResolvedValue({
        id: 'cat-race-archived',
        userId,
        name: 'Biology',
        color: '#10B981',
        isArchived: false,
      });

      const result = await service.create(userId, { name: 'Biology', color: '#10B981' });

      expect(mockPrisma.sessionCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-race-archived' },
        data: {
          isArchived: false,
          name: 'Biology',
          color: '#10B981',
        },
      });
      expect(result.id).toBe('cat-race-archived');
    });
  });

  describe('LabelsService — Archived Label Collisions & Reactivation', () => {
    let service: LabelsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        sessionLabel: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        sessionCategory: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
        },
      };
      service = new LabelsService(mockPrisma);
    });

    it('creates a new label when none exists', async () => {
      mockPrisma.sessionLabel.findFirst.mockResolvedValue(null);
      mockPrisma.sessionLabel.create.mockResolvedValue({
        id: 'lbl-1',
        userId,
        name: 'Calculus',
        color: '#10B981',
        isArchived: false,
      });

      const result = await service.create(userId, { name: 'Calculus', color: '#10B981' });

      expect(mockPrisma.sessionLabel.create).toHaveBeenCalled();
      expect(result.id).toBe('lbl-1');
      expect(result.isArchived).toBe(false);
    });

    it('reactivates an archived label preserving its ID and updating category', async () => {
      mockPrisma.sessionCategory.findUnique.mockResolvedValue({
        id: 'cat-123',
        userId,
      });
      mockPrisma.sessionLabel.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'lbl-archived-1',
          userId,
          name: 'Algebra',
          color: '#6366F1',
          isArchived: true,
          categoryId: null,
        });

      mockPrisma.sessionLabel.update.mockResolvedValue({
        id: 'lbl-archived-1',
        userId,
        name: 'Algebra',
        color: '#6366F1',
        isArchived: false,
        categoryId: 'cat-123',
      });

      const result = await service.create(userId, { name: 'Algebra', categoryId: 'cat-123' });

      expect(mockPrisma.sessionLabel.update).toHaveBeenCalledWith({
        where: { id: 'lbl-archived-1' },
        data: {
          isArchived: false,
          name: 'Algebra',
          categoryId: 'cat-123',
        },
        include: { category: true },
      });
      expect(result.id).toBe('lbl-archived-1');
      expect(result.isArchived).toBe(false);
    });

    it('throws ConflictException (409) if an active label with the same name exists', async () => {
      mockPrisma.sessionLabel.findFirst.mockResolvedValueOnce({
        id: 'lbl-active-1',
        userId,
        name: 'Geometry',
        color: '#F59E0B',
        isArchived: false,
      });

      await expect(
        service.create(userId, { name: 'geometry' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.sessionLabel.create).not.toHaveBeenCalled();
    });

    it('handles P2002 race condition during label creation', async () => {
      mockPrisma.sessionLabel.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'lbl-race-archived',
          userId,
          name: 'Topology',
          color: '#8B5CF6',
          isArchived: true,
        });

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`userId`,`name`)',
        { code: 'P2002', clientVersion: '6.0.0' },
      );
      mockPrisma.sessionLabel.create.mockRejectedValue(p2002Error);

      mockPrisma.sessionLabel.update.mockResolvedValue({
        id: 'lbl-race-archived',
        userId,
        name: 'Topology',
        color: '#8B5CF6',
        isArchived: false,
      });

      const result = await service.create(userId, { name: 'Topology' });

      expect(mockPrisma.sessionLabel.update).toHaveBeenCalledWith({
        where: { id: 'lbl-race-archived' },
        data: {
          isArchived: false,
          name: 'Topology',
        },
        include: { category: true },
      });
      expect(result.id).toBe('lbl-race-archived');
    });
  });

  describe('Fix 3: HttpExceptionFilter — Prisma Database Error Normalization', () => {
    let filter: HttpExceptionFilter;
    let mockResponse: any;
    let mockRequest: any;
    let mockArgumentsHost: any;

    beforeEach(() => {
      filter = new HttpExceptionFilter();
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockRequest = {
        method: 'POST',
        url: '/api/v1/categories',
      };
      mockArgumentsHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      };
    });

    it('maps Prisma P2002 (Unique constraint violation) to HTTP 409 Conflict', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`userId`, `name`)',
        {
          code: 'P2002',
          clientVersion: '6.0.0',
          meta: { target: ['userId', 'name'] },
        },
      );

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          error: 'Conflict',
          message: expect.stringContaining('Unique constraint violation'),
          path: '/api/v1/categories',
        }),
      );
    });

    it('maps Prisma P2025 (Record not found) to HTTP 404 Not Found', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'An operation failed because it depends on one or more records that were required but not found',
        {
          code: 'P2025',
          clientVersion: '6.0.0',
        },
      );

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'Not Found',
          message: expect.stringContaining('not found or has been removed'),
        }),
      );
    });

    it('maps Prisma P2003 (Foreign key constraint failed) to HTTP 409 Conflict', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed on the field: `categoryId`',
        {
          code: 'P2003',
          clientVersion: '6.0.0',
        },
      );

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          error: 'Conflict',
          message: expect.stringContaining('Database relational constraint prevented this operation'),
        }),
      );
    });

    it('maps Prisma P2000 (Value too long) to HTTP 400 Bad Request', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'The provided value for the column is too long for the column type',
        {
          code: 'P2000',
          clientVersion: '6.0.0',
        },
      );

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          error: 'Bad Request',
          message: expect.stringContaining('maximum allowed field length'),
        }),
      );
    });

    it('handles unexpected Prisma errors safely without exposing internal SQL or stack traces', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'SELECT * FROM "secret_table" WHERE password = \'raw_secret\'; Table does not exist',
        {
          code: 'P2021',
          clientVersion: '6.0.0',
        },
      );

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          error: 'Internal Server Error',
        }),
      );
      // Ensure raw SQL query is never in message
      const responsePayload = mockResponse.json.mock.calls[0][0];
      expect(responsePayload.message).not.toContain('raw_secret');
      expect(responsePayload.message).not.toContain('SELECT * FROM');
    });

    it('preserves standard NestJS HttpExceptions', () => {
      const error = new NotFoundException('Timer mode not found');

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'Not Found',
          message: 'Timer mode not found',
        }),
      );
    });

    it('handles generic unhandled Error safely', () => {
      const error = new Error('Disk IO write failure in /var/lib/postgresql');

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          error: 'Internal Server Error',
        }),
      );
    });
  });
});
