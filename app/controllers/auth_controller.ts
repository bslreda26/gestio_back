import PointDeVente from '#models/point_de_vente'
import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'
import { sendError } from '#helpers/api_response'
import { getEffectivePermissions } from '#services/permission_service'
import hash from '@adonisjs/core/services/hash'
import vine from '@vinejs/vine'
import limiter from '@adonisjs/limiter/services/main'
import { errors as authErrors } from '@adonisjs/auth'
import env from '#start/env'

const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine.string().minLength(8).maxLength(64),
  })
)

function buildLoginLimiter(ctx: HttpContext, email: string) {
  const ip = ctx.request.ip()
  return limiter.multi([
    { duration: '1 min', requests: 10, key: `login_ip_${ip}` },
    {
      duration: '1 min',
      requests: 5,
      blockDuration: '20 mins',
      key: `login_${ip}_${email}`,
    },
  ])
}

export default class AuthController {
  async login(ctx: HttpContext) {
    const { request, serialize } = ctx
    const { email, password } = await request.validateUsing(loginValidator)

    const loginLimiter = buildLoginLimiter(ctx, email)

    try {
      const [rateLimitError, user] = await loginLimiter.penalize(() =>
        User.verifyCredentials(email, password)
      )

      if (rateLimitError) {
        const retryAfter = rateLimitError.response.availableIn
        return sendError(
          ctx,
          `Trop de tentatives de connexion. Réessayez dans ${retryAfter} secondes.`,
          429
        )
      }

      if (user.isActive === false) {
        return sendError(ctx, 'Compte désactivé', 403)
      }

      const tokenExpiresIn = env.get('AUTH_TOKEN_EXPIRES_IN', '7 days')
      const token = await User.accessTokens.create(user, ['*'], { expiresIn: tokenExpiresIn })
      return serialize({
        user: {
          ...UserTransformer.transform(user),
          role: user.role,
          permissions: getEffectivePermissions(user),
        },
        token: token.value!.release(),
      })
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        return sendError(ctx, 'Identifiants invalides', 401)
      }
      throw error
    }
  }

  async logout({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentAccessToken) {
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    }
    return { message: 'Déconnexion réussie' }
  }

  async me({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const pointsDeVente =
      user.role === 'admin'
        ? await PointDeVente.query().where('is_active', true).orderBy('code', 'asc')
        : user.pointDeVenteId
          ? await PointDeVente.query()
              .where('id', user.pointDeVenteId)
              .where('is_active', true)
          : []

    return serialize({
      ...UserTransformer.transform(user),
      role: user.role,
      permissions: getEffectivePermissions(user),
      point_de_vente_id: user.pointDeVenteId ?? null,
      points_de_vente: pointsDeVente.map((p) => ({
        id: p.id,
        code: p.code,
        nom: p.nom,
      })),
    })
  }

  async changePassword(ctx: HttpContext) {
    const { auth, request } = ctx
    const user = auth.getUserOrFail()
    const { currentPassword, newPassword } = await request.validateUsing(changePasswordValidator)

    const isValid = await hash.verify(user.password, currentPassword)
    if (!isValid) {
      return sendError(ctx, 'Mot de passe actuel incorrect', 422)
    }

    user.password = newPassword
    await user.save()
    return { message: 'Mot de passe modifié avec succès' }
  }
}
