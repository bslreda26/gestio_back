/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.login': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['login']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.logout': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
    }
  }
  'auth.me': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['me']>>>
    }
  }
  'auth.change_password': {
    methods: ["POST"]
    pattern: '/api/v1/auth/change-password'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['changePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['changePassword']>>>
    }
  }
  'points_de_vente.search': {
    methods: ["POST"]
    pattern: '/api/v1/points-de-vente/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'points_de_vente.show': {
    methods: ["POST"]
    pattern: '/api/v1/points-de-vente/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'points_de_vente.create': {
    methods: ["POST"]
    pattern: '/api/v1/points-de-vente/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'points_de_vente.update': {
    methods: ["POST"]
    pattern: '/api/v1/points-de-vente/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'points_de_vente.deactivate': {
    methods: ["POST"]
    pattern: '/api/v1/points-de-vente/deactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/point_de_vente_validator').pointDeVenteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['deactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/points_de_vente_controller').default['deactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.search': {
    methods: ["POST"]
    pattern: '/api/v1/users/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').userSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').userSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.show': {
    methods: ["POST"]
    pattern: '/api/v1/users/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').userIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').userIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.create': {
    methods: ["POST"]
    pattern: '/api/v1/users/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').userCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').userCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.update': {
    methods: ["POST"]
    pattern: '/api/v1/users/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').userUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').userUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.deactivate': {
    methods: ["POST"]
    pattern: '/api/v1/users/deactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').userIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').userIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['deactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['deactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.permissions_catalog': {
    methods: ["POST"]
    pattern: '/api/v1/users/permissions-catalog'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['permissionsCatalog']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['permissionsCatalog']>>>
    }
  }
  'users.permissions_show': {
    methods: ["POST"]
    pattern: '/api/v1/users/permissions/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').userIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').userIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['permissionsShow']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['permissionsShow']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.permissions_update': {
    methods: ["POST"]
    pattern: '/api/v1/users/permissions/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').userPermissionsUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').userPermissionsUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['permissionsUpdate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['permissionsUpdate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'fne_config.show': {
    methods: ["POST"]
    pattern: '/api/v1/fne-config/show'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/apikeys_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/apikeys_controller').default['show']>>>
    }
  }
  'fne_config.upsert': {
    methods: ["POST"]
    pattern: '/api/v1/fne-config/upsert'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/apikey_validator').apikeyUpsertValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/apikey_validator').apikeyUpsertValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/apikeys_controller').default['upsert']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/apikeys_controller').default['upsert']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.tva_groupes.search': {
    methods: ["POST"]
    pattern: '/api/v1/admin/tva-groupes/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.tva_groupes.show': {
    methods: ["POST"]
    pattern: '/api/v1/admin/tva-groupes/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.tva_groupes.create': {
    methods: ["POST"]
    pattern: '/api/v1/admin/tva-groupes/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.tva_groupes.update': {
    methods: ["POST"]
    pattern: '/api/v1/admin/tva-groupes/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.tva_groupes.deactivate': {
    methods: ["POST"]
    pattern: '/api/v1/admin/tva-groupes/deactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['deactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['deactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.categories.search': {
    methods: ["POST"]
    pattern: '/api/v1/admin/categories/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.categories.show': {
    methods: ["POST"]
    pattern: '/api/v1/admin/categories/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.categories.create': {
    methods: ["POST"]
    pattern: '/api/v1/admin/categories/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.categories.update': {
    methods: ["POST"]
    pattern: '/api/v1/admin/categories/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.categories.delete': {
    methods: ["POST"]
    pattern: '/api/v1/admin/categories/delete'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['delete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['delete']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.depense_categories.search': {
    methods: ["POST"]
    pattern: '/api/v1/admin/depense-categories/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.depense_categories.show': {
    methods: ["POST"]
    pattern: '/api/v1/admin/depense-categories/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.depense_categories.create': {
    methods: ["POST"]
    pattern: '/api/v1/admin/depense-categories/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.depense_categories.update': {
    methods: ["POST"]
    pattern: '/api/v1/admin/depense-categories/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.depense_categories.delete': {
    methods: ["POST"]
    pattern: '/api/v1/admin/depense-categories/delete'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_categorie_validator').depenseCategorieIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['delete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['delete']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'clients.clients.search': {
    methods: ["POST"]
    pattern: '/api/v1/clients/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/client_validator').clientSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/client_validator').clientSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'clients.clients.show': {
    methods: ["POST"]
    pattern: '/api/v1/clients/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/client_validator').clientIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/client_validator').clientIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'clients.clients.create': {
    methods: ["POST"]
    pattern: '/api/v1/clients/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/client_validator').clientCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/client_validator').clientCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'clients.clients.update': {
    methods: ["POST"]
    pattern: '/api/v1/clients/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/client_validator').clientUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/client_validator').clientUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'clients.clients.deactivate': {
    methods: ["POST"]
    pattern: '/api/v1/clients/deactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/client_validator').clientIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/client_validator').clientIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['deactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['deactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'clients.clients.ventes': {
    methods: ["POST"]
    pattern: '/api/v1/clients/ventes'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/client_validator').clientVentesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/client_validator').clientVentesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['ventes']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['ventes']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'clients.clients.solde': {
    methods: ["POST"]
    pattern: '/api/v1/clients/solde'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/client_validator').clientIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/client_validator').clientIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['solde']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['solde']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'fournisseurs.fournisseurs.search': {
    methods: ["POST"]
    pattern: '/api/v1/fournisseurs/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'fournisseurs.fournisseurs.show': {
    methods: ["POST"]
    pattern: '/api/v1/fournisseurs/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'fournisseurs.fournisseurs.create': {
    methods: ["POST"]
    pattern: '/api/v1/fournisseurs/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'fournisseurs.fournisseurs.update': {
    methods: ["POST"]
    pattern: '/api/v1/fournisseurs/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'fournisseurs.fournisseurs.deactivate': {
    methods: ["POST"]
    pattern: '/api/v1/fournisseurs/deactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['deactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['deactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'fournisseurs.fournisseurs.achats': {
    methods: ["POST"]
    pattern: '/api/v1/fournisseurs/achats'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurAchatsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/fournisseur_validator').fournisseurAchatsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['achats']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fournisseurs_controller').default['achats']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'categories.categories.search': {
    methods: ["POST"]
    pattern: '/api/v1/categories/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'categories.categories.show': {
    methods: ["POST"]
    pattern: '/api/v1/categories/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'categories.categories.create': {
    methods: ["POST"]
    pattern: '/api/v1/categories/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'categories.categories.update': {
    methods: ["POST"]
    pattern: '/api/v1/categories/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'categories.categories.delete': {
    methods: ["POST"]
    pattern: '/api/v1/categories/delete'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/categorie_validator').categorieIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/categorie_validator').categorieIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['delete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['delete']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'tva_groupes.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/tva-groupes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['index']>>>
    }
  }
  'tva_groupes.show': {
    methods: ["POST"]
    pattern: '/api/v1/tva-groupes/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/tva_groupe_validator').tvaGroupeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tva_groupes_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'produits.produits.search': {
    methods: ["POST"]
    pattern: '/api/v1/produits/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/produit_validator').produitSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/produit_validator').produitSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'produits.produits.show': {
    methods: ["POST"]
    pattern: '/api/v1/produits/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/produit_validator').produitIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/produit_validator').produitIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'produits.produits.create': {
    methods: ["POST"]
    pattern: '/api/v1/produits/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/produit_validator').produitCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/produit_validator').produitCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'produits.produits.update': {
    methods: ["POST"]
    pattern: '/api/v1/produits/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/produit_validator').produitUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/produit_validator').produitUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'produits.produits.deactivate': {
    methods: ["POST"]
    pattern: '/api/v1/produits/deactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/produit_validator').produitIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/produit_validator').produitIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['deactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['deactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'produits.produits.alertes': {
    methods: ["POST"]
    pattern: '/api/v1/produits/alertes'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/produit_validator').produitAlertesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/produit_validator').produitAlertesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['alertes']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['alertes']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'produits.produits.ajustement': {
    methods: ["POST"]
    pattern: '/api/v1/produits/ajustement'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/produit_validator').produitAjustementValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/produit_validator').produitAjustementValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['ajustement']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['ajustement']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'produits.produits.calcul_prix': {
    methods: ["POST"]
    pattern: '/api/v1/produits/calcul-prix'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/produit_validator').produitCalculPrixValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/produit_validator').produitCalculPrixValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['calculPrix']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/produits_controller').default['calculPrix']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.search': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.get_by_criteria': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/get-by-criteria'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteGetByCriteriaValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteGetByCriteriaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['getByCriteria']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['getByCriteria']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.show': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.ligne_info': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/ligne-info'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteLigneInfoValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteLigneInfoValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['ligneInfo']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['ligneInfo']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.create': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.update': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.annuler': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/annuler'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteAnnulerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteAnnulerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['annuler']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['annuler']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.convertir_facture': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/convertir-facture'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['convertirFacture']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['convertirFacture']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.valider': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/valider'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['valider']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['valider']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.delete': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/delete'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['delete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['delete']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.retour': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/retour'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteRetourValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteRetourValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['retour']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['retour']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.paiement': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/paiement'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').ventePaiementValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').ventePaiementValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['paiement']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['paiement']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.paiements_search': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/paiements-search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').ventePaiementsSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').ventePaiementsSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['paiementsSearch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['paiementsSearch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.document': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/document'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['document']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['document']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.imprimer': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/imprimer'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteImprimerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteImprimerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['imprimer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['imprimer']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.certify': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/certify'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteCertifyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteCertifyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['certify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['certify']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.lock': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/lock'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['lock']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['lock']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.lock_renew': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/lock-renew'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['lockRenew']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['lockRenew']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ventes.unlock': {
    methods: ["POST"]
    pattern: '/api/v1/ventes/unlock'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/vente_validator').venteUnlockValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/vente_validator').venteUnlockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['unlock']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ventes_controller').default['unlock']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reglements.client.create': {
    methods: ["POST"]
    pattern: '/api/v1/reglements/client/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reglement_validator').reglementClientCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reglement_validator').reglementClientCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['clientCreate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['clientCreate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reglements.client.search': {
    methods: ["POST"]
    pattern: '/api/v1/reglements/client/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reglement_validator').reglementClientSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reglement_validator').reglementClientSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['clientSearch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['clientSearch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reglements.client.show': {
    methods: ["POST"]
    pattern: '/api/v1/reglements/client/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reglement_validator').reglementIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reglement_validator').reglementIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['clientShow']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['clientShow']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reglements.fournisseur.create': {
    methods: ["POST"]
    pattern: '/api/v1/reglements/fournisseur/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reglement_validator').reglementFournisseurCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reglement_validator').reglementFournisseurCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['fournisseurCreate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['fournisseurCreate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reglements.fournisseur.search': {
    methods: ["POST"]
    pattern: '/api/v1/reglements/fournisseur/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reglement_validator').reglementFournisseurSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reglement_validator').reglementFournisseurSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['fournisseurSearch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['fournisseurSearch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reglements.fournisseur.show': {
    methods: ["POST"]
    pattern: '/api/v1/reglements/fournisseur/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reglement_validator').reglementIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reglement_validator').reglementIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['fournisseurShow']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reglements_controller').default['fournisseurShow']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.search': {
    methods: ["POST"]
    pattern: '/api/v1/achats/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.get_by_criteria': {
    methods: ["POST"]
    pattern: '/api/v1/achats/get-by-criteria'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatGetByCriteriaValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatGetByCriteriaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['getByCriteria']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['getByCriteria']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.show': {
    methods: ["POST"]
    pattern: '/api/v1/achats/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.ligne_info': {
    methods: ["POST"]
    pattern: '/api/v1/achats/ligne-info'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatLigneInfoValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatLigneInfoValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['ligneInfo']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['ligneInfo']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.create': {
    methods: ["POST"]
    pattern: '/api/v1/achats/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.update': {
    methods: ["POST"]
    pattern: '/api/v1/achats/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.annuler': {
    methods: ["POST"]
    pattern: '/api/v1/achats/annuler'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatAnnulerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatAnnulerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['annuler']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['annuler']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.recevoir': {
    methods: ["POST"]
    pattern: '/api/v1/achats/recevoir'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatRecevoirValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatRecevoirValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['recevoir']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['recevoir']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.retour': {
    methods: ["POST"]
    pattern: '/api/v1/achats/retour'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatRetourValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatRetourValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['retour']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['retour']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'achats.paiement': {
    methods: ["POST"]
    pattern: '/api/v1/achats/paiement'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/achat_validator').achatPaiementValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/achat_validator').achatPaiementValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['paiement']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achats_controller').default['paiement']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.solde': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/caisse/solde'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['solde']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['solde']>>>
    }
  }
  'caisse.mouvements.search': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/mouvements/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseMouvementsSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseMouvementsSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['mouvementsSearch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['mouvementsSearch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.get_by_criteria': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/get-by-criteria'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseGetByCriteriaValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseGetByCriteriaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['getByCriteria']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['getByCriteria']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.mouvements.show': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/mouvements/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseMouvementIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseMouvementIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['mouvementsShow']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['mouvementsShow']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.ouverture': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/ouverture'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseOuvertureValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseOuvertureValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['ouverture']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['ouverture']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.fermeture': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/fermeture'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseFermetureValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseFermetureValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['fermeture']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['fermeture']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.entree_manuelle': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/entree-manuelle'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseEntreeManuelleValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseEntreeManuelleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['entreeManuelle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['entreeManuelle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.session': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/session'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseSessionsSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseSessionsSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['sessionCourante']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['sessionCourante']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.sessions.search': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/sessions/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseSessionsSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseSessionsSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['sessionsSearch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['sessionsSearch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.sessions.get_by_criteria': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/sessions/get-by-criteria'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseSessionsGetByCriteriaValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseSessionsGetByCriteriaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['sessionsGetByCriteria']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['sessionsGetByCriteria']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'caisse.sessions.show': {
    methods: ["POST"]
    pattern: '/api/v1/caisse/sessions/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/caisse_validator').caisseSessionIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/caisse_validator').caisseSessionIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['sessionsShow']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/caisse_controller').default['sessionsShow']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depense_categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/depense-categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depense_categories_controller').default['index']>>>
    }
  }
  'depenses.search': {
    methods: ["POST"]
    pattern: '/api/v1/depenses/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_validator').depenseSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_validator').depenseSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depenses.show': {
    methods: ["POST"]
    pattern: '/api/v1/depenses/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_validator').depenseIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_validator').depenseIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depenses.create': {
    methods: ["POST"]
    pattern: '/api/v1/depenses/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_validator').depenseCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_validator').depenseCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depenses.update': {
    methods: ["POST"]
    pattern: '/api/v1/depenses/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_validator').depenseUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_validator').depenseUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depenses.delete': {
    methods: ["POST"]
    pattern: '/api/v1/depenses/delete'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depense_validator').depenseIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depense_validator').depenseIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['delete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depenses_controller').default['delete']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.search': {
    methods: ["POST"]
    pattern: '/api/v1/stock/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock_validator').stockSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock_validator').stockSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.mouvements.search': {
    methods: ["POST"]
    pattern: '/api/v1/stock/mouvements/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock_validator').stockMouvementsSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock_validator').stockMouvementsSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['mouvementsSearch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['mouvementsSearch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.valorisation': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/stock/valorisation'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['valorisation']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['valorisation']>>>
    }
  }
  'stock.alertes': {
    methods: ["POST"]
    pattern: '/api/v1/stock/alertes'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock_validator').stockAlertesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock_validator').stockAlertesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['alertes']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['alertes']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.inventaire': {
    methods: ["POST"]
    pattern: '/api/v1/stock/inventaire'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock_validator').stockInventaireValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock_validator').stockInventaireValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['inventaire']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['inventaire']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.perte': {
    methods: ["POST"]
    pattern: '/api/v1/stock/perte'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock_validator').stockPerteValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock_validator').stockPerteValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['perte']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['perte']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depots.search': {
    methods: ["POST"]
    pattern: '/api/v1/depots/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depot_validator').depotSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depot_validator').depotSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depots.show': {
    methods: ["POST"]
    pattern: '/api/v1/depots/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depot_validator').depotIdValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depot_validator').depotIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depots.create': {
    methods: ["POST"]
    pattern: '/api/v1/depots/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depot_validator').depotCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depot_validator').depotCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depots.update': {
    methods: ["POST"]
    pattern: '/api/v1/depots/update'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depot_validator').depotUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depot_validator').depotUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depots.deactivate': {
    methods: ["POST"]
    pattern: '/api/v1/depots/deactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depot_validator').depotDeactivateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depot_validator').depotDeactivateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['deactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['deactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depots.transfert': {
    methods: ["POST"]
    pattern: '/api/v1/depots/transfert'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depot_validator').depotTransfertValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depot_validator').depotTransfertValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['transfert']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['transfert']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'depots.stocks': {
    methods: ["POST"]
    pattern: '/api/v1/depots/stocks'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/depot_validator').depotStockSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/depot_validator').depotStockSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['stocks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/depots_controller').default['stocks']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.caisse': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/caisse'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportCaisseValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportCaisseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['caisse']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['caisse']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.stock_actuel': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/stock-actuel'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportStockActuelValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportStockActuelValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['stockActuel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['stockActuel']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.mouvements_stock': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/mouvements-stock'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportMouvementsStockValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportMouvementsStockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['mouvementsStock']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['mouvementsStock']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.marge': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/marge'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportMargeValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportMargeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['marge']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['marge']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.valeur_stock': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/valeur-stock'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportValeurStockValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportValeurStockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['valeurStock']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['valeurStock']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.balance_clients': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/balance-clients'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportBalanceClientsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportBalanceClientsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['balanceClients']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['balanceClients']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.releve_client': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/releve-client'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportReleveClientValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportReleveClientValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['releveClient']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['releveClient']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.depenses': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/depenses'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportDepensesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportDepensesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['depenses']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['depenses']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.chiffre_affaires': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/chiffre-affaires'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportChiffreAffaireValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportChiffreAffaireValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['chiffreAffaire']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['chiffreAffaire']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.balance_fournisseurs': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/balance-fournisseurs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportBalanceFournisseursValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportBalanceFournisseursValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['balanceFournisseurs']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['balanceFournisseurs']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.releve_fournisseur': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/releve-fournisseur'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportReleveFournisseurValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportReleveFournisseurValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['releveFournisseur']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['releveFournisseur']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.reglement_clients': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/reglement-clients'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportReglementClientsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportReglementClientsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['reglementClients']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['reglementClients']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.reglement_fournisseurs': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/reglement-fournisseurs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportReglementFournisseursValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportReglementFournisseursValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['reglementFournisseurs']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['reglementFournisseurs']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rapports.certification': {
    methods: ["POST"]
    pattern: '/api/v1/rapports/certification'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapport_validator').rapportCertificationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapport_validator').rapportCertificationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['certification']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapports_controller').default['certification']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
}
