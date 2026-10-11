import { Context, Next } from 'hono'
import type { KVNamespace, R2Bucket, D1Database } from '@cloudflare/workers-types'
import { FailCode, NotAuth } from '../type'
import StatusCode from '../type'
import type { User } from '../type'

export type Bindings = {
    BASE_URL: string
    XK: KVNamespace  // KV（删除链接 token、上传限流计数）
    PICX: R2Bucket
    DB: D1Database  // D1 数据库
    ADMIN_PASSWORD: string  // 管理员密码（单用户），通过环境变量配置
    HF_TOKEN?: string // Hugging Face Token
    HF_REPO?: string // Hugging Face Repository (username/dataset)
    STORAGE_TYPE?: 'R2' | 'HF' // Default storage type
}

export type Variables = {
    user?: User
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }

export const SESSION_COOKIE = 'mynetdisk_session'
const SESSION_TTL = 30 * 24 * 3600 // 30 天（秒）

/**
 * 用 ADMIN_PASSWORD 对 payload 做 HMAC-SHA256 签名，生成 session token
 * token 格式：base64url(payload).base64url(signature)
 */
export async function createSessionToken(password: string, ttlSec: number = SESSION_TTL): Promise<string> {
    const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSec })
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
    const b64 = (buf: ArrayBuffer | string) => {
        const bytes = typeof buf === 'string' ? enc.encode(buf) : new Uint8Array(buf)
        let s = ''
        bytes.forEach(b => { s += String.fromCharCode(b) })
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    return `${b64(payload)}.${b64(sig)}`
}

/**
 * 校验 session token：签名正确且未过期
 */
export async function verifySessionToken(token: string, password: string): Promise<boolean> {
    try {
        const [p, s] = token.split('.')
        if (!p || !s) return false
        const unb64 = (str: string) => {
            const pad = str.replace(/-/g, '+').replace(/_/g, '/')
            const bin = atob(pad + '='.repeat((4 - pad.length % 4) % 4))
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            return bytes
        }
        const payloadBytes = unb64(p)
        const sigBytes = unb64(s)
        const enc = new TextEncoder()
        const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
        const valid = await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, payloadBytes.buffer as ArrayBuffer)
        if (!valid) return false
        const payload = JSON.parse(new TextDecoder().decode(payloadBytes))
        return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000)
    } catch {
        return false
    }
}

/**
 * 密码常量时间比较（防时序攻击）
 */
export async function safeCompare(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder()
    const ha = await crypto.subtle.digest('SHA-256', enc.encode(a))
    const hb = await crypto.subtle.digest('SHA-256', enc.encode(b))
    const ba = new Uint8Array(ha), bb = new Uint8Array(hb)
    if (ba.length !== bb.length) return false
    let diff = 0
    for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i]
    return diff === 0
}

function getCookie(c: Context<AppEnv>, name: string): string | undefined {
    const header = c.req.header('cookie')
    if (!header) return undefined
    for (const part of header.split(';')) {
        const idx = part.indexOf('=')
        if (idx < 0) continue
        if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim())
    }
    return undefined
}

/**
 * 单用户密码认证中间件：校验 httpOnly session cookie，
 * 兼容 X-API-Key（px_ 开头，用于 PicGo 等第三方工具）
 *
 * 注意：各路由按需挂载本中间件来启用保护；公开路由（分享页、
 * 删除链接、图片直链等）本身就不挂载它。
 */
export const auth = async (c: Context<AppEnv>, next: Next) => {
    if (c.req.method === 'OPTIONS') {
        await next()
        return
    }
    const password = c.env.ADMIN_PASSWORD
    if (!password) {
        return c.json(FailCode('ADMIN_PASSWORD is not configured', StatusCode.ServerError))
    }

    // 1. 优先校验 session cookie
    const cookieToken = getCookie(c, SESSION_COOKIE)
    if (cookieToken && await verifySessionToken(cookieToken, password)) {
        c.set('user', adminUser())
        await next()
        return
    }

    // 2. 兼容 API Key（X-API-Key 头或 Authorization: Bearer px_...）
    let apiKey = c.req.header('X-API-Key')
    if (!apiKey) {
        const h = c.req.header('Authorization')
        if (h && h.startsWith('Bearer ')) apiKey = h.slice(7)
    }
    if (apiKey && apiKey.startsWith('px_')) {
        const authed = await verifyApiKey(c, apiKey)
        if (authed) {
            // API Key 权限受限：仅允许上传、列表、删除
            const path = c.req.path
            const method = c.req.method
            const allowed =
                (path === '/rest/upload' && method === 'POST') ||
                (path === '/rest/list' && method === 'POST') ||
                (path === '/rest/' && method === 'DELETE')
            if (!allowed) {
                return c.json(FailCode('API Key 权限受限，仅允许上传、列表和删除', StatusCode.Forbidden))
            }
            c.set('user', adminUser())
            await next()
            return
        }
    }

    return c.json(NotAuth())
}

function adminUser(): User {
    return {
        id: 1,
        login: 'admin',
        name: 'Admin',
        avatar_url: '',
        role: 'admin',
        canViewAll: true
    } as User
}

/**
 * 校验 px_ 开头的 API Key（secret 做 SHA-256 比对）
 */
async function verifyApiKey(c: Context<AppEnv>, fullKey: string): Promise<boolean> {
    try {
        const [rawPrefix, secret] = fullKey.split('.')
        const prefix = rawPrefix ? rawPrefix.replace(/^px_/, '') : ''
        if (!prefix || !secret) return false
        const record = await c.env.DB.prepare(
            'SELECT key_hash, expires_at, is_active FROM api_keys WHERE key_prefix = ?'
        ).bind(prefix).first() as { key_hash: string; expires_at: string | null; is_active: number } | null
        if (!record || record.is_active !== 1) return false
        const enc = new TextEncoder()
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(secret))
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
        if (hashHex !== record.key_hash) return false
        if (record.expires_at) {
            const t = new Date(record.expires_at).getTime()
            if (!isNaN(t) && Date.now() > t) return false
        }
        c.executionCtx.waitUntil(
            c.env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE key_prefix = ?')
                .bind(new Date().toISOString(), prefix).run()
        )
        return true
    } catch (e) {
        console.error('API Key validation failed:', e)
        return false
    }
}

/**
 * 管理员权限中间件（单用户模式下登录即管理员）
 */
export const adminAuth = async (c: any, next: any) => {
    const user = c.get('user') as User | undefined
    if (!user) {
        return c.json(FailCode('需要登录', StatusCode.NotAuth))
    }
    await next()
}

/**
 * 获取或创建管理员用户行（用于 storage_used / upload_count 统计）
 */
export async function getOrCreateAdminUser(db: D1Database): Promise<User> {
    const row = await db.prepare(
        'SELECT id, login, name, role, can_view_all, storage_quota, storage_used, upload_count FROM users WHERE login = ?'
    ).bind('admin').first() as any
    if (row) {
        return {
            id: row.id, login: row.login, name: row.name || 'Admin', avatar_url: '',
            role: row.role, canViewAll: row.can_view_all === 1,
            storageQuota: row.storage_quota, storageUsed: row.storage_used, uploadCount: row.upload_count
        }
    }
    await db.prepare(
        `INSERT INTO users (login, name, role, can_view_all, storage_quota) VALUES ('admin', 'Admin', 'admin', 1, 0)`
    ).run()
    return { id: 1, login: 'admin', name: 'Admin', avatar_url: '', role: 'admin', canViewAll: true, storageQuota: 0, storageUsed: 0, uploadCount: 0 }
}
