import { ref, computed, onMounted, onUnmounted } from 'vue';
import { CheckIcon } from '@heroicons/vue/24/solid';
import { useAdminI18n } from '../i18n';
// Composables
const { switchLocale, getCurrentLocaleInfo, getAvailableLocales } = useAdminI18n();
// State
const dropdownOpen = ref(false);
const switching = ref(false);
// Computed
const currentLocale = computed(() => getCurrentLocaleInfo());
const availableLocales = computed(() => getAvailableLocales());
// Methods
const toggleDropdown = () => {
    dropdownOpen.value = !dropdownOpen.value;
};
const switchToLocale = async (locale) => {
    if (locale === currentLocale.value.code || switching.value) {
        dropdownOpen.value = false;
        return;
    }
    switching.value = true;
    try {
        const success = await switchLocale();
        if (success) {
            // Emit event for parent components to react
            emit('localeChanged', locale);
            // Close dropdown
            dropdownOpen.value = false;
            // Optional: Reload page to ensure all components update
            // window.location.reload()
        }
        else {
            console.error('Failed to switch locale');
        }
    }
    catch (error) {
        console.error('Error switching locale:', error);
    }
    finally {
        switching.value = false;
    }
};
// Close dropdown when clicking outside
const handleClickOutside = (event) => {
    const target = event.target;
    if (!target.closest('.relative')) {
        dropdownOpen.value = false;
    }
};
const emit = defineEmits();
// Lifecycle
onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleDropdown) },
    ...{ class: "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors" },
});
// @ts-ignore
[toggleDropdown,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-lg" },
});
(__VLS_ctx.currentLocale.flag);
// @ts-ignore
[currentLocale,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "hidden sm:block" },
});
(__VLS_ctx.currentLocale.nativeName);
// @ts-ignore
[currentLocale,];
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    ...{ class: "h-4 w-4" },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement(__VLS_elements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'stroke-width': "2",
    d: "M19 9l-7 7-7-7",
});
const __VLS_0 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    enterActiveClass: "transition ease-out duration-100",
    enterFromClass: "transform opacity-0 scale-95",
    enterToClass: "transform opacity-100 scale-100",
    leaveActiveClass: "transition ease-in duration-75",
    leaveFromClass: "transform opacity-100 scale-100",
    leaveToClass: "transform opacity-0 scale-95",
}));
const __VLS_2 = __VLS_1({
    enterActiveClass: "transition ease-out duration-100",
    enterFromClass: "transform opacity-0 scale-95",
    enterToClass: "transform opacity-100 scale-100",
    leaveActiveClass: "transition ease-in duration-75",
    leaveFromClass: "transform opacity-100 scale-100",
    leaveToClass: "transform opacity-0 scale-95",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_4 } = __VLS_3.slots;
if (__VLS_ctx.dropdownOpen) {
    // @ts-ignore
    [dropdownOpen,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "py-1" },
    });
    for (const [locale] of __VLS_getVForSourceType((__VLS_ctx.availableLocales))) {
        // @ts-ignore
        [availableLocales,];
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.dropdownOpen))
                        return;
                    __VLS_ctx.switchToLocale(locale.code);
                    // @ts-ignore
                    [switchToLocale,];
                } },
            key: (locale.code),
            ...{ class: "flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors" },
            ...{ class: ({
                    'bg-gray-50 text-gray-900': locale.code === __VLS_ctx.currentLocale.code
                }) },
        });
        // @ts-ignore
        [currentLocale,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center space-x-3" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-lg" },
        });
        (locale.flag);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex flex-col items-start" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "font-medium" },
        });
        (locale.nativeName);
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-xs text-gray-500" },
        });
        (locale.name);
        if (locale.code === __VLS_ctx.currentLocale.code) {
            // @ts-ignore
            [currentLocale,];
            const __VLS_5 = {}.CheckIcon;
            /** @type {[typeof __VLS_components.CheckIcon, ]} */ ;
            // @ts-ignore
            CheckIcon;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
                ...{ class: "h-4 w-4 text-green-600" },
            }));
            const __VLS_7 = __VLS_6({
                ...{ class: "h-4 w-4 text-green-600" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        }
    }
}
var __VLS_3;
if (__VLS_ctx.switching) {
    // @ts-ignore
    [switching,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute inset-0 bg-white bg-opacity-75 rounded-md flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" },
    });
}
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-56']} */ ;
/** @type {__VLS_StyleScopedClasses['origin-top-right']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-black']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-opacity-5']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-opacity-75']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-900']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        CheckIcon: CheckIcon,
        dropdownOpen: dropdownOpen,
        switching: switching,
        currentLocale: currentLocale,
        availableLocales: availableLocales,
        toggleDropdown: toggleDropdown,
        switchToLocale: switchToLocale,
    }),
    __typeEmits: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
});
; /* PartiallyEnd: #4569/main.vue */
