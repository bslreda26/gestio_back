import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'caisse_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('caisse_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('caisses')
        .onDelete('RESTRICT')
      table
        .integer('point_de_vente_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('points_de_vente')
        .onDelete('RESTRICT')
      table
        .integer('user_ouverture_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table
        .integer('user_fermeture_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.decimal('montant_ouverture', 15, 2).notNullable()
      table.decimal('montant_fermeture', 15, 2).nullable()
      table.decimal('solde_theorique', 15, 2).nullable()
      table.decimal('ecart', 15, 2).nullable()
      table.string('statut', 10).notNullable().defaultTo('ouverte')
      table.dateTime('date_ouverture').notNullable()
      table.dateTime('date_fermeture').nullable()
      table.text('notes_ouverture').nullable()
      table.text('notes_fermeture').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['caisse_id', 'statut'])
      table.index(['point_de_vente_id', 'statut'])
      table.index(['date_ouverture'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
