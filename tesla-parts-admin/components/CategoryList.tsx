import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import { Category, Subcategory, Product } from '../types';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Folder,
  Image as ImageIcon,
  CornerDownRight,
  Pencil,
  Check,
  X,
  ArrowLeftRight,
  Package,
  ArrowUp,
  ArrowDown,
  Copy,
  GripVertical,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SubcategoryItemProps {
  subcategory: Subcategory;
  categoryId: number;
  categories: Category[];
  level?: number;
  onDelete: (id: number) => void;
  onCreate: (
    categoryId: number,
    name: string,
    code?: string,
    parentId?: number,
    file?: File,
    sortOrder?: number
  ) => void;
  onEdit: (
    id: number,
    name: string,
    code: string,
    parentId?: number,
    file?: File,
    sortOrder?: number
  ) => void;
  onTransfer: (
    id: number,
    targetCategoryId: number,
    targetParentId: number | undefined,
    mode: 'move' | 'copy'
  ) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onCopyProduct: (id: string) => Promise<void>;
  onReorderProducts: (productIds: string[]) => Promise<void>;
  onUpdateSubcategorySort: (
    subcategory: Subcategory,
    newSortOrder: number
  ) => Promise<void>;
  /** Перетягування розділів: що тягнемо зараз і куди поклали */
  draggedSubcategoryId?: number | null;
  onSubcategoryDragStart?: (id: number) => void;
  onReorderSubcategories?: (ordered: Subcategory[]) => Promise<void>;
}

const collectDescendantIds = (sub: Subcategory): number[] => {
  if (!sub.subcategories || sub.subcategories.length === 0) return [];
  const ids: number[] = [];
  sub.subcategories.forEach((child) => {
    ids.push(child.id, ...collectDescendantIds(child));
  });
  return ids;
};

const collectProductIdsInSubtree = (sub: Subcategory, ids: Set<string>) => {
  sub.products?.forEach((p) => ids.add(p.id));
  sub.subcategories?.forEach((child) => collectProductIdsInSubtree(child, ids));
};

const flattenSubcategoriesForSelect = (
  subs: Subcategory[] | undefined,
  excludeIds: Set<number>,
  depth = 0
): { id: number; label: string }[] => {
  if (!subs) return [];
  const result: { id: number; label: string }[] = [];
  subs.forEach((item) => {
    if (excludeIds.has(item.id)) {
      return;
    }
    const prefix = depth > 0 ? `${'--'.repeat(depth)} ` : '';
    result.push({ id: item.id, label: `${prefix}${item.name}` });
    if (item.subcategories && item.subcategories.length > 0) {
      result.push(
        ...flattenSubcategoriesForSelect(
          item.subcategories,
          excludeIds,
          depth + 1
        )
      );
    }
  });
  return result;
};

