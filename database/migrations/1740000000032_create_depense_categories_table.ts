import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'depense_categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('code', 30).notNullable().unique()
      table.string('libelle', 100).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    await this.defer(async (db) => {
      const now = new Date()
      const categories = [
        { code: 'transport', libelle: 'Transport' },
        { code: 'fournitures', libelle: 'Fournitures' },
        { code: 'salaire', libelle: 'Salaire' },
        { code: 'loyer', libelle: 'Loyer' },
        { code: 'autre', libelle: 'Autre' },
      ]

      for (const cat of categories) {
        await db.table(this.tableName).insert({
          ...cat,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
      }
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
