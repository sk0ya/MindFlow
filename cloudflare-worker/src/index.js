import { handleRequest } from './handlers/mindmaps.js';
import { handleAuthRequest } from './handlers/auth.js';
import { handleRequest as handleNodesRequest } from './handlers/nodes.js';
import { handleRequest as handleFilesRequest } from './handlers/files.js';
import { corsHeaders } from './utils/cors.js';

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(env.CORS_ORIGIN)
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Route handling
      if (path.startsWith('/api/mindmaps')) {
        return await handleRequest(request, env);
      }
      
      if (path.startsWith('/api/nodes')) {
        return await handleNodesRequest(request, env);
      }
      
      if (path.startsWith('/api/files')) {
        return await handleFilesRequest(request, env);
      }
      
      if (path.startsWith('/api/auth')) {
        return await handleAuthRequest(request, env);
      }

      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders(env.CORS_ORIGIN)
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders(env.CORS_ORIGIN)
      });
    }
  }
};