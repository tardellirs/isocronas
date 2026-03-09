// --- Configuração centralizada ---
export const BACKEND_URL = import.meta.env.PROD ? '' : '';

// API Keys — configure no arquivo .env na raiz do projeto
// VITE_ORS_API_KEY=sua_chave_openrouteservice
// VITE_GEMINI_API_KEY=sua_chave_gemini
export const DEFAULT_API_KEY = import.meta.env.VITE_ORS_API_KEY || '';
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export const MODES = [
    { id: 'driving-car', label: 'Carro', icon: 'car' },
    { id: 'cycling-regular', label: 'Bicicleta', icon: 'bike' },
    { id: 'foot-walking', label: 'Caminhada', icon: 'walking' },
];
