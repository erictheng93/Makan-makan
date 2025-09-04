import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { Eye, EyeOff, AlertCircle } from 'lucide-vue-next';
const router = useRouter();
const authStore = useAuthStore();
const showPassword = ref(false);
const isLoading = ref(false);
const error = ref('');
const form = reactive({
    username: '',
    password: ''
});
const errors = reactive({
    username: '',
    password: ''
});
const validateForm = () => {
    errors.username = '';
    errors.password = '';
    if (!form.username.trim()) {
        errors.username = '請輸入帳號';
        return false;
    }
    if (!form.password) {
        errors.password = '請輸入密碼';
        return false;
    }
    if (form.password.length < 6) {
        errors.password = '密碼至少需要6個字符';
        return false;
    }
    return true;
};
const handleSubmit = async () => {
    if (!validateForm())
        return;
    isLoading.value = true;
    error.value = '';
    try {
        const result = await authStore.login(form.username, form.password);
        if (result.success) {
            router.push('/dashboard');
        }
        else {
            error.value = result.error || '登入失敗';
        }
    }
    catch (err) {
        error.value = '登入過程中發生錯誤';
    }
    finally {
        isLoading.value = false;
    }
};
// Clear errors when user types
// const clearErrors = () => {
//   errors.username = ''
//   errors.password = ''
//   error.value = ''
// }
// Auto-redirect if already authenticated
onMounted(() => {
    if (authStore.isAuthenticated) {
        router.push('/dashboard');
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "max-w-md w-full space-y-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mx-auto w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-white font-bold text-2xl" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "text-3xl font-bold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "mt-2 text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.form, __VLS_elements.form)({
    ...{ onSubmit: (__VLS_ctx.handleSubmit) },
    ...{ class: "mt-8 space-y-6" },
});
// @ts-ignore
[handleSubmit,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    for: "username",
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    id: "username",
    value: (__VLS_ctx.form.username),
    type: "text",
    required: true,
    autocomplete: "username",
    ...{ class: "form-input" },
    ...{ class: ({ 'border-red-500': __VLS_ctx.errors.username }) },
    placeholder: "請輸入帳號",
});
// @ts-ignore
[form, errors,];
if (__VLS_ctx.errors.username) {
    // @ts-ignore
    [errors,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "mt-1 text-sm text-red-600" },
    });
    (__VLS_ctx.errors.username);
    // @ts-ignore
    [errors,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    for: "password",
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    id: "password",
    type: (__VLS_ctx.showPassword ? 'text' : 'password'),
    required: true,
    autocomplete: "current-password",
    ...{ class: "form-input pr-10" },
    ...{ class: ({ 'border-red-500': __VLS_ctx.errors.password }) },
    placeholder: "請輸入密碼",
});
(__VLS_ctx.form.password);
// @ts-ignore
[form, errors, showPassword,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showPassword = !__VLS_ctx.showPassword;
            // @ts-ignore
            [showPassword, showPassword,];
        } },
    type: "button",
    ...{ class: "absolute inset-y-0 right-0 pr-3 flex items-center" },
});
if (__VLS_ctx.showPassword) {
    // @ts-ignore
    [showPassword,];
    const __VLS_0 = {}.Eye;
    /** @type {[typeof __VLS_components.Eye, ]} */ 
    // @ts-ignore
    Eye;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "w-4 h-4 text-gray-400" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "w-4 h-4 text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    const __VLS_5 = {}.EyeOff;
    /** @type {[typeof __VLS_components.EyeOff, ]} */ 
    // @ts-ignore
    EyeOff;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
        ...{ class: "w-4 h-4 text-gray-400" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "w-4 h-4 text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
if (__VLS_ctx.errors.password) {
    // @ts-ignore
    [errors,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "mt-1 text-sm text-red-600" },
    });
    (__VLS_ctx.errors.password);
    // @ts-ignore
    [errors,];
}
if (__VLS_ctx.error) {
    // @ts-ignore
    [error,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-red-50 border border-red-200 rounded-lg p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    const __VLS_10 = {}.AlertCircle;
    /** @type {[typeof __VLS_components.AlertCircle, ]} */ 
    // @ts-ignore
    AlertCircle;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
        ...{ class: "w-5 h-5 text-red-400 mr-2" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "w-5 h-5 text-red-400 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-red-800" },
    });
    (__VLS_ctx.error);
    // @ts-ignore
    [error,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    type: "submit",
    disabled: (__VLS_ctx.isLoading),
    ...{ class: "w-full btn-primary" },
    ...{ class: ({ 'opacity-50 cursor-not-allowed': __VLS_ctx.isLoading }) },
});
// @ts-ignore
[isLoading, isLoading,];
if (__VLS_ctx.isLoading) {
    // @ts-ignore
    [isLoading,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-xs text-gray-500" },
});
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['py-12']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */ 
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['w-16']} */ 
/** @type {__VLS_StyleScopedClasses['h-16']} */ 
/** @type {__VLS_StyleScopedClasses['bg-primary-600']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['mt-8']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ 
/** @type {__VLS_StyleScopedClasses['form-label']} */ 
/** @type {__VLS_StyleScopedClasses['form-input']} */ 
/** @type {__VLS_StyleScopedClasses['border-red-500']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['form-label']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['form-input']} */ 
/** @type {__VLS_StyleScopedClasses['pr-10']} */ 
/** @type {__VLS_StyleScopedClasses['border-red-500']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['inset-y-0']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['pr-3']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-50']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-red-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-800']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ 
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ 
/** @type {__VLS_StyleScopedClasses['cursor-not-allowed']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-2']} */ 
/** @type {__VLS_StyleScopedClasses['border-white']} */ 
/** @type {__VLS_StyleScopedClasses['border-t-transparent']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        Eye: Eye,
        EyeOff: EyeOff,
        AlertCircle: AlertCircle,
        showPassword: showPassword,
        isLoading: isLoading,
        error: error,
        form: form,
        errors: errors,
        handleSubmit: handleSubmit,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */
