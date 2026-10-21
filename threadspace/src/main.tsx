import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { CartProvider } from './lib/cart';
import { isSupabaseConfigured } from './lib/supabase';
import './index.css';

function ConfigError() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="font-display text-3xl">Supabase isn’t configured</h1>
      <p className="mt-3 text-sm text-sand-500">
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (copy <code>.env.example</code> to <code>.env</code> locally,
        or add them as environment variables in Netlify), then rebuild.
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <ConfigError />
    )}
  </StrictMode>,
);
