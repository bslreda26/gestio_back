import { BaseSchema } from '@adonisjs/lucid/schema'

const SCOPED_TABLES = [
  'ventes',
  'clients',
  'produits',
  'categories',
  'achats',
  'caisses',
  'depenses',
] as const

const CODE_UNIQUE_TABLES = ['clients', 'produits'] as const

export default class extends BaseSchema {
  async up() {
    const now = new Date()

    await this.db.table('points_de_vente').insert({
      code: '01',
      nom: 'Point de vente principal',
      adresse: null,
      ville: null,
      telephone: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    })

    const defaultPos = await this.db.from('points_de_vente').where('code', '01').first()
    const defaultPosId = defaultPos!.id as number

    this.schema.alterTable('users', (table) => {
      table
        .integer('point_de_vente_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('points_de_vente')
        .onDelete('SET NULL')
    })

    for (const tableName of SCOPED_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.integer('point_de_vente_id').unsigned().nullable()
      })
    }

    await this.defer(async (db) => {
      for (const tableName of SCOPED_TABLES) {
        await db.from(tableName).update({ point_de_vente_id: defaultPosId })
      }

      for (const tableName of SCOPED_TABLES) {
        await db.rawQuery(
          `ALTER TABLE \`${tableName}\` MODIFY \`point_de_vente_id\` INT UNSIGNED NOT NULL`
        )
        await db.schema.alterTable(tableName, (table) => {
          table
            .foreign('point_de_vente_id')
            .references('id')
            .inTable('points_de_vente')
            .onDelete('RESTRICT')
          table.index(['point_de_vente_id'])
        })
      }

      for (const tableName of CODE_UNIQUE_TABLES) {
        const indexes = await db
          .rawQuery(`SHOW INDEX FROM \`${tableName}\` WHERE Column_name = 'code' AND Non_unique = 0`)
          .then((result) => (Array.isArray(result[0]) ? result[0] : []) as { Key_name: string }[])

        for (const index of indexes) {
          if (index.Key_name === 'PRIMARY') continue
          await db.rawQuery(`ALTER TABLE \`${tableName}\` DROP INDEX \`${index.Key_name}\``)
        }

        await db.schema.alterTable(tableName, (table) => {
          table.unique(['point_de_vente_id', 'code'])
        })
      }

      await db.rawQuery(`ALTER TABLE \`ventes\` MODIFY \`numero\` VARCHAR(40) NOT NULL`)
    })
  }

  async down() {
    for (const tableName of CODE_UNIQUE_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.dropUnique(['point_de_vente_id', 'code'])
        table.unique(['code'])
      })
    }

    for (const tableName of SCOPED_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.dropForeign(['point_de_vente_id'])
        table.dropColumn('point_de_vente_id')
      })
    }

    this.schema.alterTable('users', (table) => {
      table.dropForeign(['point_de_vente_id'])
      table.dropColumn('point_de_vente_id')
    })

    this.schema.dropTable('points_de_vente')
  }
}
