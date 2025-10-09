/**
 * Axios Interceptor for Request Deduplication
 *
 * Automatically deduplicates Axios requests with same URL, method, and params
 */
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { type RequestDeduplicationOptions } from './request-deduplication';
/**
 * Install request deduplication interceptor on Axios instance
 *
 * @example
 * import axios from 'axios'
 * import { installAxiosDeduplication } from '@makanmakan/utils'
 *
 * const api = axios.create({ baseURL: '/api' })
 * installAxiosDeduplication(api, {
 *   cacheDuration: 5000,
 *   debug: import.meta.env.DEV
 * })
 */
export declare function installAxiosDeduplication(axiosInstance: AxiosInstance, options?: RequestDeduplicationOptions): () => void;
/**
 * Skip deduplication for a specific request
 *
 * @example
 * api.get('/users', skipDedup())
 */
export declare function skipDedup<D = any>(): AxiosRequestConfig<D>;
/**
 * Set custom TTL for a specific request
 *
 * @example
 * api.get('/menu', withDedupTTL(30000)) // Cache for 30s
 */
export declare function withDedupTTL<D = any>(ttl: number): AxiosRequestConfig<D>;
/**
 * Combine multiple config options
 *
 * @example
 * api.get('/data', combineConfigs(
 *   withDedupTTL(10000),
 *   { headers: { 'X-Custom': 'value' } }
 * ))
 */
export declare function combineConfigs<D = any>(...configs: AxiosRequestConfig<D>[]): AxiosRequestConfig<D>;
