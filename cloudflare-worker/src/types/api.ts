import { z } from 'zod';

// マインドマップ関連のスキーマ
export const MindMapNodeSchema: z.ZodLazy<z.ZodObject<{
  id: z.ZodString;
  text: z.ZodString;
  x: z.ZodNumber;
  y: z.ZodNumber;
  width: z.ZodOptional<z.ZodNumber>;
  height: z.ZodOptional<z.ZodNumber>;
  color: z.ZodOptional<z.ZodString>;
  backgroundColor: z.ZodOptional<z.ZodString>;
  fontSize: z.ZodOptional<z.ZodNumber>;
  fontWeight: z.ZodOptional<z.ZodEnum<['normal', 'bold']>>;
  borderRadius: z.ZodOptional<z.ZodNumber>;
  borderWidth: z.ZodOptional<z.ZodNumber>;
  borderColor: z.ZodOptional<z.ZodString>;
  children: z.ZodDefault<z.ZodArray<z.ZodLazy<any>, 'many'>>;
}>> = z.lazy(() => z.object({
  id: z.string().min(1),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
  borderRadius: z.number().min(0).optional(),
  borderWidth: z.number().min(0).optional(),
  borderColor: z.string().optional(),
  children: z.array(z.lazy(() => MindMapNodeSchema)).default([]),
}));

export const MindMapDataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title is required'),
  rootNode: MindMapNodeSchema,
  settings: z.object({
    autoSave: z.boolean(),
    autoLayout: z.boolean(),
  }).optional(),
  metadata: z.object({
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    version: z.number().int().positive(),
  }).optional(),
});

export const MindMapCreateRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  data: MindMapDataSchema.optional(),
});

export const MindMapUpdateRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  data: MindMapDataSchema.optional(),
});

// ファイル関連のスキーマ
export const FileAttachmentSchema = z.object({
  id: z.string().min(1),
  mindmap_id: z.string().min(1),
  node_id: z.string().min(1),
  file_name: z.string().min(1),
  original_name: z.string().min(1),
  file_size: z.number().int().positive(),
  mime_type: z.string().min(1),
  storage_path: z.string().min(1),
  thumbnail_path: z.string().nullable(),
  attachment_type: z.enum(['image', 'video', 'audio', 'pdf', 'text', 'file']),
  uploaded_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
});

export const FileUploadRequestSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 10 * 1024 * 1024, // 10MB
    'File size must be less than 10MB'
  ).refine(
    (file) => file.name.length > 0,
    'File name is required'
  ),
});

// API共通レスポンススキーマ
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

// ページネーション
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });

// 型の抽出
export type MindMapNode = z.infer<typeof MindMapNodeSchema>;
export type MindMapData = z.infer<typeof MindMapDataSchema>;
export type MindMapCreateRequest = z.infer<typeof MindMapCreateRequestSchema>;
export type MindMapUpdateRequest = z.infer<typeof MindMapUpdateRequestSchema>;
export type FileAttachment = z.infer<typeof FileAttachmentSchema>;
export type FileUploadRequest = z.infer<typeof FileUploadRequestSchema>;
export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;

// HTTP Method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

// Request context type
export interface RequestContext {
  userId: string;
  userEmail: string;
  isAuthenticated: boolean;
  method: HttpMethod;
  url: URL;
  headers: Headers;
}