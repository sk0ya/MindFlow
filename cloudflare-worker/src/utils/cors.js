export function corsHeaders(origin = '*', requestOrigin = null) {
  // Allow multiple origins for development
  const allowedOrigins = [
    'https://sk0ya.github.io',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173'
  ];
  
  // If requestOrigin is provided and is in the allowed list, use it
  // Otherwise, fall back to the configured origin
  let allowOrigin = origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    allowOrigin = requestOrigin;
  }
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
}