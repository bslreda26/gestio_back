import { sendSuccess } from '#helpers/api_response'
import {
  getActiveApiKey,
  serializeApiKey,
  upsertActiveApiKey,
} from '#services/apikey_service'
import { apikeyUpsertValidator } from '#validators/apikey_validator'
import type { HttpContext } from '@adonisjs/core/http'

export default class ApikeysController {
  async show(ctx: HttpContext) {
    const apikey = await getActiveApiKey()
    if (!apikey) {
      return sendSuccess(ctx, { configured: false, apikey: null })
    }

    return sendSuccess(ctx, {
      configured: true,
      apikey: serializeApiKey(apikey),
    })
  }

  async upsert(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(apikeyUpsertValidator)
    const apikey = await upsertActiveApiKey(payload)
    return sendSuccess(ctx, {
      message: 'Configuration FNE enregistree',
      apikey: serializeApiKey(apikey),
    })
  }
}
