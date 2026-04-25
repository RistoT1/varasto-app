'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Varasto API',
      version: '1.0.0',
      description:
        'Inventory management REST API for Varasto. ' +
        'All endpoints (except /health and /api/auth/login) require a Bearer JWT token.',
    },
    servers: [{ url: '/api', description: 'API base' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'Not found' } },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 50 },
            total: { type: 'integer', example: 320 },
            pages: { type: 'integer', example: 7 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'matti' },
            active: { type: 'boolean', example: true },
            permission: { type: 'string', nullable: true, example: 'Admin' },
            permissionId: { type: 'integer', nullable: true, example: 2 },
          },
        },
        UserInput: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 64 },
            password: { type: 'string', minLength: 6, format: 'password' },
            kayttolupa_id: { type: 'integer', nullable: true },
          },
        },
        Role: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Admin' },
            userCount: { type: 'integer', example: 3 },
          },
        },
        Warehouse: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'A2OP02' },
            cabinetCount: { type: 'integer', example: 5 },
            shelfCount: { type: 'integer', example: 20 },
          },
        },
        WarehouseInput: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', maxLength: 64 } },
        },
        Cabinet: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            number: { type: 'string', example: '1.1' },
            shelfCount: { type: 'integer', example: 4 },
            warehouse: {
              type: 'object',
              properties: { id: { type: 'integer' }, name: { type: 'string' } },
            },
          },
        },
        CabinetInput: {
          type: 'object',
          required: ['number', 'varasto_id'],
          properties: {
            number: { type: 'string', maxLength: 8 },
            varasto_id: { type: 'integer' },
          },
        },
        Shelf: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            number: { type: 'string', example: '1.1.1' },
            itemCount: { type: 'integer', example: 7 },
            cabinet: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                number: { type: 'string' },
                warehouse: { type: 'string' },
              },
            },
          },
        },
        ShelfInput: {
          type: 'object',
          required: ['number', 'kaappi_id'],
          properties: {
            number: { type: 'string', maxLength: 8 },
            kaappi_id: { type: 'integer' },
          },
        },
        ProductGroup: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Mittalaitteet' },
            itemCount: { type: 'integer', example: 12 },
          },
        },
        ProductGroupInput: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', maxLength: 64 } },
        },
        Box: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Kaapeli-boksi A' },
            itemCount: { type: 'integer', example: 5 },
          },
        },
        BoxInput: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', maxLength: 128 } },
        },
        Item: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Yleismittari 1' },
            note: { type: 'string', example: 'DT-9118' },
            tag: { type: 'string', example: 'RIL 1', nullable: true },
            productGroup: {
              nullable: true,
              type: 'object',
              properties: { id: { type: 'integer' }, name: { type: 'string' } },
            },
            shelf: {
              nullable: true,
              type: 'object',
              properties: {
                id: { type: 'integer' },
                number: { type: 'string' },
                cabinet: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    number: { type: 'string' },
                    warehouse: {
                      type: 'object',
                      properties: { id: { type: 'integer' }, name: { type: 'string' } },
                    },
                  },
                },
              },
            },
            box: {
              nullable: true,
              type: 'object',
              properties: { id: { type: 'integer' }, name: { type: 'string' } },
            },
          },
        },
        ItemInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', maxLength: 128 },
            note: { type: 'string', maxLength: 255 },
            tag: { type: 'string', maxLength: 16, nullable: true },
            tuoteryhma_id: { type: 'integer', nullable: true },
            hylly_id: { type: 'integer', nullable: true },
            laatikko_id: { type: 'integer', nullable: true },
          },
        },
        Reservation: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            startedAt: { type: 'string', format: 'date-time' },
            returnedAt: { type: 'string', format: 'date-time', nullable: true },
            active: { type: 'boolean' },
            user: {
              nullable: true,
              type: 'object',
              properties: { id: { type: 'integer' }, name: { type: 'string' } },
            },
            item: {
              nullable: true,
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                tag: { type: 'string', nullable: true },
                shelf: { type: 'string', nullable: true },
                cabinet: { type: 'string', nullable: true },
                warehouse: { type: 'string', nullable: true },
              },
            },
          },
        },
        ImportResult: {
          type: 'object',
          properties: {
            inserted: { type: 'integer' },
            updated: { type: 'integer' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  row: { type: 'integer' },
                  name: { type: 'string' },
                  error: { type: 'string' },
                },
              },
            },
          },
        },
        Stats: {
          type: 'object',
          properties: {
            items: { type: 'integer' },
            warehouses: { type: 'integer' },
            cabinets: { type: 'integer' },
            shelves: { type: 'integer' },
            boxes: { type: 'integer' },
            productGroups: { type: 'integer' },
            activeUsers: { type: 'integer' },
            reservations: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                active: { type: 'integer' },
              },
            },
            unlocatedItems: { type: 'integer' },
          },
        },
        SearchBucket: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 42, description: 'Total matches in DB (may exceed data array length)' },
            data: { type: 'array', items: { type: 'object' } },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            query:         { type: 'string', example: 'cisco' },
            total:         { type: 'integer', example: 24, description: 'Grand total across all buckets' },
            items:         { $ref: '#/components/schemas/SearchBucket' },
            warehouses:    { $ref: '#/components/schemas/SearchBucket' },
            cabinets:      { $ref: '#/components/schemas/SearchBucket' },
            shelves:       { $ref: '#/components/schemas/SearchBucket' },
            boxes:         { $ref: '#/components/schemas/SearchBucket' },
            productGroups: { $ref: '#/components/schemas/SearchBucket' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',           description: 'Authentication' },
      { name: 'Search',         description: 'Unified cross-entity search' },
      { name: 'Items',          description: 'Inventory items (tavarat)' },
      { name: 'Warehouses',     description: 'Warehouses (varastot)' },
      { name: 'Cabinets',       description: 'Cabinets (kaapit)' },
      { name: 'Shelves',        description: 'Shelves (hyllyt)' },
      { name: 'Product Groups', description: 'Product groups (tuoteryhmat)' },
      { name: 'Boxes',          description: 'Boxes (laatikot)' },
      { name: 'Reservations',   description: 'Loans / reservations (varaukset)' },
      { name: 'Users',          description: 'Users (kayttaja_tiedot)' },
      { name: 'Roles',          description: 'Permission roles (kayttoluvat)' },
      { name: 'Stats',          description: 'Dashboard statistics' },
      { name: 'Import/Export',  description: 'Bulk CSV/JSON import and export' },
    ],
    paths: {

      // ── Search ───────────────────────────────────────────────────────────────
      '/search': {
        get: {
          tags: ['Search'],
          summary: 'Unified search across all entity types',
          description:
            'Searches items, warehouses, cabinets, shelves, boxes and product groups in a ' +
            'single request. All six table queries run in parallel. Results are grouped by ' +
            'entity type. Each bucket includes a `total` (full DB match count) and a `data` ' +
            'array capped at `limit`.',
          parameters: [
            {
              in: 'query',
              name: 'q',
              required: true,
              schema: { type: 'string', minLength: 3 },
              description: 'Search term (minimum 3 characters)',
              example: 'cisco',
            },
            {
              in: 'query',
              name: 'limit',
              schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
              description: 'Max results per bucket',
            },
          ],
          responses: {
            200: {
              description: 'Search results grouped by entity type',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SearchResult' },
                  example: {
                    query: 'cisco',
                    total: 24,
                    items:         { total: 20, data: [{ id: 193, name: 'Cisco 800series 1', note: '', tag: null }] },
                    warehouses:    { total: 0,  data: [] },
                    cabinets:      { total: 0,  data: [] },
                    shelves:       { total: 0,  data: [] },
                    boxes:         { total: 4,  data: [{ id: 36, name: 'VA03 Cisco ASA 5505 powerit 1' }] },
                    productGroups: { total: 0,  data: [] },
                  },
                },
              },
            },
            400: { description: 'Missing or empty `q` parameter' },
            401: { description: 'Unauthorized' },
          },
        },
      },

      // ── Auth ────────────────────────────────────────────────────────────────
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login and receive JWT',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'password'],
                  properties: {
                    username: { type: 'string' },
                    password: { type: 'string', format: 'password' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
            401: { description: 'Invalid credentials' },
            429: { description: 'Too many login attempts' },
          },
        },
      },

      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user from token',
          responses: {
            200: {
              description: 'Current user',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { user: { $ref: '#/components/schemas/User' } },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
      },

      // ── Items ────────────────────────────────────────────────────────────────
      '/items': {
        get: {
          tags: ['Items'],
          summary: 'List items (paginated, filterable)',
          parameters: [
            { in: 'query', name: 'page',          schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit',         schema: { type: 'integer', default: 50 } },
            { in: 'query', name: 'tuoteryhma_id', schema: { type: 'integer' } },
            { in: 'query', name: 'varasto_id',    schema: { type: 'integer' } },
            { in: 'query', name: 'kaappi_id',     schema: { type: 'integer' } },
            { in: 'query', name: 'hylly_id',      schema: { type: 'integer' } },
            { in: 'query', name: 'sort',  schema: { type: 'string', enum: ['id', 'name', 'tuoteryhma'] } },
            { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
          ],
          responses: {
            200: {
              description: 'Paginated items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data:       { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Items'],
          summary: 'Create item',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemInput' } } },
          },
          responses: {
            201: { description: 'Created',        content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
            409: { description: 'Duplicate name or tag' },
            422: { description: 'Validation error' },
          },
        },
      },

      '/items/search': {
        get: {
          tags: ['Items'],
          summary: 'Search items by name, tag or note',
          parameters: [
            { in: 'query', name: 'q',     required: true, schema: { type: 'string' } },
            { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            200: {
              description: 'Matching items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data:       { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/items/{id}': {
        get: {
          tags: ['Items'],
          summary: 'Get single item',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Item',      content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
            404: { description: 'Not found' },
          },
        },
        put: {
          tags: ['Items'],
          summary: 'Replace item',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemInput' } } } },
          responses: {
            200: { description: 'Updated item', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
            404: { description: 'Not found' },
            409: { description: 'Duplicate name or tag' },
          },
        },
        patch: {
          tags: ['Items'],
          summary: 'Partially update item',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemInput' } } } },
          responses: {
            200: { description: 'Updated item', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
            404: { description: 'Not found' },
            422: { description: 'No updatable fields provided' },
          },
        },
        delete: {
          tags: ['Items'],
          summary: 'Delete item (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            204: { description: 'Deleted' },
            403: { description: 'Forbidden' },
            404: { description: 'Not found' },
          },
        },
      },

      // ── Warehouses ──────────────────────────────────────────────────────────
      '/warehouses': {
        get: {
          tags: ['Warehouses'],
          summary: 'List all warehouses',
          responses: {
            200: {
              description: 'List of warehouses',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Warehouse' } } } },
            },
          },
        },
        post: {
          tags: ['Warehouses'],
          summary: 'Create warehouse (admin)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WarehouseInput' } } } },
          responses: {
            201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Warehouse' } } } },
          },
        },
      },

      '/warehouses/search': {
        get: {
          tags: ['Warehouses'],
          summary: 'Search warehouses by name',
          parameters: [{ in: 'query', name: 'q', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Matching warehouses',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Warehouse' } } } },
            },
          },
        },
      },

      '/warehouses/{id}': {
        get: {
          tags: ['Warehouses'],
          summary: 'Get warehouse',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Warehouse', content: { 'application/json': { schema: { $ref: '#/components/schemas/Warehouse' } } } },
            404: { description: 'Not found' },
          },
        },
        put: {
          tags: ['Warehouses'],
          summary: 'Update warehouse (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WarehouseInput' } } } },
          responses: {
            200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Warehouse' } } } },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Warehouses'],
          summary: 'Delete warehouse (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      '/warehouses/{id}/cabinets': {
        get: {
          tags: ['Warehouses'],
          summary: 'List cabinets in a warehouse',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: {
              description: 'Cabinets',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Cabinet' } } } },
            },
          },
        },
      },

      '/warehouses/{id}/items': {
        get: {
          tags: ['Warehouses'],
          summary: 'List items in a warehouse (paginated)',
          parameters: [
            { in: 'path',  name: 'id',    required: true, schema: { type: 'integer' } },
            { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            200: {
              description: 'Paginated items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data:       { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Cabinets ─────────────────────────────────────────────────────────────
      '/cabinets': {
        get: {
          tags: ['Cabinets'],
          summary: 'List all cabinets',
          parameters: [
            { in: 'query', name: 'varasto_id', schema: { type: 'integer' }, description: 'Filter by warehouse ID' },
          ],
          responses: {
            200: {
              description: 'List of cabinets',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Cabinet' } } } },
            },
          },
        },
        post: {
          tags: ['Cabinets'],
          summary: 'Create cabinet (admin)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CabinetInput' } } } },
          responses: {
            201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Cabinet' } } } },
          },
        },
      },

      '/cabinets/search': {
        get: {
          tags: ['Cabinets'],
          summary: 'Search cabinets by number',
          parameters: [{ in: 'query', name: 'q', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Matching cabinets',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Cabinet' } } } },
            },
          },
        },
      },

      '/cabinets/{id}': {
        get: {
          tags: ['Cabinets'],
          summary: 'Get cabinet',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Cabinet', content: { 'application/json': { schema: { $ref: '#/components/schemas/Cabinet' } } } },
            404: { description: 'Not found' },
          },
        },
        put: {
          tags: ['Cabinets'],
          summary: 'Update cabinet (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CabinetInput' } } } },
          responses: {
            200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Cabinet' } } } },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Cabinets'],
          summary: 'Delete cabinet (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      '/cabinets/{id}/shelves': {
        get: {
          tags: ['Cabinets'],
          summary: 'List shelves in a cabinet',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: {
              description: 'Shelves',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Shelf' } } } },
            },
          },
        },
      },

      // ── Shelves ──────────────────────────────────────────────────────────────
      '/shelves': {
        get: {
          tags: ['Shelves'],
          summary: 'List all shelves',
          parameters: [
            { in: 'query', name: 'kaappi_id', schema: { type: 'integer' }, description: 'Filter by cabinet ID' },
          ],
          responses: {
            200: {
              description: 'List of shelves',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Shelf' } } } },
            },
          },
        },
        post: {
          tags: ['Shelves'],
          summary: 'Create shelf (admin)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ShelfInput' } } } },
          responses: {
            201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Shelf' } } } },
          },
        },
      },

      '/shelves/search': {
        get: {
          tags: ['Shelves'],
          summary: 'Search shelves by number',
          parameters: [{ in: 'query', name: 'q', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Matching shelves',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Shelf' } } } },
            },
          },
        },
      },

      '/shelves/{id}': {
        get: {
          tags: ['Shelves'],
          summary: 'Get shelf',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Shelf', content: { 'application/json': { schema: { $ref: '#/components/schemas/Shelf' } } } },
            404: { description: 'Not found' },
          },
        },
        put: {
          tags: ['Shelves'],
          summary: 'Update shelf (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ShelfInput' } } } },
          responses: {
            200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Shelf' } } } },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Shelves'],
          summary: 'Delete shelf (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      '/shelves/{id}/items': {
        get: {
          tags: ['Shelves'],
          summary: 'List items on a shelf (paginated)',
          parameters: [
            { in: 'path',  name: 'id',    required: true, schema: { type: 'integer' } },
            { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            200: {
              description: 'Paginated items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data:       { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Product Groups ───────────────────────────────────────────────────────
      '/product-groups': {
        get: {
          tags: ['Product Groups'],
          summary: 'List all product groups',
          responses: {
            200: {
              description: 'List of product groups',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ProductGroup' } } } },
            },
          },
        },
        post: {
          tags: ['Product Groups'],
          summary: 'Create product group (admin)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductGroupInput' } } } },
          responses: {
            201: { description: 'Created',           content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductGroup' } } } },
            409: { description: 'Name already exists' },
          },
        },
      },

      '/product-groups/search': {
        get: {
          tags: ['Product Groups'],
          summary: 'Search product groups by name',
          parameters: [{ in: 'query', name: 'q', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Matching groups',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ProductGroup' } } } },
            },
          },
        },
      },

      '/product-groups/{id}': {
        put: {
          tags: ['Product Groups'],
          summary: 'Update product group (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductGroupInput' } } } },
          responses: {
            200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductGroup' } } } },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Product Groups'],
          summary: 'Delete product group (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      '/product-groups/{id}/items': {
        get: {
          tags: ['Product Groups'],
          summary: 'List items in a product group (paginated)',
          parameters: [
            { in: 'path',  name: 'id',    required: true, schema: { type: 'integer' } },
            { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            200: {
              description: 'Paginated items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data:       { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Boxes ────────────────────────────────────────────────────────────────
      '/boxes': {
        get: {
          tags: ['Boxes'],
          summary: 'List all boxes',
          responses: {
            200: {
              description: 'List of boxes',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Box' } } } },
            },
          },
        },
        post: {
          tags: ['Boxes'],
          summary: 'Create box (admin)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BoxInput' } } } },
          responses: {
            201: { description: 'Created',           content: { 'application/json': { schema: { $ref: '#/components/schemas/Box' } } } },
            409: { description: 'Name already exists' },
          },
        },
      },

      '/boxes/search': {
        get: {
          tags: ['Boxes'],
          summary: 'Search boxes by name',
          parameters: [{ in: 'query', name: 'q', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Matching boxes',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Box' } } } },
            },
          },
        },
      },

      '/boxes/{id}': {
        get: {
          tags: ['Boxes'],
          summary: 'Get box',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Box',      content: { 'application/json': { schema: { $ref: '#/components/schemas/Box' } } } },
            404: { description: 'Not found' },
          },
        },
        put: {
          tags: ['Boxes'],
          summary: 'Update box (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BoxInput' } } } },
          responses: {
            200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Box' } } } },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Boxes'],
          summary: 'Delete box (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      '/boxes/{id}/items': {
        get: {
          tags: ['Boxes'],
          summary: 'List items in a box (paginated)',
          parameters: [
            { in: 'path',  name: 'id',    required: true, schema: { type: 'integer' } },
            { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            200: {
              description: 'Paginated items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data:       { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Reservations ─────────────────────────────────────────────────────────
      '/reservations': {
        get: {
          tags: ['Reservations'],
          summary: 'List reservations',
          parameters: [
            { in: 'query', name: 'active',  schema: { type: 'boolean' } },
            { in: 'query', name: 'user_id', schema: { type: 'integer' } },
            { in: 'query', name: 'item_id', schema: { type: 'integer' } },
            { in: 'query', name: 'page',    schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit',   schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            200: {
              description: 'Paginated reservations',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data:       { type: 'array', items: { $ref: '#/components/schemas/Reservation' } },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Reservations'],
          summary: 'Create reservation',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['item_id'],
                  properties: {
                    item_id: { type: 'integer' },
                    user_id: { type: 'integer', nullable: true, description: 'Defaults to the authenticated user' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Reservation' } } } },
            422: { description: 'item_id or user_id does not exist' },
          },
        },
      },

      '/reservations/{id}': {
        get: {
          tags: ['Reservations'],
          summary: 'Get reservation',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Reservation', content: { 'application/json': { schema: { $ref: '#/components/schemas/Reservation' } } } },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Reservations'],
          summary: 'Delete reservation (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      '/reservations/{id}/return': {
        patch: {
          tags: ['Reservations'],
          summary: 'Mark reservation as returned',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Updated reservation', content: { 'application/json': { schema: { $ref: '#/components/schemas/Reservation' } } } },
            404: { description: 'Active reservation not found' },
          },
        },
      },

      // ── Users ────────────────────────────────────────────────────────────────
      '/users': {
        get: {
          tags: ['Users'],
          summary: 'List all users (admin)',
          responses: {
            200: {
              description: 'List of users',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } },
            },
          },
        },
        post: {
          tags: ['Users'],
          summary: 'Create user (admin)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserInput' } } } },
          responses: {
            201: { description: 'Created',              content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
            409: { description: 'Username already taken' },
          },
        },
      },

      '/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Get user (admin or self)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'User',      content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
            403: { description: 'Forbidden' },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Users'],
          summary: 'Delete user (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            204: { description: 'Deleted' },
            400: { description: 'Cannot delete yourself' },
            404: { description: 'Not found' },
          },
        },
      },

      '/users/{id}/password': {
        patch: {
          tags: ['Users'],
          summary: 'Change password (admin or self)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['password'],
                  properties: { password: { type: 'string', minLength: 6, format: 'password' } },
                },
              },
            },
          },
          responses: {
            200: { description: 'Password updated' },
            403: { description: 'Forbidden' },
            404: { description: 'Not found' },
          },
        },
      },

      '/users/{id}/status': {
        patch: {
          tags: ['Users'],
          summary: 'Activate or deactivate user (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['active'],
                  properties: { active: { type: 'boolean' } },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Updated',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { id: { type: 'integer' }, active: { type: 'boolean' } } },
                },
              },
            },
            404: { description: 'Not found' },
          },
        },
      },

      // ── Roles ────────────────────────────────────────────────────────────────
      '/roles': {
        get: {
          tags: ['Roles'],
          summary: 'List all roles',
          responses: {
            200: {
              description: 'List of roles',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Role' } } } },
            },
          },
        },
        post: {
          tags: ['Roles'],
          summary: 'Create role (admin)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string', maxLength: 128 } },
                },
              },
            },
          },
          responses: {
            201: { description: 'Created',           content: { 'application/json': { schema: { $ref: '#/components/schemas/Role' } } } },
            409: { description: 'Role already exists' },
          },
        },
      },

      '/roles/{id}': {
        get: {
          tags: ['Roles'],
          summary: 'Get role',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Role',      content: { 'application/json': { schema: { $ref: '#/components/schemas/Role' } } } },
            404: { description: 'Not found' },
          },
        },
        put: {
          tags: ['Roles'],
          summary: 'Update role (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string', maxLength: 128 } },
                },
              },
            },
          },
          responses: {
            200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Role' } } } },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Roles'],
          summary: 'Delete role (admin)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      // ── Stats ────────────────────────────────────────────────────────────────
      '/stats': {
        get: {
          tags: ['Stats'],
          summary: 'Overall inventory counts',
          responses: {
            200: {
              description: 'Summary counts',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Stats' } } },
            },
          },
        },
      },

      '/stats/warehouses': {
        get: {
          tags: ['Stats'],
          summary: 'Item, shelf and cabinet counts per warehouse',
          responses: {
            200: {
              description: 'Per-warehouse stats',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id:       { type: 'integer' },
                        name:     { type: 'string' },
                        cabinets: { type: 'integer' },
                        shelves:  { type: 'integer' },
                        items:    { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/stats/groups': {
        get: {
          tags: ['Stats'],
          summary: 'Item count per product group',
          responses: {
            200: {
              description: 'Per-group stats',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id:    { type: 'integer' },
                        name:  { type: 'string' },
                        items: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/stats/activity': {
        get: {
          tags: ['Stats'],
          summary: 'Reservation activity per day',
          parameters: [
            { in: 'query', name: 'days', schema: { type: 'integer', default: 30, minimum: 1, maximum: 365 } },
          ],
          responses: {
            200: {
              description: 'Daily activity',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        day:                   { type: 'string', format: 'date' },
                        reservations_started:  { type: 'integer' },
                        returned:              { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Export ───────────────────────────────────────────────────────────────
      '/export/items.csv': {
        get: {
          tags: ['Import/Export'],
          summary: 'Export all items as CSV',
          responses: {
            200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } } },
          },
        },
      },

      '/export/items.json': {
        get: {
          tags: ['Import/Export'],
          summary: 'Export all items as JSON',
          responses: {
            200: {
              description: 'JSON array of items',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Item' } } } },
            },
          },
        },
      },

      '/export/warehouses.json': {
        get: {
          tags: ['Import/Export'],
          summary: 'Export full warehouse tree as JSON',
          responses: {
            200: { description: 'Nested warehouse/cabinet/shelf/item tree' },
          },
        },
      },

      '/export/reservations.csv': {
        get: {
          tags: ['Import/Export'],
          summary: 'Export all reservations as CSV (admin)',
          responses: {
            200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } } },
          },
        },
      },

      // ── Import ───────────────────────────────────────────────────────────────
      '/import/items/csv': {
        post: {
          tags: ['Import/Export'],
          summary: 'Bulk import items from CSV file (admin)',
          parameters: [
            {
              in: 'query',
              name: 'create_locations',
              schema: { type: 'integer', enum: [0, 1] },
              description: 'Set to 1 to auto-create missing warehouses, cabinets and shelves',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: { file: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
          responses: {
            200: { description: 'Import result', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportResult' } } } },
            400: { description: 'No file uploaded or CSV parse error' },
            422: { description: 'All rows failed validation' },
          },
        },
      },

      '/import/items/json': {
        post: {
          tags: ['Import/Export'],
          summary: 'Bulk import items from JSON body (admin)',
          parameters: [
            {
              in: 'query',
              name: 'create_locations',
              schema: { type: 'integer', enum: [0, 1] },
              description: 'Set to 1 to auto-create missing warehouses, cabinets and shelves',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                      name:          { type: 'string' },
                      note:          { type: 'string' },
                      tag:           { type: 'string' },
                      product_group: { type: 'string' },
                      warehouse:     { type: 'string' },
                      cabinet:       { type: 'string' },
                      shelf:         { type: 'string' },
                      box:           { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Import result', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportResult' } } } },
            400: { description: 'Invalid body' },
            422: { description: 'All rows failed validation' },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);