// Polyfill to ensure fetch is available for Supabase
// This prevents dynamic imports of @supabase/node-fetch
import 'react-native-url-polyfill/auto';

// Make sure fetch is globally available
if (typeof global.fetch === 'undefined') {
  // @ts-ignore
  global.fetch = fetch;
}

if (typeof global.Headers === 'undefined') {
  // @ts-ignore
  global.Headers = Headers;
}

if (typeof global.Request === 'undefined') {
  // @ts-ignore
  global.Request = Request;
}

if (typeof global.Response === 'undefined') {
  // @ts-ignore
  global.Response = Response;
}

export {};

