import { BaseSchema } from '@adonisjs/lucid/schema'

const FNE_TVA_GROUPES = [
  { code: 'TVA0', libelle: 'TVA 0%', taux: 0 },
  { code: 'TVA9', libelle: 'TVA 9%', taux: 9 },
  { code: 'TVA18', libelle: 'TVA 18%', taux: 18 },
] as const

export default class extends BaseSchema {
  async up() {
    const now = new Date()

    for (const groupe of FNE_TVA_GROUPES) {
      const existing = await this.db.from('tva_groupes').where('code', groupe.code).first()

      if (existing) {
        await this.db
          .from('tva_groupes')
          .where('code', groupe.code)
          .update({
            libelle: groupe.libelle,
            taux: groupe.taux,
            is_active: true,
            updated_at: now,
          })
      } else {
        await this.db.table('tva_groupes').insert({
          code: groupe.code,
          libelle: groupe.libelle,
          taux: groupe.taux,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
      }
    }
  }

  async down() {
    // Données de référence : on ne supprime pas les groupes TVA à la rollback.
  }
}
