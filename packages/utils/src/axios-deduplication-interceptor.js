/**
 * Axios Interceptor for Request Deduplication
 *
 * Automatically deduplicates Axios requests with same URL, method, and params
 */
import { RequestDeduplicator, } from "./request-deduplication";
const DEDUP_KEY_SYMBOL = Symbol("dedupKey");
const DEDUP_SKIP_SYMBOL = Symbol("dedupSkip");
/**
 * Generate cache key from Axios request config
 */
function generateRequestKey(config) {
    const { method = "get", url = "", params, data } = config;
    // Normalize method to lowercase
    const normalizedMethod = method.toLowerCase();
    // Sort params for consistent keys
    const sortedParams = params
        ? JSON.stringify(Object.keys(params)
            .sort()
            .reduce((acc, key) => {
            acc[key] = params[key];
            return acc;
        }, {}))
        : "";
    // For POST/PUT/PATCH, include body in key (but limit size)
    const bodyKey = normalizedMethod === "post" ||
        normalizedMethod === "put" ||
        normalizedMethod === "patch"
        ? JSON.stringify(data).slice(0, 500) // Limit body to 500 chars for key
        : "";
    return `${normalizedMethod}:${url}:${sortedParams}:${bodyKey}`;
}
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
export function installAxiosDeduplication(axiosInstance, options = {}) {
    const deduplicator = new RequestDeduplicator({
        cacheDuration: 5000,
        maxCacheSize: 100,
        debug: false,
        ...options,
    });
    // Request interceptor - add deduplication
    const requestInterceptor = axiosInstance.interceptors.request.use((config) => {
        const extendedConfig = config;
        // Skip deduplication if explicitly requested
        if (extendedConfig[DEDUP_SKIP_SYMBOL]) {
            return config;
        }
        // Generate deduplication key
        const dedupKey = generateRequestKey(config);
        extendedConfig[DEDUP_KEY_SYMBOL] = dedupKey;
        return config;
    }, (error) => Promise.reject(error));
    // Response interceptor - handle deduplication
    const responseInterceptor = axiosInstance.interceptors.response.use((response) => response, (error) => {
        // On error, invalidate cache for this request
        const config = error.config;
        if (config && config[DEDUP_KEY_SYMBOL]) {
            deduplicator.invalidate(config[DEDUP_KEY_SYMBOL]);
        }
        return Promise.reject(error);
    });
    // Wrap axios methods with deduplication
    const originalGet = axiosInstance.get;
    const originalPost = axiosInstance.post;
    const originalPut = axiosInstance.put;
    const originalPatch = axiosInstance.patch;
    const originalDelete = axiosInstance.delete;
    // GET requests - always deduplicate
    axiosInstance.get = function (url, config) {
        const extendedConfig = (config || {});
        if (extendedConfig[DEDUP_SKIP_SYMBOL]) {
            return originalGet.call(this, url, config);
        }
        const dedupKey = generateRequestKey({ ...config, method: "get", url });
        const ttl = extendedConfig.dedupTTL;
        return deduplicator.dedupe(dedupKey, () => originalGet.call(this, url, config), { ttl });
    };
    // POST requests - deduplicate only if cache key is same
    axiosInstance.post = function (url, data, config) {
        const extendedConfig = (config || {});
        if (extendedConfig[DEDUP_SKIP_SYMBOL]) {
            return originalPost.call(this, url, data, config);
        }
        const dedupKey = generateRequestKey({
            ...config,
            method: "post",
            url,
            data,
        });
        const ttl = extendedConfig.dedupTTL ?? 1000; // Shorter TTL for POST (1s)
        return deduplicator.dedupe(dedupKey, () => originalPost.call(this, url, data, config), { ttl });
    };
    // PUT requests - deduplicate with short TTL
    axiosInstance.put = function (url, data, config) {
        const extendedConfig = (config || {});
        if (extendedConfig[DEDUP_SKIP_SYMBOL]) {
            return originalPut.call(this, url, data, config);
        }
        const dedupKey = generateRequestKey({
            ...config,
            method: "put",
            url,
            data,
        });
        const ttl = extendedConfig.dedupTTL ?? 1000;
        return deduplicator.dedupe(dedupKey, () => originalPut.call(this, url, data, config), { ttl });
    };
    // PATCH requests - deduplicate with short TTL
    axiosInstance.patch = function (url, data, config) {
        const extendedConfig = (config || {});
        if (extendedConfig[DEDUP_SKIP_SYMBOL]) {
            return originalPatch.call(this, url, data, config);
        }
        const dedupKey = generateRequestKey({
            ...config,
            method: "patch",
            url,
            data,
        });
        const ttl = extendedConfig.dedupTTL ?? 1000;
        return deduplicator.dedupe(dedupKey, () => originalPatch.call(this, url, data, config), { ttl });
    };
    // DELETE requests - don't deduplicate by default (use skipDedup to force)
    axiosInstance.delete = function (url, config) {
        return originalDelete.call(this, url, config);
    };
    // Cleanup function
    return () => {
        axiosInstance.interceptors.request.eject(requestInterceptor);
        axiosInstance.interceptors.response.eject(responseInterceptor);
        axiosInstance.get = originalGet;
        axiosInstance.post = originalPost;
        axiosInstance.put = originalPut;
        axiosInstance.patch = originalPatch;
        axiosInstance.delete = originalDelete;
        deduplicator.clear();
    };
}
/**
 * Skip deduplication for a specific request
 *
 * @example
 * api.get('/users', skipDedup())
 */
export function skipDedup() {
    return {
        [DEDUP_SKIP_SYMBOL]: true,
    };
}
/**
 * Set custom TTL for a specific request
 *
 * @example
 * api.get('/menu', withDedupTTL(30000)) // Cache for 30s
 */
export function withDedupTTL(ttl) {
    return {
        dedupTTL: ttl,
    };
}
/**
 * Combine multiple config options
 *
 * @example
 * api.get('/data', combineConfigs(
 *   withDedupTTL(10000),
 *   { headers: { 'X-Custom': 'value' } }
 * ))
 */
export function combineConfigs(...configs) {
    return Object.assign({}, ...configs);
}
