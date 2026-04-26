'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Layers, Languages, Globe, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { categoryTranslations, supportedLanguages, getCategoryName } from '@/lib/translations';
import { resolveCategoryDisplayName } from '@/lib/category-display-name';

const WIZARD_OPTIONS = [
  { value: '_none', label: '— (наследовать / эвристика)' },
  { value: 'stay', label: 'stay — жильё' },
  { value: 'transport', label: 'transport' },
  { value: 'transport_helicopter', label: 'transport_helicopter' },
  { value: 'yacht', label: 'yacht' },
  { value: 'tour', label: 'tour' },
  { value: 'nanny', label: 'nanny' },
  { value: 'chef', label: 'chef' },
  { value: 'massage', label: 'massage' },
  { value: 'service_generic', label: 'service_generic' },
];

function wizardSelectValue(raw) {
  if (raw == null || String(raw).trim() === '') return '_none';
  return String(raw).toLowerCase().trim();
}

function wizardPayloadFromSelect(v) {
  if (!v || v === '_none') return null;
  return v;
}

/** Корни → дети DFS; «осиротевшие» (родитель не в выборке) — в конце с depth 1 */
function flattenCategoryTreeForAdmin(items) {
  const list = [...(items || [])];
  const childrenOf = (pid) =>
    list
      .filter((c) => String(c.parentId || '') === String(pid))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const roots = list
    .filter((c) => !c.parentId)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const out = [];
  const walk = (node, depth) => {
    out.push({ cat: node, depth });
    for (const ch of childrenOf(node.id)) walk(ch, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  const seen = new Set(out.map((x) => String(x.cat.id)));
  for (const c of list) {
    if (!seen.has(String(c.id))) out.push({ cat: c, depth: 1 });
  }
  return out;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [wizardProfileOptions, setWizardProfileOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parentPatchingId, setParentPatchingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [translations, setTranslations] = useState({
    ru: '', en: '', zh: '', th: '',
  });
  const [newCategory, setNewCategory] = useState({
    name: '',
    slug: '',
    icon: '',
    parentId: '',
    wizardProfile: '_none',
  });
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    slug: '',
    icon: '',
    parentId: '',
    wizardProfile: '_none',
    order: 0,
  });

  const [localTranslations, setLocalTranslations] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gostaylo_category_translations');
      return stored ? JSON.parse(stored) : categoryTranslations;
    }
    return categoryTranslations;
  });

  const categoryTreeRows = useMemo(() => flattenCategoryTreeForAdmin(categories), [categories]);

  const wizardSelectItems = useMemo(() => {
    const fromApi = (wizardProfileOptions || []).filter(Boolean);
    if (!fromApi.length) return WIZARD_OPTIONS;
    const seen = new Set(fromApi);
    const extra = WIZARD_OPTIONS.filter((o) => o.value !== '_none' && !seen.has(o.value));
    return [
      WIZARD_OPTIONS[0],
      ...fromApi.map((v) => ({ value: v, label: v })),
      ...extra.filter((o) => o.value !== '_none'),
    ];
  }, [wizardProfileOptions]);

  useEffect(() => {
    loadCategories();
  }, []);

  const saveTranslations = (newTranslations) => {
    setLocalTranslations(newTranslations);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gostaylo_category_translations', JSON.stringify(newTranslations));
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/v2/admin/categories', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        toast.error('Нужна сессия администратора');
        setCategories([]);
        return;
      }
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Ошибка загрузки категорий');
        setCategories([]);
        return;
      }
      if (Array.isArray(json.wizardProfileOptions)) {
        setWizardProfileOptions(json.wizardProfileOptions);
      }
      setCategories(
        (json.data || []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          icon: c.icon || '📦',
          isActive: c.isActive !== false,
          order: c.order ?? 0,
          parentId: c.parentId ?? null,
          wizardProfile: c.wizardProfile ?? null,
          nameI18n: c.nameI18n ?? null,
        })),
      );
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (categoryId, currentStatus) => {
    try {
      const res = await fetch('/api/v2/admin/categories', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: categoryId, isActive: !currentStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Не удалось изменить статус');
        return;
      }
      toast.success(currentStatus ? 'Категория выключена' : 'Категория включена');
      loadCategories();
    } catch {
      toast.error('Не удалось изменить статус категории');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      toast.error('Введите название категории');
      return;
    }
    const slug = newCategory.slug || newCategory.name.toLowerCase().replace(/\s+/g, '-');
    try {
      const res = await fetch('/api/v2/admin/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategory.name,
          slug,
          icon: newCategory.icon || '📦',
          parentId: newCategory.parentId || null,
          wizardProfile: wizardPayloadFromSelect(newCategory.wizardProfile),
          order: categories.length + 1,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Не удалось создать');
        return;
      }
      toast.success(`${newCategory.name} добавлена`);
      setShowAddModal(false);
      setNewCategory({
        name: '', slug: '', icon: '', parentId: '', wizardProfile: '_none',
      });
      loadCategories();
    } catch {
      toast.error('Не удалось создать категорию');
    }
  };

  const openEditModal = useCallback((category) => {
    setEditForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon || '',
      parentId: category.parentId || '',
      wizardProfile: wizardSelectValue(category.wizardProfile),
      order: category.order ?? 0,
    });
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm.id || !editForm.name) {
      toast.error('Заполните название');
      return;
    }
    try {
      const res = await fetch('/api/v2/admin/categories', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editForm.id,
          name: editForm.name,
          slug: editForm.slug,
          icon: editForm.icon,
          parentId: editForm.parentId || null,
          wizardProfile: wizardPayloadFromSelect(editForm.wizardProfile),
          order: editForm.order,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Ошибка сохранения');
        return;
      }
      toast.success('Сохранено');
      setShowEditModal(false);
      loadCategories();
    } catch {
      toast.error('Ошибка сети');
    }
  };

  const openTranslateModal = (category) => {
    setEditingCategory(category);
    const existing = localTranslations[category.slug?.toLowerCase()] || {};
    const ni = category.nameI18n && typeof category.nameI18n === 'object' ? category.nameI18n : {};
    setTranslations({
      ru: existing.ru || ni.ru || category.name,
      en: existing.en || ni.en || category.name,
      zh: existing.zh || ni.zh || '',
      th: existing.th || ni.th || '',
    });
    setShowTranslateModal(true);
  };

  const handleSaveTranslations = async () => {
    if (!editingCategory) return;
    const slug = editingCategory.slug?.toLowerCase();
    const newTranslations = {
      ...localTranslations,
      [slug]: { ...translations },
    };
    saveTranslations(newTranslations);
    const nameI18n = {
      ...(translations.ru?.trim() ? { ru: translations.ru.trim() } : {}),
      ...(translations.en?.trim() ? { en: translations.en.trim() } : {}),
      ...(translations.zh?.trim() ? { zh: translations.zh.trim() } : {}),
      ...(translations.th?.trim() ? { th: translations.th.trim() } : {}),
    };
    try {
      const res = await fetch('/api/v2/admin/categories', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCategory.id,
          ...(Object.keys(nameI18n).length ? { nameI18n } : { nameI18n: null }),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Не удалось записать name_i18n в БД');
      } else {
        toast.success('Сохранено в БД (name_i18n) и в браузере');
        loadCategories();
      }
    } catch {
      toast.error('Ошибка сети при записи name_i18n');
    }
    setShowTranslateModal(false);
  };

  const parentChoicesFor = (excludeId) =>
    categories.filter((c) => String(c.id) !== String(excludeId));

  const patchParentQuick = async (categoryId, newParentValue) => {
    setParentPatchingId(categoryId);
    try {
      const res = await fetch('/api/v2/admin/categories', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: categoryId,
          parentId: newParentValue === '_root' ? null : newParentValue,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Не удалось сменить родителя');
        return;
      }
      toast.success('Родитель обновлён');
      loadCategories();
    } catch {
      toast.error('Ошибка сети');
    } finally {
      setParentPatchingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Управление категориями</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Дерево в списке; SSOT{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">wizard_profile</code>,{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">name_i18n</code> в БД; переводы в браузере — опционально
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="border-2 border-green-100">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Активные</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {categories.filter((c) => c.isActive).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-100">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Выключены</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">
              {categories.filter((c) => !c.isActive).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-indigo-100">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Всего</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-600">{categories.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4 flex items-center gap-3">
          <Globe className="w-8 h-8 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-blue-900">Мультиязычная поддержка</p>
            <p className="text-sm text-blue-700">
              Канон имён: колонка <code className="text-xs">name_i18n</code> в БД (API <code className="text-xs">nameI18n</code>) и <code className="text-xs">name</code>; «Сохранить переводы» пишет в Supabase; локальный кеш в браузере — опционально
            </p>
          </div>
          <div className="flex gap-1">
            {supportedLanguages.map((lang) => (
              <span key={lang.code} className="text-lg" title={lang.name}>{lang.flag}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Layers className="w-5 h-5 text-indigo-600" />
            Все категории
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="flex flex-col gap-3">
            {categoryTreeRows.map(({ cat: category, depth }) => (
              <div
                key={category.id}
                style={{ marginLeft: depth * 20 }}
                className={`rounded-xl border-2 p-3 sm:p-4 transition-all ${
                  category.isActive
                    ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50'
                    : 'border-gray-300 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl sm:h-12 sm:w-12 sm:text-2xl ${
                        category.isActive
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg'
                          : 'bg-gray-400'
                      }`}
                    >
                      {category.icon === 'Home' ? '🏠'
                        : category.icon === 'Car' ? '🚗'
                          : category.icon === 'Map' ? '🗺️'
                            : category.icon === 'Anchor' ? '⚓' : category.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-gray-900 sm:text-base">
                        {resolveCategoryDisplayName(category, 'ru', getCategoryName)}
                      </h3>
                      <p className="font-mono text-xs text-gray-500">/{category.slug}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {category.wizardProfile ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {category.wizardProfile}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-gray-500">wizard_profile —</Badge>
                        )}
                        {category.nameI18n && typeof category.nameI18n === 'object' ? (
                          <Badge variant="outline" className="text-[10px] text-indigo-700">name_i18n</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {supportedLanguages.map((lang) => {
                          const trans = localTranslations[category.slug?.toLowerCase()];
                          const hasTranslation = trans?.[lang.code];
                          return (
                            <span
                              key={lang.code}
                              className={`rounded px-1 text-xs ${hasTranslation ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                              title={hasTranslation || 'Не переведено'}
                            >
                              {lang.flag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 sm:max-w-[280px] sm:flex-row sm:items-center sm:justify-end">
                    <div className="min-w-0 sm:w-[200px]">
                      <Label className="text-[10px] text-gray-500">Родитель</Label>
                      <Select
                        value={category.parentId || '_root'}
                        disabled={parentPatchingId === category.id}
                        onValueChange={(v) => patchParentQuick(category.id, v)}
                      >
                        <SelectTrigger className="h-9 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_root">— Корень</SelectItem>
                          {parentChoicesFor(category.id).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {resolveCategoryDisplayName(p, 'ru', getCategoryName)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(category)}
                        className="h-8 w-8 p-0"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTranslateModal(category)}
                        className="h-8 w-8 p-0"
                        title="Переводы (localStorage)"
                      >
                        <Languages className="w-4 h-4" />
                      </Button>
                      <Switch
                        checked={category.isActive}
                        onCheckedChange={() => handleToggle(category.id, category.isActive)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать категорию</DialogTitle>
            <DialogDescription>БД: slug, родитель, wizard_profile (SSOT)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Название *</Label>
              <Input
                placeholder="Виллы"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input
                placeholder="villas"
                value={newCategory.slug}
                onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Родительская категория</Label>
              <Select
                value={newCategory.parentId || '_root'}
                onValueChange={(v) => setNewCategory({ ...newCategory, parentId: v === '_root' ? '' : v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Корень" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_root">— Корень (нет родителя)</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} /{c.slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>wizard_profile (SSOT)</Label>
              <Select
                value={newCategory.wizardProfile || '_none'}
                onValueChange={(v) => setNewCategory({ ...newCategory, wizardProfile: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {wizardSelectItems.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Иконка (emoji)</Label>
              <Input
                placeholder="🏠"
                value={newCategory.icon}
                onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                className="mt-2 text-2xl"
                maxLength={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Отмена</Button>
            <Button onClick={handleAddCategory} className="bg-indigo-600 hover:bg-indigo-700">Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать категорию</DialogTitle>
            <DialogDescription>{editForm.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Название *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={editForm.slug}
                onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                className="mt-2 font-mono text-sm"
              />
            </div>
            <div>
              <Label>Порядок (order)</Label>
              <Input
                type="number"
                value={editForm.order}
                onChange={(e) => setEditForm({ ...editForm, order: parseInt(e.target.value, 10) || 0 })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Родитель</Label>
              <Select
                value={editForm.parentId || '_root'}
                onValueChange={(v) => setEditForm({ ...editForm, parentId: v === '_root' ? '' : v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_root">— Корень</SelectItem>
                  {parentChoicesFor(editForm.id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} /{c.slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>wizard_profile</Label>
              <Select
                value={editForm.wizardProfile || '_none'}
                onValueChange={(v) => setEditForm({ ...editForm, wizardProfile: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {wizardSelectItems.map((o) => (
                    <SelectItem key={`e-${o.value}`} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Иконка</Label>
              <Input
                value={editForm.icon}
                onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                className="mt-2 text-2xl"
                maxLength={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Отмена</Button>
            <Button onClick={handleSaveEdit} className="bg-indigo-600 hover:bg-indigo-700">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTranslateModal} onOpenChange={setShowTranslateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Переводы: {editingCategory?.name}
            </DialogTitle>
            <DialogDescription>Локально в браузере</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="ru" className="mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              {supportedLanguages.map((lang) => (
                <TabsTrigger key={lang.code} value={lang.code} className="text-sm">
                  {lang.flag} {lang.code.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>

            {supportedLanguages.map((lang) => (
              <TabsContent key={lang.code} value={lang.code} className="mt-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    {lang.name}
                  </Label>
                  <Input
                    value={translations[lang.code]}
                    onChange={(e) => setTranslations({ ...translations, [lang.code]: e.target.value })}
                    placeholder={`Название на ${lang.name}`}
                    className="text-lg"
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowTranslateModal(false)}>Отмена</Button>
            <Button onClick={handleSaveTranslations} className="bg-indigo-600 hover:bg-indigo-700">Сохранить переводы</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
