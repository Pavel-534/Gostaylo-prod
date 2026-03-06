'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Grid3x3, Plus, Eye, EyeOff, Layers, Languages, Globe, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { categoryTranslations, supportedLanguages } from '@/lib/translations';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [translations, setTranslations] = useState({
    ru: '', en: '', zh: '', th: ''
  });
  const [newCategory, setNewCategory] = useState({
    name: '',
    slug: '',
    icon: '',
  });

  // Local translations storage (since we can't modify DB schema)
  const [localTranslations, setLocalTranslations] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gostaylo_category_translations');
      return stored ? JSON.parse(stored) : categoryTranslations;
    }
    return categoryTranslations;
  });

  useEffect(() => {
    loadCategories();
  }, []);

  // Save translations to localStorage
  const saveTranslations = (newTranslations) => {
    setLocalTranslations(newTranslations);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gostaylo_category_translations', JSON.stringify(newTranslations));
    }
  };

  const loadCategories = async () => {
    try {
      // Direct Supabase call
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=*&order=order.asc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setCategories(data.map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          icon: c.icon || '📦',
          isActive: c.is_active,
          order: c.order
        })));
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (categoryId, currentStatus) => {
    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?id=eq.${categoryId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (res.ok) {
        toast.success(currentStatus ? '❌ Категория выключена' : '✅ Категория включена');
        loadCategories();
      }
    } catch (error) {
      toast.error('Не удалось изменить статус категории');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      toast.error('Введите название категории');
      return;
    }

    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const slug = newCategory.slug || newCategory.name.toLowerCase().replace(/\s+/g, '-');
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/categories`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: newCategory.name,
          slug: slug,
          icon: newCategory.icon || '📦',
          is_active: true,
          order: categories.length + 1
        })
      });

      if (res.ok) {
        toast.success(`✅ ${newCategory.name} добавлена`);
        setShowAddModal(false);
        setNewCategory({ name: '', slug: '', icon: '' });
        loadCategories();
      }
    } catch (error) {
      toast.error('Не удалось создать категорию');
    }
  };

  const openTranslateModal = (category) => {
    setEditingCategory(category);
    const existing = localTranslations[category.slug?.toLowerCase()] || {};
    setTranslations({
      ru: existing.ru || category.name,
      en: existing.en || category.name,
      zh: existing.zh || '',
      th: existing.th || ''
    });
    setShowTranslateModal(true);
  };

  const handleSaveTranslations = () => {
    if (!editingCategory) return;
    
    const slug = editingCategory.slug?.toLowerCase();
    const newTranslations = {
      ...localTranslations,
      [slug]: { ...translations }
    };
    
    saveTranslations(newTranslations);
    toast.success('✅ Переводы сохранены');
    setShowTranslateModal(false);
  };

  // Get translated name
  const getTranslatedName = (category, lang = 'ru') => {
    const slug = category.slug?.toLowerCase();
    const trans = localTranslations[slug];
    return trans?.[lang] || category.name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Управление категориями</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Категории с поддержкой 4 языков (RU/EN/ZH/TH)
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

      {/* Stats */}
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

      {/* Language Support Banner */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4 flex items-center gap-3">
          <Globe className="w-8 h-8 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-blue-900">Мультиязычная поддержка</p>
            <p className="text-sm text-blue-700">
              Нажмите на кнопку 🌐 чтобы редактировать переводы для каждой категории
            </p>
          </div>
          <div className="flex gap-1">
            {supportedLanguages.map(lang => (
              <span key={lang.code} className="text-lg" title={lang.name}>{lang.flag}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <Card className="shadow-xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Layers className="w-5 h-5 text-indigo-600" />
            Все категории
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  category.isActive
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
                    : 'bg-gray-50 border-gray-300 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 ${
                      category.isActive
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg'
                        : 'bg-gray-400'
                    }`}>
                      {category.icon === 'Home' ? '🏠' : 
                       category.icon === 'Car' ? '🚗' : 
                       category.icon === 'Map' ? '🗺️' : 
                       category.icon === 'Anchor' ? '⚓' : category.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                        {category.name}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono">/{category.slug}</p>
                      
                      {/* Mini translations preview */}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {supportedLanguages.map(lang => {
                          const trans = localTranslations[category.slug?.toLowerCase()];
                          const hasTranslation = trans?.[lang.code];
                          return (
                            <span 
                              key={lang.code} 
                              className={`text-xs px-1 rounded ${hasTranslation ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                              title={hasTranslation || 'Не переведено'}
                            >
                              {lang.flag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Translate button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openTranslateModal(category)}
                      className="h-8 w-8 p-0"
                      title="Редактировать переводы"
                    >
                      <Languages className="w-4 h-4" />
                    </Button>
                    
                    {/* Toggle switch */}
                    <Switch
                      checked={category.isActive}
                      onCheckedChange={() => handleToggle(category.id, category.isActive)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Category Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать категорию</DialogTitle>
            <DialogDescription>
              Добавьте новый раздел для платформы
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Название *</Label>
              <Input
                placeholder="Fishing"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Slug (для URL)</Label>
              <Input
                placeholder="fishing"
                value={newCategory.slug}
                onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Icon (Emoji)</Label>
              <Input
                placeholder="🎣"
                value={newCategory.icon}
                onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                className="mt-2 text-2xl"
                maxLength={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Отмена</Button>
            <Button onClick={handleAddCategory} className="bg-indigo-600 hover:bg-indigo-700">
              ✅ Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Translation Modal */}
      <Dialog open={showTranslateModal} onOpenChange={setShowTranslateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Переводы: {editingCategory?.name}
            </DialogTitle>
            <DialogDescription>
              Введите название категории на каждом языке
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="ru" className="mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              {supportedLanguages.map(lang => (
                <TabsTrigger key={lang.code} value={lang.code} className="text-sm">
                  {lang.flag} {lang.code.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {supportedLanguages.map(lang => (
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
                  <p className="text-xs text-gray-500">
                    {lang.code === 'ru' && 'Основной язык платформы'}
                    {lang.code === 'en' && 'For international users'}
                    {lang.code === 'zh' && '中文翻译'}
                    {lang.code === 'th' && 'สำหรับผู้ใช้ภาษาไทย'}
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowTranslateModal(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveTranslations} className="bg-indigo-600 hover:bg-indigo-700">
              💾 Сохранить переводы
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
