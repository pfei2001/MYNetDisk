<script setup lang="ts">
import { faCog, faUpload, faSignOutAlt, faUserCircle, faShieldAlt, faBars, faChevronRight, faShareAlt, faFolder } from '@fortawesome/free-solid-svg-icons'
import { useRouter, useRoute } from 'vue-router'
import { ElAvatar, ElDropdown, ElDropdownMenu, ElDropdownItem, ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import storage from '../utils/storage'
import ThemeToggle from '../components/ThemeToggle.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import type { User } from '../utils/types'
import { requestCurrentUser, requestLogout } from '../utils/request'
import logoUrl from '../assets/mynetdisk-logo.svg'
const adminAvatarUrl = 'data:image/png;base64,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'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const repoLink = 'https://github.com/roimdev'
const repoName = 'roim-picx'

const authed = ref(!!storage.local.get('mynetdisk-authed'))
const currentUser = ref<User | null>(null)
const isAdmin = ref(true) // 单用户模式：登录即管理员

// 管理员头像：优先用账号设置的头像，没有则用内置默认头像
const avatarSrc = computed(() => currentUser.value?.avatar_url || adminAvatarUrl)

const updateUserInfo = async () => {
    const a = storage.local.get('mynetdisk-authed')
    authed.value = !!a
    if (a) {
        try {
            const userInfo = await requestCurrentUser()
            currentUser.value = {
                id: userInfo.id,
                login: userInfo.login,
                name: userInfo.name,
                avatar_url: userInfo.avatarUrl || '',
                role: 'admin',
                canViewAll: true
            } as User
        } catch (e) {
            currentUser.value = null
        }
    } else {
        currentUser.value = null
    }
}

watch(() => route.path, () => {
    updateUserInfo()
})

const navItems = computed(() => {
    const items = [
        { path: '/up', label: t('nav.upload'), icon: faUpload },
        { path: '/', label: t('nav.manage'), icon: faCog },
        { path: '/albums', label: t('nav.albums'), icon: faFolder },
        { path: '/shares', label: t('nav.myShares'), icon: faShareAlt }
    ]
    if (isAdmin.value) {
        items.push({ path: '/admin', label: t('nav.admin'), icon: faShieldAlt })
    }
    return items
})

onMounted(() => {
    updateUserInfo()
})

const handleNavClick = (item: any) => {
    router.push(item.path)
}

const logout = async () => {
    try {
        await ElMessageBox.confirm(
            t('nav.logoutConfirmMsg'),
            t('nav.logoutConfirmTitle'),
            {
                confirmButtonText: t('common.confirm'),
                cancelButtonText: t('common.cancel'),
                type: 'warning',
            }
        )
        try { await requestLogout() } catch (e) { /* 忽略登出请求失败 */ }
        storage.local.remove('mynetdisk-authed')
        authed.value = false
        currentUser.value = null
        ElMessage.success(t('nav.logout'))
        router.push('/auth')
    } catch (e) {
        // User cancelled
    }
}
</script>

<template>
    <div class="flex flex-col min-h-screen">
        <!-- Header -->
        <div
            class="w-full h-16 bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-800/50 sticky left-0 top-0 backdrop-blur-md z-50 transition-all duration-300">
            <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
                <div class="flex items-center gap-3 cursor-pointer" @click="router.push('/')">
                    <img :src="logoUrl" class="w-8 h-8 object-contain drop-shadow-sm" alt="mynetdisk" />
                </div>

                <div class="flex items-center gap-2">
                    <!-- Desktop Navigation -->
                    <div class="hidden md:flex items-center gap-2">
                        <div v-for="item in navItems" :key="item.path"
                            class="px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 flex items-center gap-2"
                            :class="[
                                $route.path === item.path
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                            ]" @click="handleNavClick(item)">
                            <font-awesome-icon :icon="item.icon" />
                            <span>{{ item.label }}</span>
                        </div>
                    </div>

                    <!-- User Profile / Logout (Desktop Only) -->
                    <div v-if="authed"
                        class="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700 ml-2">
                        <div class="flex items-center gap-2 group relative cursor-pointer" @click="logout"
                            title="点击退出登录">
                            <div class="relative">
                                <el-avatar :size="32" :src="avatarSrc"
                                    class="ring-2 ring-white dark:ring-gray-800 shadow-sm transition-transform group-hover:scale-105">
                                    <template #default>
                                        <font-awesome-icon :icon="faUserCircle" class="text-xl text-gray-400" />
                                    </template>
                                </el-avatar>
                                <span
                                    class="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"
                                    title="Admin"></span>
                            </div>
                            <div class="hidden lg:flex flex-col items-start leading-none gap-1">
                                <span class="text-xs font-bold text-gray-700 dark:text-gray-200">{{
                                    currentUser?.name || 'Administrator' }}</span>
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Admin</span>
                            </div>
                            <div
                                class="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/10 rounded-full md:rounded-lg transition-colors -m-1">
                            </div>
                        </div>
                    </div>

                    <!-- Essential Actions (Theme, Language, Mobile Avatar) -->
                    <div
                        class="flex items-center gap-3 pl-2 sm:pl-4 border-l border-gray-200 dark:border-gray-700 ml-1 sm:ml-2">
                        <!-- Mobile Avatar (Hidden on Desktop) -->
                        <div v-if="authed" class="md:hidden">
                            <el-avatar :size="28" :src="avatarSrc">
                                <template #default>
                                    <font-awesome-icon :icon="faUserCircle" class="text-lg text-gray-400" />
                                </template>
                            </el-avatar>
                        </div>
                        <LanguageSwitcher />
                        <theme-toggle />
                    </div>

                    <!-- Mobile Menu Icon (Far Right) -->
                    <div class="md:hidden flex items-center border-l border-gray-200 dark:border-gray-700 pl-2">
                        <el-dropdown trigger="click"
                            @command="(cmd: string) => cmd === 'logout' ? logout() : router.push(cmd)">
                            <div
                                class="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                                <font-awesome-icon :icon="faBars" class="text-xl" />
                            </div>
                            <template #dropdown>
                                <el-dropdown-menu class="w-48">
                                    <el-dropdown-item v-for="item in navItems" :key="item.path" :command="item.path">
                                        <div class="flex items-center justify-between w-full py-1">
                                            <div class="flex items-center gap-3">
                                                <font-awesome-icon :icon="item.icon" class="w-4" />
                                                <span>{{ item.label }}</span>
                                            </div>
                                            <font-awesome-icon :icon="faChevronRight" class="text-[10px] opacity-30" />
                                        </div>
                                    </el-dropdown-item>
                                    <el-dropdown-item v-if="authed" divided command="logout" class="!text-red-500">
                                        <div class="flex items-center gap-3 py-1">
                                            <font-awesome-icon :icon="faSignOutAlt" class="w-4" />
                                            <span>{{ $t('nav.logout') }}</span>
                                        </div>
                                    </el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 w-full min-h-[calc(100vh-64px-64px)]">
            <router-view />
        </div>

        <!-- Footer -->
        <div
            class="w-full py-6 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm mt-auto">
            <div class="max-w-7xl mx-auto flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                <span class="mr-1">Powered by</span>
                <a :href="repoLink" target="_blank"
                    class="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors hover:underline">
                    {{ repoName }}
                </a>
            </div>
        </div>
    </div>
</template>
