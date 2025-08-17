// MindFlow API
import { handleAuthRequest } from './handlers/auth.js';
import { corsHeaders } from './utils/cors.js';

export default {
  async fetch(request, env, ctx) {
    const requestOrigin = request.headers.get('Origin');
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders(env.CORS_ORIGIN, requestOrigin)
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    console.log(`📡 API Request: ${request.method} ${path}`);

    try {
      // Routing
      if (path.startsWith('/api/auth')) {
        return await handleAuthRequest(request, env);
      }

      if (path.startsWith('/api/mindmaps') || path.startsWith('/api/maps')) {
        const { handleRequest } = await import('./handlers/mindmaps.js');
        return await handleRequest(request, env);
      }

      if (path.startsWith('/api/files')) {
        const { handleRequest } = await import('./handlers/files.js');
        return await handleRequest(request, env);
      }

      // Health check
      if (path === '/api/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
          }
        });
      }

      // バインディング確認用エンドポイント
      if (path === '/api/status') {
        const status = {
          timestamp: new Date().toISOString(),
          bindings: {
            DB: !!env.DB,
            FILES: !!env.FILES
          },
          env: {
            ENABLE_AUTH: env.ENABLE_AUTH,
            CORS_ORIGIN: env.CORS_ORIGIN,
            HAS_RESEND_KEY: !!env.RESEND_KEY,
            HAS_FROM_EMAIL: !!env.FROM_EMAIL,
            RESEND_KEY_LENGTH: env.RESEND_KEY?.length || 0
          }
        };
        return new Response(JSON.stringify(status, null, 2), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
          }
        });
      }

      // Database initialization for development
      if (path === '/api/init-db' && env.ENVIRONMENT === 'development') {
        return await initializeDatabase(env);
      }

      // 404 response
      return new Response(JSON.stringify({
        error: 'Endpoint not found',
        path: path
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });

    } catch (error) {
      console.error('❌ API Error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });
    }
  }
};

// Database initialization
async function initializeDatabase(env) {
  try {
    console.log('🔄 Database initialization...');

    const schemaSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS auth_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS mindmaps (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        mindmap_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        thumbnail_path TEXT,
        attachment_type TEXT NOT NULL,
        uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mindmap_id) REFERENCES mindmaps (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_mindmaps_user_id ON mindmaps(user_id);
      CREATE INDEX IF NOT EXISTS idx_mindmaps_updated_at ON mindmaps(updated_at);
      CREATE INDEX IF NOT EXISTS idx_attachments_mindmap_id ON attachments(mindmap_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_node_id ON attachments(node_id);
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at);
    `;

    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      if (statement) {
        await env.DB.prepare(statement).run();
      }
    }

    console.log('✅ Database initialization complete');

    return new Response(JSON.stringify({
      message: 'Database initialized successfully',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });

  } catch (error) {
    console.error('❌ Database initialization error:', error);
    
    return new Response(JSON.stringify({
      error: 'Database initialization failed',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  }
}