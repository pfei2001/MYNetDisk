import router from "./plugins/router"
import storage from "./utils/storage";

router.beforeEach((to, from, next) => {
    // console.log(to.path)
    const path = to.path
    const authed = storage.local.get('mynetdisk-authed')
    // 不需要授权的页面
    if (path === '/auth' || path.startsWith('/delete') || path.startsWith('/s/') || to.meta.public) {
        next()
        return
    }
    if (!authed) {
        router.push('/auth')
        return
    }
    next()
})

