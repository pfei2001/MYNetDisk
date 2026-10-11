<template>
  <div
    class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300 relative overflow-hidden">

    <!-- Decoration bits -->
    <div class="absolute -top-24 -left-24 w-96 h-96 bg-indigo-100/50 dark:bg-indigo-900/10 rounded-full blur-3xl"></div>
    <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-100/50 dark:bg-purple-900/10 rounded-full blur-3xl">
    </div>

    <!-- 主题切换 -->
    <div class="absolute top-4 right-4 z-20">
      <ThemeToggle />
    </div>

    <div class="max-w-md w-full space-y-8 relative z-10">
      <div class="text-center">
        <div
          class="mx-auto h-16 w-16 bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center p-3 mb-6">
          <img src="../assets/picx-logo.png" class="h-full w-full object-contain" />
        </div>
        <h2 class="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{{ $t('auth.welcome') }}</h2>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {{ $t('auth.passwordHint') }}
        </p>
      </div>

      <div
        class="mt-8 bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
        <div class="space-y-6">
          <div class="space-y-3">
            <BaseInput v-model="password" :type="showPassword ? 'text' : 'password'" required
              :placeholder="$t('auth.passwordPlaceholder')" @keyup.enter="doLogin">
              <template #prefix>
                <font-awesome-icon :icon="faLock" class="text-sm" />
              </template>
              <template #suffix>
                <button type="button" class="text-gray-400 hover:text-indigo-600 transition-colors"
                  @click="showPassword = !showPassword">
                  <font-awesome-icon :icon="showPassword ? faEyeSlash : faEye" class="text-sm" />
                </button>
              </template>
            </BaseInput>
          </div>

          <div>
            <BaseButton type="indigo" block @click="doLogin" :loading="loading" class="!py-4 !text-sm !font-bold">
              <font-awesome-icon v-if="!loading" :icon="faSignInAlt" class="mr-2" />
              {{ loading ? $t('auth.verifying') : $t('auth.login') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import storage from '../utils/storage'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { requestLogin } from '../utils/request'
import { faLock, faEye, faEyeSlash, faSignInAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import BaseInput from '../components/common/BaseInput.vue'
import BaseButton from '../components/common/BaseButton.vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const password = ref('')
const loading = ref(false)
const showPassword = ref(false)
const router = useRouter()

const doLogin = async () => {
  if (!password.value) {
    ElMessage.error('请输入密码')
    return
  }
  loading.value = true
  try {
    await requestLogin(password.value)
    // 登录成功：后端已通过 httpOnly cookie 下发 session，前端只存一个已登录标记
    storage.local.set('mynetdisk-authed', '1')
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e: any) {
    ElMessage.error(e?.message || '密码错误')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
:deep(.el-input__wrapper) {
  padding: 12px 16px;
  border-radius: 0.5rem;
  box-shadow: 0 0 0 1px #e5e7eb inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #4f46e5 inset !important;
}
</style>
