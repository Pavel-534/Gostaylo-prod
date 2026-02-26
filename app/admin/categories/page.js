'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Grid3x3, Plus, Eye, EyeOff, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    slug: '',
    icon: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (categoryId, currentStatus) => {
    try {
      const res = await fetch(`/api/admin/categories/${categoryId}/toggle`, {
        method: 'PUT',
      });

      if (res.ok) {
        toast({
          title: currentStatus ? '❌ Категория выключена' : '✅ Категория включена',
          description: 'Изменения применены на сайте',
        });
        loadCategories();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить статус категории',
        variant: 'destructive',
      });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      toast({
        title: 'Ошибка',
        description: 'Введите название категории',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategory.name,
          slug: newCategory.slug || newCategory.name.toLowerCase().replace(/\s+/g, '-'),
          icon: newCategory.icon || '📦',
        }),
      });

      if (res.ok) {
        toast({
          title: '✅ Категория создана',
          description: `${newCategory.name} добавлена на платформу`,
        });
        setShowAddModal(false);
        setNewCategory({ name: '', slug: '', icon: '' });
        loadCategories();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать категорию',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Управление категориями</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Включайте и выключайте разделы сайта
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          Добавить
        </Button>
      </div>

      {/* Stats - Mobile Responsive */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        <Card className="border-2 border-green-100">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm text-gray-600">Активные</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
              {categories.filter((c) => c.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-100">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm text-gray-600">Выключены</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">
              {categories.filter((c) => !c.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-indigo-100">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm text-gray-600">Всего</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-indigo-600">{categories.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Grid - Mobile Responsive */}
      <Card className="shadow-xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            Все категории
          </CardTitle>
          <CardDescription className="text-sm">
            Toggle для включения/выключения
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`p-3 sm:p-4 lg:p-6 rounded-xl border-2 transition-all ${
                  category.isActive
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 hover:border-green-500'
                    : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-300 hover:border-gray-400 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl lg:text-3xl flex-shrink-0 ${
                        category.isActive
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg'
                          : 'bg-gray-400'
                      }`}
                    >
                      {category.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate">{category.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 font-mono truncate">/{category.slug}</p>
                      <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            category.isActive
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          {category.isActive ? (
                            <><Eye className="w-3 h-3 mr-1" />Активна</>
                          ) : (
                            <><EyeOff className="w-3 h-3 mr-1" />Скрыта</>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={category.isActive}
                    onCheckedChange={() => handleToggle(category.id, category.isActive)}
                    className="scale-100 sm:scale-125 lg:scale-150 flex-shrink-0"
                  />
                </div>

                {!category.isActive && (
                  <div className="mt-3 p-2 sm:p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      ⚠️ Не отображается
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Grid3x3 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Как работают категории?</p>
              <p className="text-sm text-blue-800">
                • <strong>Активная категория:</strong> Видна везде (главная, навигация, поиск, wizard)
                <br />
                • <strong>Выключенная категория:</strong> Скрыта от пользователей, но объявления сохраняются
                <br />
                • <strong>Добавление:</strong> Создавайте новые ниши (Fishing, Sales, Events и т.д.)
                <br />• <strong>Slug:</strong> Используется в URL (например, /category/fishing)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Category Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">Создать новую категорию</DialogTitle>
            <DialogDescription>
              Добавьте новый раздел для платформы (например, Fishing, Sales, Events)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                placeholder="Fishing"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug (для URL)</Label>
              <Input
                id="slug"
                placeholder="fishing (auto-generated if empty)"
                value={newCategory.slug}
                onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Будет использоваться в URL: /category/fishing</p>
            </div>
            <div>
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input
                id="icon"
                placeholder="🎣"
                value={newCategory.icon}
                onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                className="mt-2 text-2xl"
                maxLength={2}
              />
              <p className="text-xs text-gray-500 mt-1">Используйте emoji (например: 🎣 🛒 🎪)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddCategory} className="bg-indigo-600 hover:bg-indigo-700">
              ✅ Создать категорию
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
