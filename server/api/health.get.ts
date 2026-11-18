// The Mac app checks this before it trusts whatever is on port 4700.
export default defineEventHandler(() => ({ service: 'howto-studio' }))
