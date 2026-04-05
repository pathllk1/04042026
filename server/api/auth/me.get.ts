export default defineEventHandler(async (event) => {
  const userContext = event.context.user

  if (!userContext) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return {
    user: {
      id: userContext.id,
      username: userContext.username,
      fullname: userContext.fullname,
      role: userContext.role
    }
  }
})
