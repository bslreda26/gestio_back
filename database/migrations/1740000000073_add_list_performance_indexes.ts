import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table.index(['point_de_vente_id', 'date_vente', 'id'], 'ventes_pdv_date_id_idx')
    })

    this.schema.alterTable('achats', (table) => {
      table.index(['point_de_vente_id', 'date_achat', 'id'], 'achats_pdv_date_id_idx')
    })

    this.schema.alterTable('stock_mouvements', (table) => {
      table.index(['produit_id', 'created_at'], 'stock_mouvements_produit_created_idx')
    })

    this.schema.alterTable('clients', (table) => {
      table.index(['point_de_vente_id', 'solde'], 'clients_pdv_solde_idx')
    })
  }

  async down() {
    this.schema.alterTable('clients', (table) => {
      table.dropIndex(['point_de_vente_id', 'solde'], 'clients_pdv_solde_idx')
    })

    this.schema.alterTable('stock_mouvements', (table) => {
      table.dropIndex(['produit_id', 'created_at'], 'stock_mouvements_produit_created_idx')
    })

    this.schema.alterTable('achats', (table) => {
      table.dropIndex(['point_de_vente_id', 'date_achat', 'id'], 'achats_pdv_date_id_idx')
    })

    this.schema.alterTable('ventes', (table) => {
      table.dropIndex(['point_de_vente_id', 'date_vente', 'id'], 'ventes_pdv_date_id_idx')
    })
  }
}
