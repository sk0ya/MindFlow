import { z } from 'zod';

// ユーザー関連のスキーマ
export const UserSchema = z.object({
  id: z.string().email('Valid email address required'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const AuthTokenSchema = z.object({
  id: z.string().min(32, 'Token must be at least 32 characters'),
  user_id: z.string().email(),
  expires_at: z.string().datetime(),
  used_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

// JWT ペイロードのスキーマ
export const JWTPayloadSchema = z.object({
  userId: z.string().email(),
  email: z.string().email(),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

// 認証関連のリクエスト/レスポンススキーマ
export const LoginRequestSchema = z.object({
  email: z.string().email('Valid email address required'),
});

export const VerifyTokenRequestSchema = z.object({
  token: z.string().min(32, 'Invalid token format'),
});

export const AuthResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: z.object({
    id: z.string().email(),
    email: z.string().email(),
    displayName: z.string().optional(),
    createdAt: z.string(),
    lastLoginAt: z.string(),
  }).optional(),
  accessToken: z.string().optional(),
  token: z.string().optional(), // フロントエンド互換性のため
  magicLink: z.string().url().optional(), // 開発環境のみ
  emailSent: z.boolean().optional(),
});

// 型の抽出
export type User = z.infer<typeof UserSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type VerifyTokenRequest = z.infer<typeof VerifyTokenRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// 認証結果の型
export interface AuthResult {
  authenticated: boolean;
  user?: {
    userId: string;
    email: string;
  };
  error?: string;
  status?: number;
}

// JWT関連のユーティリティ型
export interface JWTHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}