import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types/auth';

// API base URL - change in production
const API_URL = import.meta.env.VITE_API_URL || 'https://valiant-imagination-production-0462.up.railway.app/api';

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Token storage key
const TOKEN_KEY = 'forma_pilates_token';

// Get stored token
export function getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

// Store token
export function setStoredToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

// Remove token
export function removeStoredToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

// Request interceptor - add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = getStoredToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiError>) => {
        // Handle 401 - unauthorized
        if (error.response?.status === 401) {
            removeStoredToken();
            // Redirect to login if not already there
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

// Helper to extract error message
export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError;
        return apiError?.message || apiError?.error || 'Error de conexión';
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Error desconocido';
}
