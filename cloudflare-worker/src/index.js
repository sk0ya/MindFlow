// MindFlow API
import { handleAuthRequest } from './handlers/auth.js';
import { corsHeaders } from './utils/cors.js';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders(env.CORS_ORIGIN)
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

      if (path.startsWith('/api/mindmaps')) {
        const { handleRequest } = await import('./handlers/mindmaps.js');
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
            ...corsHeaders(env.CORS_ORIGIN)
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
      DROP TABLE IF EXISTS mindmaps;
      DROP TABLE IF EXISTS auth_tokens;
      DROP TABLE IF EXISTS users;

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE auth_tokens (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE mindmaps (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE INDEX idx_mindmaps_user_id ON mindmaps(user_id);
      CREATE INDEX idx_mindmaps_updated_at ON mindmaps(updated_at);
      CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);
      CREATE INDEX idx_auth_tokens_expires ON auth_tokens(expires_at);
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