import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table.index(['point_de_vente_id', 'client_id', 'statut'], 'ventes_pdv_client_statut_idx')
      table.index(['point_de_vente_id', 'client_id', 'date_vente'], 'ventes_pdv_client_date_idx')
    })

    this.schema.alterTable('reglements', (table) => {
      table.index(
        ['point_de_vente_id', 'client_id', 'date_reglement'],
        'reglements_pdv_client_date_idx'
      )
    })

    this.schema.alterTable('achats', (table) => {
      table.index(
        ['point_de_vente_id', 'fournisseur_id', 'statut'],
        'achats_pdv_fournisseur_statut_idx'
      )
    })
  }

  async down() {
    this.schema.alterTable('achats', (table) => {
      table.dropIndex(
        ['point_de_vente_id', 'fournisseur_id', 'statut'],
        'achats_pdv_fournisseur_statut_idx'
      )
    })

    this.schema.alterTable('reglements', (table) => {
      table.dropIndex(
        ['point_de_vente_id', 'client_id', 'date_reglement'],
        'reglements_pdv_client_date_idx'
      )
    })

    this.schema.alterTable('ventes', (table) => {
      table.dropIndex(['point_de_vente_id', 'client_id', 'statut'], 'ventes_pdv_client_statut_idx')
      table.dropIndex(['point_de_vente_id', 'client_id', 'date_vente'], 'ventes_pdv_client_date_idx')
    })
  }
}
