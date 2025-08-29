import { type AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types';
declare class ApiService {
    private instance;
    constructor();
    private setupInterceptors;
    setAuthToken(token: string | null): void;
    get<T>(url: string, params?: any): Promise<AxiosResponse<ApiResponse<T>>>;
    post<T>(url: string, data?: any): Promise<AxiosResponse<ApiResponse<T>>>;
    put<T>(url: string, data?: any): Promise<AxiosResponse<ApiResponse<T>>>;
    patch<T>(url: string, data?: any): Promise<AxiosResponse<ApiResponse<T>>>;
    delete<T>(url: string): Promise<AxiosResponse<ApiResponse<T>>>;
    upload(url: string, formData: FormData): Promise<AxiosResponse<any>>;
}
export declare const api: ApiService;
export {};
