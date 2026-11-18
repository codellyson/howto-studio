// Fetches a JSON endpoint, then keeps refreshing it while `active` says work is running.
export function usePoll<T>(url: () => string, active: (data: T | null) => boolean, ms = 1200) {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  async function load() {
    clearTimeout(timer)
    try {
      data.value = (await $fetch(url())) as T
      error.value = ''
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.message || 'Could not load'
    }
    if (!stopped && active(data.value)) timer = setTimeout(load, ms)
  }

  onMounted(load)
  onBeforeUnmount(() => { stopped = true; clearTimeout(timer) })
  return { data, error, load }
}

export function errorText(e: any, fallback = 'Something went wrong') {
  return e?.data?.statusMessage || e?.statusMessage || e?.message || fallback
}