const sortSubcategoriesTree = (
  subs: Subcategory[] | undefined
): Subcategory[] => {
  if (!subs) return [];
  return [...subs]
    .sort((a, b) => {
      const orderDiff = (b.sort_order ?? 0) - (a.sort_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.id - b.id;
    })
    .map((sub) => ({
      ...sub,
      subcategories: sortSubcategoriesTree(sub.subcategories),
    }));
};

const sortCategoriesData = (cats: Category[]): Category[] => {
  return [...cats]
    .sort((a, b) => {
      const orderDiff = (b.sort_order ?? 0) - (a.sort_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.id - b.id;
    })
    .map((cat) => ({
      ...cat,
      subcategories: sortSubcategoriesTree(cat.subcategories),
    }));
};

const SubcategoryItem: React.FC<SubcategoryItemProps> = ({
  subcategory,
  categoryId,
  categories,
  level = 0,
  onDelete,
  onCreate,
  onEdit,
  onTransfer,
  onDeleteProduct,
  onCopyProduct,
  onReorderProducts,
  onUpdateSubcategorySort,
  draggedSubcategoryId,
  onSubcategoryDragStart,
  onReorderSubcategories,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferCategoryId, setTransferCategoryId] =
    useState<number>(categoryId);
  const [transferParentId, setTransferParentId] = useState<number | ''>(
    subcategory.parent_id ?? ''
  );
  const [isTransferring, setIsTransferring] = useState(false);

  // New Child State
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);

  // Edit State
  const [editName, setEditName] = useState(subcategory.name);
  const [editCode, setEditCode] = useState(subcategory.code || '');
  const [editFile, setEditFile] = useState<File | null>(null);

  const productCount = useMemo(() => {
    const ids = new Set<string>();
    collectProductIdsInSubtree(subcategory, ids);
    return ids.size;
  }, [subcategory]);

  useEffect(() => {
    setTransferCategoryId(categoryId);
  }, [categoryId]);

  useEffect(() => {
    setTransferParentId(subcategory.parent_id ?? '');
  }, [subcategory.parent_id]);

  const descendantIds = useMemo(
    () => new Set([subcategory.id, ...collectDescendantIds(subcategory)]),
    [subcategory]
  );

  const parentOptions = useMemo(() => {
    const targetCategory = categories.find(
      (cat) => cat.id === transferCategoryId
    );
    if (!targetCategory) return [];
    return flattenSubcategoriesForSelect(
      targetCategory.subcategories,
      descendantIds
    );
  }, [categories, transferCategoryId, descendantIds]);

  const handleAddChild = () => {
    if (!newName.trim()) return;
    onCreate(
      categoryId,
      newName,
      newCode,
      subcategory.id,
      newFile || undefined
    );
    setNewName('');
    setNewCode('');
    setNewFile(null);
    setIsAddingChild(false);
    setIsExpanded(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    onEdit(
      subcategory.id,
      editName,
      editCode,
      subcategory.parent_id ?? undefined,
      editFile || undefined
    );
    setEditFile(null);
    setIsEditing(false);
  };

  const handleTransferAction = async (mode: 'move' | 'copy') => {
    if (!transferCategoryId) return;
    const parentIdValue =
      transferParentId === '' ? undefined : Number(transferParentId);
    try {
      setIsTransferring(true);
      await onTransfer(subcategory.id, transferCategoryId, parentIdValue, mode);
      setShowTransfer(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTransferring(false);
    }
  };

  const hasChildren =
    subcategory.subcategories && subcategory.subcategories.length > 0;
  const hasProducts = subcategory.products && subcategory.products.length > 0;
  const canExpand = hasChildren || hasProducts;

  // Find siblings for sorting
  const siblings = useMemo(() => {
    const parentCategory = categories.find((c) => c.id === categoryId);
    if (!parentCategory) return [];

    let rawSiblings: Subcategory[] = [];
    if (!subcategory.parent_id) {
      rawSiblings = parentCategory.subcategories;
    } else {
      // Helper to find parent subcategory
      const findParentSub = (subs: Subcategory[]): Subcategory | undefined => {
        for (const s of subs) {
          if (s.id === subcategory.parent_id) return s;
          if (s.subcategories) {
            const found = findParentSub(s.subcategories);
            if (found) return found;
          }
        }
        return undefined;
      };
      const parentSub = findParentSub(parentCategory.subcategories);
      rawSiblings = parentSub?.subcategories || [];
    }
    // Sort DESC to match visual order
    return [...rawSiblings].sort(
      (a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0) || a.id - b.id
    );
  }, [categories, categoryId, subcategory.parent_id, subcategory.id]);

  const siblingIndex = siblings.findIndex((s) => s.id === subcategory.id);

  return (
    <div className="border-l border-gray-100 ml-4">
      <div
        draggable={!isEditing && Boolean(onReorderSubcategories) && siblingIndex >= 0}
        onDragStart={(e) => {
          onSubcategoryDragStart?.(subcategory.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(subcategory.id));
        }}
        onDragOver={(e) => {
          if (!draggedSubcategoryId || draggedSubcategoryId === subcategory.id) return;
          // перетягуємо лише серед «сусідів» одного рівня
          if (!siblings.some((sib) => sib.id === draggedSubcategoryId)) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const sourceId = draggedSubcategoryId ?? Number(e.dataTransfer.getData('text/plain'));
          if (!sourceId || sourceId === subcategory.id) return;
          const from = siblings.findIndex((sib) => sib.id === sourceId);
          const to = siblings.findIndex((sib) => sib.id === subcategory.id);
          if (from < 0 || to < 0) return;
          const ordered = [...siblings];
          const [moved] = ordered.splice(from, 1);
          ordered.splice(to, 0, moved);
          void onReorderSubcategories?.(ordered);
        }}
        className={`flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2 ${level > 0 ? 'ml-4' : ''} ${
          draggedSubcategoryId === subcategory.id ? 'opacity-50' : ''
        }`}
      >
        <div
          className={`flex items-center gap-2 text-gray-700 flex-1 ${canExpand ? 'cursor-pointer' : ''}`}
          onClick={() => canExpand && setIsExpanded(!isExpanded)}
        >
          {canExpand && (
            <div className="p-1 hover:bg-gray-200 rounded">
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </div>
          )}
          {!canExpand && <div className="w-6" />} {/* Spacer */}
          <span
            className="text-gray-300 hover:text-tesla-red cursor-grab active:cursor-grabbing mr-1"
            title="Перетягніть, щоб змінити порядок"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={15} />
          </span>
          {/* Sorting Arrows for Subcategory */}
          <div
            className="flex flex-col items-center mr-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (siblingIndex > 0) {
                  const targetOrder =
                    (siblings[siblingIndex - 1].sort_order ?? 0) + 1;
                  onUpdateSubcategorySort(subcategory, targetOrder);
                }
              }}
              disabled={siblingIndex === 0}
              className={`p-0.5 ${siblingIndex === 0 ? 'text-gray-100' : 'text-gray-400 hover:text-tesla-red'}`}
            >
              <ArrowUp size={12} />
            </button>
            <button
              onClick={() => {
                if (siblingIndex < siblings.length - 1) {
                  const targetOrder =
                    (siblings[siblingIndex + 1].sort_order ?? 0) - 1;
                  onUpdateSubcategorySort(subcategory, targetOrder);
                }
              }}
              disabled={siblingIndex === siblings.length - 1}
              className={`p-0.5 ${siblingIndex === siblings.length - 1 ? 'text-gray-100' : 'text-gray-400 hover:text-tesla-red'}`}
            >
              <ArrowDown size={12} />
            </button>
          </div>
          {isEditing ? (
            <div
              className="flex items-center gap-2 flex-1 flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="border rounded px-2 py-1 text-sm outline-none focus:border-tesla-red w-32"
                autoFocus
              />
              <input
                type="text"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                className="border rounded px-2 py-1 text-sm outline-none focus:border-tesla-red w-20"
                placeholder="Код"
              />
              <div className="flex items-center gap-2">
                {subcategory.image && (
                  <img
                    src={subcategory.image}
                    alt=""
                    className="h-8 w-auto rounded object-contain bg-white border border-gray-200"
                  />
                )}
                <label className="cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                  <ImageIcon size={14} />
                  <span>Завантажити</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEditFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                {editFile && (
                  <span className="text-xs text-gray-500 max-w-[120px] truncate">
                    {editFile.name}
                  </span>
                )}
              </div>
              <button
                onClick={handleSaveEdit}
                className="text-green-600 hover:bg-green-50 p-1 rounded"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:bg-gray-100 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              {subcategory.image ? (
                /* FIX 1: Use h-6 and w-auto object-contain to prevent cropping */
                <img
                  src={subcategory.image}
                  alt=""
                  className="h-6 w-auto max-w-[4rem] rounded object-contain bg-white"
                />
              ) : (
                <Folder size={16} className="text-gray-400" />
              )}
              <span className="font-medium">{subcategory.name}</span>
              {subcategory.code && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  Код: {subcategory.code}
                </span>
              )}
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {productCount} товарів
              </span>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <Link
              to={`/products/new?subcategory_id=${subcategory.id}&category_id=${categoryId}`}
              className="text-gray-400 hover:text-green-600 p-1"
              title="Додати товар"
            >
              <Package size={16} />
            </Link>
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-400 hover:text-blue-500 p-1"
              title="Редагувати"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingChild(!isAddingChild);
              }}
              className="text-gray-400 hover:text-tesla-red p-1"
              title="Додати підкатегорію"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTransfer(!showTransfer);
              }}
              className="text-gray-400 hover:text-red-500 p-1"
              title="Перемістити / копіювати"
            >
              <ArrowLeftRight size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(subcategory.id);
              }}
              className="text-gray-400 hover:text-red-500 p-1"
              title="Видалити"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Add Child Form */}
      {isAddingChild && (
        <div
          className={`ml-8 mt-2 mb-2 p-3 bg-gray-50 rounded border border-gray-200 flex gap-2 items-center flex-wrap`}
        >
          <CornerDownRight size={16} className="text-gray-400" />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-[150px] border rounded px-2 py-1 text-sm outline-none focus:border-tesla-red"
            placeholder="Назва..."
            autoFocus
          />
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            className="w-20 border rounded px-2 py-1 text-sm outline-none focus:border-tesla-red"
            placeholder="Код"
          />

          {/* Image Input Group */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <label className="cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs flex items-center gap-1">
              <ImageIcon size={14} />
              <span>Обрати файл</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setNewFile(e.target.files[0]);
                  } else {
                    setNewFile(null);
                  }
                }}
              />
            </label>
            {newFile && (
              <span className="text-xs text-gray-500 max-w-[140px] truncate">
                {newFile.name}
              </span>
            )}
          </div>

          <button
            onClick={handleAddChild}
            className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition text-sm font-medium"
          >
            Додати
          </button>
        </div>
      )}

      {/* Transfer Form */}
      {showTransfer && (
        <div className="ml-8 mt-2 mb-2 p-3 bg-indigo-50 rounded border border-indigo-200 space-y-2">
          <div className="flex flex-col gap-2 md:flex-row">
            <select
              value={transferCategoryId}
              onChange={(e) => {
                const value = Number(e.target.value);
                setTransferCategoryId(value);
                setTransferParentId('');
              }}
              className="flex-1 border rounded px-2 py-1 text-sm outline-none focus:border-tesla-red"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              value={transferParentId}
              onChange={(e) => {
                const value = e.target.value;
                setTransferParentId(value === '' ? '' : Number(value));
              }}
              className="flex-1 border rounded px-2 py-1 text-sm outline-none focus:border-tesla-red"
            >
              <option value="">Корінь категорії</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleTransferAction('move')}
              disabled={isTransferring}
              className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              Перемістити
            </button>
            <button
              onClick={() => handleTransferAction('copy')}
              disabled={isTransferring}
              className="bg-white text-red-700 border border-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50 disabled:opacity-50"
            >
              Копіювати
            </button>
            <button
              onClick={() => setShowTransfer(false)}
              className="text-gray-600 text-sm hover:underline"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {/* Products List & Children */}
      {isExpanded && (
        <div className="mt-2">
          {/* Products List */}
          {hasProducts && (
            <div className="ml-8 mb-4 bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-gray-500">
                  Товари в підкатегорії
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">Сорт.</th>
                      <th className="px-3 py-2">Товар</th>
                      <th className="px-3 py-2">Ціна</th>
                      <th className="px-3 py-2">Статус</th>
                      <th className="px-3 py-2 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(() => {
                      const sortedProducts = [...subcategory.products!].sort(
                        (a, b) =>
                          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                          a.name.localeCompare(b.name)
                      );

                      return sortedProducts.map((product, idx) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="flex flex-col items-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (idx > 0) {
                                    const newArray = [...sortedProducts];
                                    [newArray[idx - 1], newArray[idx]] = [
                                      newArray[idx],
                                      newArray[idx - 1],
                                    ];
                                    onReorderProducts(
                                      newArray.map((p) => p.id)
                                    );
                                  }
                                }}
                                disabled={idx === 0}
                                className={`p-0.5 ${idx === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-tesla-red'}`}
                                title="Вгору"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (idx < sortedProducts.length - 1) {
                                    const newArray = [...sortedProducts];
                                    [newArray[idx + 1], newArray[idx]] = [
                                      newArray[idx],
                                      newArray[idx + 1],
                                    ];
                                    onReorderProducts(
                                      newArray.map((p) => p.id)
                                    );
                                  }
                                }}
                                disabled={idx === sortedProducts.length - 1}
                                className={`p-0.5 ${idx === sortedProducts.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-tesla-red'}`}
                                title="Вниз"
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={product.image}
                                alt=""
                                className="w-8 h-8 rounded object-contain bg-white border border-gray-100"
                              />
                              <div>
                                <div className="font-medium text-gray-900">
                                  {product.name}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {product.detail_number}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {product.priceUSD} $
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`${product.inStock ? 'text-green-600' : 'text-red-600 font-bold'}`}
                            >
                              {product.inStock ? 'В наявності' : 'Немає'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCopyProduct(product.id);
                                }}
                                className="p-1 text-green-500 hover:bg-green-50 rounded"
                                title="Копіювати"
                              >
                                <Copy size={14} />
                              </button>
                              <Link
                                to={`/products/edit/${product.id}`}
                                className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                title="Редагувати"
                              >
                                <Pencil size={14} />
                              </Link>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Видалити цей товар?')) {
                                    onDeleteProduct(product.id);
                                  }
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                title="Видалити"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Children Subcategories */}
          {hasChildren && (
            <div className="ml-2">
              {subcategory.subcategories?.map((child) => (
                <SubcategoryItem
                  key={child.id}
                  subcategory={child}
                  categoryId={categoryId}
                  categories={categories}
                  level={level + 1}
                  onDelete={onDelete}
                  onCreate={onCreate}
                  onEdit={onEdit}
                  onTransfer={onTransfer}
                  onDeleteProduct={onDeleteProduct}
                  onCopyProduct={onCopyProduct}
                  onReorderProducts={onReorderProducts}
                  onUpdateSubcategorySort={onUpdateSubcategorySort}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CategoryList: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  // Перетягування «як конструктор»: що саме зараз тягнемо
  const [dragCategoryId, setDragCategoryId] = useState<number | null>(null);
  const [dragCategoryOverId, setDragCategoryOverId] = useState<number | null>(null);
  const [dragSubcategoryId, setDragSubcategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);

  // New Category State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryFile, setNewCategoryFile] = useState<File | null>(null);
  const [newCategoryMetaTitle, setNewCategoryMetaTitle] = useState('');
  const [newCategoryMetaDescription, setNewCategoryMetaDescription] =
    useState('');

  // Edit Category State
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryFile, setEditCategoryFile] = useState<File | null>(null);
  const [editCategoryMetaTitle, setEditCategoryMetaTitle] = useState('');
  const [editCategoryMetaDescription, setEditCategoryMetaDescription] =
    useState('');

  // New Subcategory State (Top Level)
  const [newSubcategoryNames, setNewSubcategoryNames] = useState<{
    [key: number]: string;
  }>({});
  const [newSubcategoryCodes, setNewSubcategoryCodes] = useState<{
    [key: number]: string;
  }>({});
  const [newSubcategoryFiles, setNewSubcategoryFiles] = useState<{
    [key: number]: File | null;
  }>({});

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await ApiService.getCategories();
      // Backend already sorts DESC
      setCategories(data);
    } catch (e) {
      console.error('Failed to load categories', e);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryProductCount = (cat: Category) => {
    const ids = new Set<string>();
    cat.subcategories.forEach((sub) => collectProductIdsInSubtree(sub, ids));
    return ids.size;
  };

  const toggleExpand = (id: number) => {
    setExpandedCategories((prev) =>
      prev.includes(id) ? prev.filter((catId) => catId !== id) : [...prev, id]
    );
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await ApiService.createCategory(
        newCategoryName,
        newCategoryFile || undefined,
        undefined, // Auto sort order
        newCategoryMetaTitle,
        newCategoryMetaDescription
      );
      setNewCategoryName('');
      setNewCategoryFile(null);
      setNewCategoryMetaTitle('');
      setNewCategoryMetaDescription('');
      loadCategories();
    } catch (e) {
      alert('Failed to create category');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('Підтвердити?')) return;
    try {
      await ApiService.deleteCategory(id);
      loadCategories();
    } catch (e: any) {
      alert(e.message || 'Не вдалося видалити категорію');
    }
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory(category.id);
    setEditCategoryName(category.name);
    setEditCategoryFile(null);
    setEditCategoryMetaTitle(category.meta_title || '');
    setEditCategoryMetaDescription(category.meta_description || '');
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    try {
      await ApiService.updateCategory(
        editingCategory,
        editCategoryName,
        editCategoryFile || undefined,
        undefined, // Preserve sort order
        editCategoryMetaTitle,
        editCategoryMetaDescription
      );
      setEditingCategory(null);
      setEditCategoryFile(null);
      loadCategories();
    } catch (e) {
      alert('Failed to update category');
    }
  };

  /** Показати або сховати категорію в розділі «Схеми запчастин (EPC)» */
  const handleToggleSchematics = async (category: Category) => {
    const next = category.show_in_schematics === false;
    try {
      await ApiService.setCategorySchematicsVisibility(category.id, next);
      setCategories((prev) =>
        prev.map((item) =>
          item.id === category.id ? { ...item, show_in_schematics: next } : item
        )
      );
    } catch (e) {
      alert('Не вдалося змінити видимість у схемах');
    }
  };

  const handleUpdateCategorySort = async (
    category: Category,
    newSortOrder: number
  ) => {
    try {
      await ApiService.updateCategory(
        category.id,
        category.name,
        undefined,
        newSortOrder,
        category.meta_title || undefined,
        category.meta_description || undefined
      );
      loadCategories();
    } catch (e) {
      alert('Failed to update category sort order');
    }
  };

  /** Новий порядок моделей після перетягування (один запит на весь список) */
  const handleReorderCategories = async (sourceId: number, targetId: number) => {
    setDragCategoryOverId(null);
    setDragCategoryId(null);
    if (!sourceId || sourceId === targetId) return;

    const list = [...sortedCategories];
    const from = list.findIndex((c) => c.id === sourceId);
    const to = list.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);

    const total = list.length;
    const payload = list.map((category, index) => ({
      id: category.id,
      sort_order: (total - index) * 10,
    }));

    try {
      await ApiService.reorderCategories(payload);
      loadCategories();
    } catch {
      alert('Не вдалося зберегти порядок моделей');
    }
  };

  /** Новий порядок розділів усередині однієї моделі */
  const handleReorderSubcategories = async (ordered: Subcategory[]) => {
    setDragSubcategoryId(null);
    const total = ordered.length;
    const payload = ordered.map((subcategory, index) => ({
      id: subcategory.id,
      sort_order: (total - index) * 10,
    }));
    try {
      await ApiService.reorderSubcategories(payload);
      loadCategories();
    } catch {
      alert('Не вдалося зберегти порядок розділів');
    }
  };

  const handleCreateSubcategory = async (
    categoryId: number,
    name: string,
    code?: string,
    parentId?: number,
    file?: File,
    sortOrder?: number
  ) => {
    if (!name?.trim()) return;

    try {
      await ApiService.createSubcategory(
        categoryId,
        name,
        code,
        parentId,
        file,
        sortOrder
      );
      if (!parentId) {
        setNewSubcategoryNames((prev) => ({ ...prev, [categoryId]: '' }));
        setNewSubcategoryCodes((prev) => ({ ...prev, [categoryId]: '' }));
        setNewSubcategoryFiles((prev) => ({ ...prev, [categoryId]: null }));
      }
      loadCategories();
    } catch (e) {
      alert('Failed to create subcategory');
    }
  };

  const triggerRootSubcategoryCreate = (category: Category) => {
    handleCreateSubcategory(
      category.id,
      newSubcategoryNames[category.id],
      newSubcategoryCodes[category.id],
      undefined,
      newSubcategoryFiles[category.id] || undefined,
      undefined // Auto sort order
    );
  };

  const handleUpdateSubcategory = async (
    id: number,
    name: string,
    code: string,
    parentId?: number,
    file?: File,
    sortOrder?: number
  ) => {
    try {
      await ApiService.updateSubcategory(
        id,
        name,
        code,
        parentId,
        file,
        sortOrder
      );
      loadCategories();
    } catch (e) {
      alert('Failed to update subcategory');
    }
  };

  const handleUpdateSubcategorySort = async (
    subcategory: Subcategory,
    newSortOrder: number
  ) => {
    try {
      await ApiService.updateSubcategory(
        subcategory.id,
        subcategory.name,
        subcategory.code,
        subcategory.parent_id ?? undefined,
        undefined,
        newSortOrder
      );
      loadCategories();
    } catch (e) {
      alert('Failed to update subcategory sort order');
    }
  };

  const handleDeleteSubcategory = async (id: number) => {
    if (!window.confirm('Підтвердити?')) return;
    try {
      await ApiService.deleteSubcategory(id);
      loadCategories();
    } catch (e: any) {
      alert(e.message || 'Failed to delete subcategory');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await ApiService.deleteProduct(id);
      loadCategories();
    } catch (error) {
      alert('Не вдалося видалити товар');
    }
  };

  const handleCopyProduct = async (id: string) => {
    if (!confirm('Ви впевнені, що хочете скопіювати цей товар?')) return;
    try {
      await ApiService.copyProduct(id);
      loadCategories();
    } catch (error) {
      alert('Не вдалося скопіювати товар');
    }
  };

  const handleReorderProducts = async (productIds: string[]) => {
    try {
      await ApiService.reorderProducts(productIds);
      loadCategories();
    } catch (error) {
      console.error(error);
      alert('Не вдалося змінити порядок');
    }
  };

  const handleTransferSubcategory = async (
    id: number,
    targetCategoryId: number,
    targetParentId: number | undefined,
    mode: 'move' | 'copy'
  ) => {
    try {
      if (mode === 'move') {
        await ApiService.moveSubcategory(id, targetCategoryId, targetParentId);
      } else {
        await ApiService.copySubcategory(id, targetCategoryId, targetParentId);
      }
      loadCategories();
    } catch (error) {
      alert(
        mode === 'move'
          ? 'Failed to move subcategory'
          : 'Failed to copy subcategory'
      );
      throw error;
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  const sortedCategories = [...categories].sort(
    (a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0)
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Керування категоріями
      </h1>

      {/* Create Category Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FolderPlus size={20} className="text-tesla-red" />
          Додати нову категорію
        </h2>
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Назва категорії
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-tesla-red outline-none"
                placeholder="Наприклад: Model 3"
                required
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Зображення (опціонально)
              </label>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md inline-flex items-center gap-2 border border-gray-300 w-full justify-center">
                  <ImageIcon size={20} />
                  <span>Завантажити файл</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setNewCategoryFile(e.target.files[0]);
                      } else {
                        setNewCategoryFile(null);
                      }
                    }}
                  />
                </label>
                {newCategoryFile && (
                  <span className="text-xs text-gray-500 truncate">
                    Обрано: {newCategoryFile.name}
                  </span>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition text-sm font-medium"
            >
              Додати
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SEO Title
              </label>
              <input
                type="text"
                value={newCategoryMetaTitle}
                onChange={(e) => setNewCategoryMetaTitle(e.target.value)}
                className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-tesla-red outline-none"
                placeholder="Meta title для категорії"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SEO Description
              </label>
              <textarea
                value={newCategoryMetaDescription}
                onChange={(e) => setNewCategoryMetaDescription(e.target.value)}
                className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-tesla-red outline-none"
                rows={2}
                placeholder="Короткий опис для пошукових систем"
              />
            </div>
          </div>
        </form>
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-900 font-manrope">
          <GripVertical size={16} className="shrink-0 mt-0.5 text-blue-500" />
          <span>
            Порядок моделей і підкатегорій змінюється <strong>перетягуванням рядка</strong> (або
            стрілками ↑↓). Він одразу застосовується в каталозі, на головній сторінці та в
            розділі «Схеми запчастин». Іконка <strong>ока</strong> праворуч керує тим, чи
            показувати категорію в «Схемах запчастин (EPC)» — саме так сховані «Аксесуари»,
            і так само можна сховати будь-яку нову категорію.
          </span>
        </div>
        {sortedCategories.map((category, idx) => (
          <div
            key={category.id}
            draggable={editingCategory !== category.id}
            onDragStart={(e) => {
              setDragCategoryId(category.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(category.id));
            }}
            onDragOver={(e) => {
              if (dragCategoryId === null || dragCategoryId === category.id) return;
              e.preventDefault();
              setDragCategoryOverId(category.id);
            }}
            onDragLeave={() => {
              setDragCategoryOverId((prev) => (prev === category.id ? null : prev));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const sourceId = dragCategoryId ?? Number(e.dataTransfer.getData('text/plain'));
              void handleReorderCategories(sourceId, category.id);
            }}
            onDragEnd={() => {
              setDragCategoryId(null);
              setDragCategoryOverId(null);
            }}
            className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all ${
              dragCategoryOverId === category.id
                ? 'border-tesla-red ring-2 ring-tesla-red/25'
                : 'border-gray-200'
            } ${dragCategoryId === category.id ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
              {editingCategory === category.id ? (
                <div className="flex flex-col gap-4 flex-1">
                  <div className="flex flex-wrap gap-4 items-end">
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      className="flex-1 min-w-[180px] border rounded px-2 py-1 text-lg font-semibold outline-none focus:border-tesla-red"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                      {category.image && (
                        <img
                          src={category.image}
                          alt=""
                          className="h-10 w-auto rounded object-contain bg-white border border-gray-200"
                        />
                      )}
                      <label className="cursor-pointer bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded inline-flex items-center gap-1 text-sm">
                        <ImageIcon size={16} />
                        <span>Змінити</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setEditCategoryFile(e.target.files[0]);
                            } else {
                              setEditCategoryFile(null);
                            }
                          }}
                        />
                      </label>
                      {editCategoryFile && (
                        <span className="text-xs text-gray-500 truncate max-w-[140px]">
                          {editCategoryFile.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUpdateCategory}
                        className="text-green-600 hover:bg-green-50 p-2 rounded"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="text-gray-400 hover:bg-gray-100 p-2 rounded"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SEO Title
                      </label>
                      <input
                        type="text"
                        value={editCategoryMetaTitle}
                        onChange={(e) =>
                          setEditCategoryMetaTitle(e.target.value)
                        }
                        className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-tesla-red outline-none"
                        placeholder="Meta title для категорії"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SEO Description
                      </label>
                      <textarea
                        value={editCategoryMetaDescription}
                        onChange={(e) =>
                          setEditCategoryMetaDescription(e.target.value)
                        }
                        className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-tesla-red outline-none"
                        rows={2}
                        placeholder="Короткий опис для пошукових систем"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center gap-4 cursor-pointer flex-1"
                  onClick={() => toggleExpand(category.id)}
                >
                  <span
                    className="text-gray-300 hover:text-tesla-red cursor-grab active:cursor-grabbing transition-colors"
                    title="Перетягніть, щоб змінити порядок"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical size={18} />
                  </span>
                  {expandedCategories.includes(category.id) ? (
                    <ChevronDown size={20} className="text-gray-500" />
                  ) : (
                    <ChevronRight size={20} className="text-gray-500" />
                  )}
                  {category.image && (
                    /* FIX 2: Use h-8 and w-auto object-contain for main category images */
                    <img
                      src={category.image}
                      alt=""
                      className="h-8 w-auto max-w-[6rem] rounded object-contain bg-gray-50"
                    />
                  )}
                  <span className="font-semibold text-lg">{category.name}</span>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                    {category.subcategories.length} підкатегорій
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                    ({getCategoryProductCount(category)} товарів всього)
                  </span>
                </div>
              )}

              {!editingCategory && (
                <div className="flex items-center gap-2 pr-4">
                  {/* Sorting Arrows for Category */}
                  <div className="flex flex-col items-center mr-2">
                    <button
                      onClick={() => {
                        if (idx > 0) {
                          const targetOrder =
                            (sortedCategories[idx - 1].sort_order ?? 0) + 1;
                          handleUpdateCategorySort(category, targetOrder);
                        }
                      }}
                      disabled={idx === 0}
                      className={`p-0.5 ${idx === 0 ? 'text-gray-100' : 'text-gray-400 hover:text-tesla-red'}`}
                      title="Вгору"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (idx < sortedCategories.length - 1) {
                          const targetOrder =
                            (sortedCategories[idx + 1].sort_order ?? 0) - 1;
                          handleUpdateCategorySort(category, targetOrder);
                        }
                      }}
                      disabled={idx === sortedCategories.length - 1}
                      className={`p-0.5 ${idx === sortedCategories.length - 1 ? 'text-gray-100' : 'text-gray-400 hover:text-tesla-red'}`}
                      title="Вниз"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleToggleSchematics(category)}
                    className={`p-2 rounded transition ${
                      category.show_in_schematics === false
                        ? 'text-gray-300 hover:text-tesla-red'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={
                      category.show_in_schematics === false
                        ? 'Не показується в «Схемах запчастин» — натисніть, щоб увімкнути'
                        : 'Показується в «Схемах запчастин» — натисніть, щоб сховати'
                    }
                  >
                    {category.show_in_schematics === false ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <Link
                    to={`/products/new?category_id=${category.id}`}
                    className="text-gray-400 hover:text-green-600 p-2 rounded transition"
                    title="Додати товар в категорію"
                  >
                    <Package size={18} />
                  </Link>
                  <button
                    onClick={() => startEditCategory(category)}
                    className="text-gray-400 hover:text-blue-500 p-2 rounded transition"
                    title="Редагувати категорію"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded transition"
                    title="Видалити категорію"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>

            {expandedCategories.includes(category.id) && (
              <div className="p-4 bg-white">
                {/* Category Products (Directly in Category, No Subcategory) */}
                {category.products && category.products.length > 0 && (
                  <div className="ml-4 mb-6 bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-gray-500">
                        Товари без підкатегорії
                      </span>
                      <button
                        onClick={() => toggleExpand(category.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase border-b border-gray-100">
                          <tr>
                            <th className="px-3 py-2 w-12 text-center">
                              Сорт.
                            </th>
                            <th className="px-3 py-2">Товар</th>
                            <th className="px-3 py-2">Ціна</th>
                            <th className="px-3 py-2">Статус</th>
                            <th className="px-3 py-2 text-right">Дії</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(() => {
                            const sortedCatProducts = [
                              ...category.products,
                            ].sort(
                              (a, b) =>
                                (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                                a.name.localeCompare(b.name)
                            );

                            return sortedCatProducts.map((product, idx) => (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <div className="flex flex-col items-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (idx > 0) {
                                          const newArray = [
                                            ...sortedCatProducts,
                                          ];
                                          [newArray[idx - 1], newArray[idx]] = [
                                            newArray[idx],
                                            newArray[idx - 1],
                                          ];
                                          handleReorderProducts(
                                            newArray.map((p) => p.id)
                                          );
                                        }
                                      }}
                                      disabled={idx === 0}
                                      className={`p-0.5 ${idx === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-tesla-red'}`}
                                      title="Вгору"
                                    >
                                      <ArrowUp size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (
                                          idx <
                                          sortedCatProducts.length - 1
                                        ) {
                                          const newArray = [
                                            ...sortedCatProducts,
                                          ];
                                          [newArray[idx + 1], newArray[idx]] = [
                                            newArray[idx],
                                            newArray[idx + 1],
                                          ];
                                          handleReorderProducts(
                                            newArray.map((p) => p.id)
                                          );
                                        }
                                      }}
                                      disabled={
                                        idx < sortedCatProducts.length - 1
                                          ? false
                                          : true
                                      }
                                      className={`p-0.5 ${idx === sortedCatProducts.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-tesla-red'}`}
                                      title="Вниз"
                                    >
                                      <ArrowDown size={14} />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={product.image}
                                      alt=""
                                      className="w-8 h-8 rounded object-contain bg-white border border-gray-100"
                                    />
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {product.name}
                                      </div>
                                      <div className="text-[10px] text-gray-400">
                                        {product.detail_number}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2 font-medium">
                                  {product.priceUSD} $
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`${product.inStock ? 'text-green-600' : 'text-red-600 font-bold'}`}
                                  >
                                    {product.inStock ? 'В наявності' : 'Немає'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      onClick={() =>
                                        handleCopyProduct(product.id)
                                      }
                                      className="p-1 text-green-500 hover:bg-green-50 rounded"
                                      title="Копіювати"
                                    >
                                      <Copy size={14} />
                                    </button>
                                    <Link
                                      to={`/products/edit/${product.id}`}
                                      className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                      title="Редагувати"
                                    >
                                      <Pencil size={14} />
                                    </Link>
                                    <button
                                      onClick={() => {
                                        if (confirm('Видалити цей товар?')) {
                                          handleDeleteProduct(product.id);
                                        }
                                      }}
                                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                                      title="Видалити"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Subcategories List */}
                <div className="space-y-2 mb-4 pl-4">
                  {category.subcategories.map((sub) => (
                    <SubcategoryItem
                      key={sub.id}
                      subcategory={sub}
                      categoryId={category.id}
                      categories={categories}
                      onDelete={handleDeleteSubcategory}
                      onCreate={handleCreateSubcategory}
                      onEdit={handleUpdateSubcategory}
                      onTransfer={handleTransferSubcategory}
                      onDeleteProduct={handleDeleteProduct}
                      onCopyProduct={handleCopyProduct}
                      onReorderProducts={handleReorderProducts}
                      onUpdateSubcategorySort={handleUpdateSubcategorySort}
                      draggedSubcategoryId={dragSubcategoryId}
                      onSubcategoryDragStart={setDragSubcategoryId}
                      onReorderSubcategories={handleReorderSubcategories}
                    />
                  ))}
                  {category.subcategories.length === 0 && (
                    <p className="text-sm text-gray-400 italic pl-4">
                      Немає підкатегорій
                    </p>
                  )}
                </div>

                {/* Add Top-Level Subcategory */}
                <div className="flex gap-2 pl-8 mt-4 items-center border-t border-gray-100 pt-4">
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={newSubcategoryNames[category.id] || ''}
                      onChange={(e) =>
                        setNewSubcategoryNames((prev) => ({
                          ...prev,
                          [category.id]: e.target.value,
                        }))
                      }
                      className="flex-1 border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-tesla-red outline-none"
                      placeholder="Нова коренева підкатегорія..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          triggerRootSubcategoryCreate(category);
                      }}
                    />
                    <input
                      type="text"
                      value={newSubcategoryCodes[category.id] || ''}
                      onChange={(e) =>
                        setNewSubcategoryCodes((prev) => ({
                          ...prev,
                          [category.id]: e.target.value,
                        }))
                      }
                      className="w-24 border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-tesla-red outline-none"
                      placeholder="Код (11)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          triggerRootSubcategoryCreate(category);
                      }}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md flex items-center gap-1 border border-gray-300">
                        <ImageIcon size={16} />
                        <span>Завантажити</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setNewSubcategoryFiles((prev) => ({
                              ...prev,
                              [category.id]: file,
                            }));
                          }}
                        />
                      </label>
                      {newSubcategoryFiles[category.id] && (
                        <span className="text-xs text-gray-500 truncate max-w-[160px]">
                          {newSubcategoryFiles[category.id]?.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => triggerRootSubcategoryCreate(category)}
                    className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition text-sm font-medium"
                  >
                    Додати
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {categories.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Категорій ще немає. Створіть першу!
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryList;
