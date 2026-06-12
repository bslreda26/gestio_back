import DepenseCategory from '#models/depense_category'

export class DepenseCategorieBusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DepenseCategorieBusinessError'
  }
}

export async function listActiveDepenseCategories() {
  return DepenseCategory.query().where('is_active', true).orderBy('libelle', 'asc')
}

export async function assertDepenseCategorieActive(code: string) {
  const categorie = await DepenseCategory.query()
    .where('code', code)
    .where('is_active', true)
    .first()

  if (!categorie) {
    throw new DepenseCategorieBusinessError(`Catégorie de dépense invalide ou inactive: ${code}`)
  }

  return categorie
}
