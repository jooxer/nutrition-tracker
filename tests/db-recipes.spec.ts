import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { addRecipe, listRecipes, updateRecipe, deleteRecipe, getRecipe } from '@/db/recipes';

beforeEach(async () => { await resetDBForTests(); });

describe('recipes CRUD', () => {
  it('addRecipe + listRecipes', async () => {
    const id = await addRecipe({ name: '早餐A', items: [{ foodId: 'f1', amount: 1 }] });
    const list = await listRecipes();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(id);
    expect(list[0].items).toEqual([{ foodId: 'f1', amount: 1 }]);
  });

  it('updateRecipe replaces fields', async () => {
    const id = await addRecipe({ name: 'A', items: [] });
    await updateRecipe(id, { name: 'B', items: [{ foodId: 'x', amount: 2 }] });
    const r = await getRecipe(id);
    expect(r?.name).toBe('B');
    expect(r?.items).toEqual([{ foodId: 'x', amount: 2 }]);
  });

  it('deleteRecipe is hard delete', async () => {
    const id = await addRecipe({ name: 'A', items: [] });
    await deleteRecipe(id);
    expect(await getRecipe(id)).toBeUndefined();
  });
});
