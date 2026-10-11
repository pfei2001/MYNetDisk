import { Ok, Fail, FailCode } from '../type'
import StatusCode from '../type'
import type { User, UserStats } from '../type'
import { auth, getOrCreateAdminUser, type AppEnv } from '../middleware/auth'

/**
 * 获取当前用户信息
 * GET /user/me（需要 auth 中间件）
 */
export const userMeHandler = async (c: any) => {
    const user = c.get('user') as User | undefined
    if (!user) {
        return c.json(FailCode('需要登录', StatusCode.NotAuth))
    }
    const dbUser = await getOrCreateAdminUser(c.env.DB)
    return c.json(Ok({
        id: dbUser.id,
        login: dbUser.login,
        name: dbUser.name,
        avatarUrl: '',
        role: 'admin',
        canViewAll: true,
        storageQuota: dbUser.storageQuota,
        storageUsed: dbUser.storageUsed,
        uploadCount: dbUser.uploadCount
    }))
}

/**
 * 获取当前用户的统计信息（图片数、总大小、近 7 天上传）
 * GET /user/me/stats（需要 auth 中间件）
 */
export const userMeStatsHandler = async (c: any) => {
    const user = c.get('user') as User | undefined
    if (!user) {
        return c.json(FailCode('需要登录', StatusCode.NotAuth))
    }
    try {
        const [imageCount, totalSize, recentUploads] = await Promise.all([
            c.env.DB.prepare(
                'SELECT COUNT(*) as count FROM images WHERE user_login = ?'
            ).bind('admin').first<{ count: number }>(),
            c.env.DB.prepare(
                'SELECT COALESCE(SUM(size), 0) as total FROM images WHERE user_login = ?'
            ).bind('admin').first<{ total: number }>(),
            c.env.DB.prepare(
                `SELECT COUNT(*) as count FROM images
                 WHERE user_login = ? AND created_at >= datetime('now', '-7 days')`
            ).bind('admin').first<{ count: number }>()
        ])

        return c.json(Ok(<UserStats>{
            totalImages: imageCount?.count || 0,
            totalSize: totalSize?.total || 0,
            totalViews: 0,
            recentUploads: recentUploads?.count || 0
        }))
    } catch (e) {
        console.error('Failed to get user stats:', e)
        return c.json(Fail(`获取统计失败: ${(e as Error).message}`))
    }
}

export { auth }
export type { AppEnv }
