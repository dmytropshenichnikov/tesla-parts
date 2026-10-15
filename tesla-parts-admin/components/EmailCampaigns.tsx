import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import { Mail, Plus, Trash2, Send, X, Users, Search, AlertCircle, Pencil, Bold, Italic, Underline, Link2, Eye } from 'lucide-react';

export const EmailCampaigns: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lists' | 'direct'>('lists');
  const [lists, setLists] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // List Management State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Campaign State
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignBody, setCampaignBody] = useState('');

  // Міні-редактор листа: кнопки обгортають виділення HTML-тегами
  // (лист відправляється як HTML, переноси рядків стають <br> на бекенді).
  const bodyRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>({});
  const wrapSel = (
    key: string,
    value: string,
    setValue: (v: string) => void,
    before: string,
    after: string,
    placeholder = 'текст'
  ) => {
    const ta = bodyRefs.current[key];
    if (!ta) {
      setValue(value + before + placeholder + after);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const sel = value.slice(start, end) || placeholder;
    setValue(value.slice(0, start) + before + sel + after + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + before.length + sel.length + after.length;
      ta.setSelectionRange(pos, pos);
    });
  };
  const insertLink = (key: string, value: string, setValue: (v: string) => void) => {
    const url = window.prompt('URL посилання (https://…)');
    if (!url) return;
    wrapSel(key, value, setValue, '<a href="' + url + '">', '</a>', 'посилання');
  };
  const MailToolbar: React.FC<{
    areaKey: string;
    value: string;
    setValue: (v: string) => void;
  }> = ({ areaKey, value, setValue }) => {
    const btn =
      'p-1.5 rounded-md border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-300 transition cursor-pointer';
    return (
      <div className="flex items-center gap-1 mb-1.5">
        <button type="button" title="Жирний" className={btn} onClick={() => wrapSel(areaKey, value, setValue, '<b>', '</b>')}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" title="Курсив" className={btn} onClick={() => wrapSel(areaKey, value, setValue, '<i>', '</i>')}>
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" title="Підкреслений" className={btn} onClick={() => wrapSel(areaKey, value, setValue, '<u>', '</u>')}>
          <Underline className="w-4 h-4" />
        </button>
        <button type="button" title="Посилання" className={btn} onClick={() => insertLink(areaKey, value, setValue)}>
          <Link2 className="w-4 h-4" />
        </button>
        <span className="ml-1 text-[11px] text-gray-400 inline-flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" /> виділіть текст і натисніть кнопку
        </span>
      </div>
    );
  };
  const MailPreview: React.FC<{ body: string }> = ({ body }) => {
    if (!body.trim()) return null;
    return (
      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="text-[11px] font-semibold text-gray-400 uppercase mb-1">Як побачить клієнт</div>
        <div
          className="text-sm text-gray-800 font-manrope"
          dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, '<br>') }}
        />
      </div>
    );
  };

  // Direct Mail State
  const [directSubject, setDirectSubject] = useState('');
  const [directBody, setDirectBody] = useState('');
  const [directEmails, setDirectEmails] = useState('');
  const [directSelectedCustomers, setDirectSelectedCustomers] = useState<number[]>([]);

  // Settings State
  const [footerText, setFooterText] = useState('');

  useEffect(() => {
    fetchData();
    fetchFooter();
  }, []);

  const fetchFooter = async () => {
    try {
      const res = await ApiService.getSetting('email_footer');
      setFooterText(res.value);
    } catch (err: any) {
      // setting might not exist yet
    }
  };

  const handleSaveFooter = async () => {
    try {
      await ApiService.updateSetting('email_footer', footerText);
      showSuccess('Нижній колонтитул успішно збережено!');
    } catch (err: any) {
      setError(err.message || 'Не вдалося зберегти налаштування');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedLists, fetchedCustomers] = await Promise.all([
        ApiService.getEmailLists(),
        ApiService.getCustomers()
      ]);
      setLists(fetchedLists);
      setCustomers(fetchedCustomers);
    } catch (err: any) {
      setError(err.message || 'Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateList = async () => {
    if (!newListName) return;
    try {
      if (editingListId) {
        await ApiService.updateEmailList(editingListId, { name: newListName, customer_ids: selectedCustomers });
        showSuccess('Список успішно оновлено!');
      } else {
        await ApiService.createEmailList({ name: newListName, customer_ids: selectedCustomers });
        showSuccess('Список успішно створено!');
      }
      setIsCreateModalOpen(false);
      setEditingListId(null);
      setNewListName('');
      setSelectedCustomers([]);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Не вдалося зберегти список');
    }
  };

  const handleDeleteList = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цей список?')) return;
    try {
      await ApiService.deleteEmailList(id);
      fetchData();
      showSuccess('Список успішно видалено!');
    } catch (err: any) {
      setError(err.message || 'Не вдалося видалити список');
    }
  };

  const handleSendCampaign = async () => {
    if (!activeListId || !campaignSubject || !campaignBody) return;
    try {
      const res = await ApiService.sendCampaignToList(activeListId, {
        subject: campaignSubject,
        body: campaignBody
      });
      setIsSendModalOpen(false);
      setCampaignSubject('');
      setCampaignBody('');
      showSuccess(res.message || 'Розсилку успішно надіслано!');
    } catch (err: any) {
      setError(err.message || 'Не вдалося надіслати розсилку');
    }
  };

  const handleSendDirect = async () => {
    if (!directSubject || !directBody) return;
    const emailsArray = directEmails
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(e => e);

    if (emailsArray.length === 0 && directSelectedCustomers.length === 0) {
      setError('Будь ласка, вкажіть хоча б одного одержувача');
      return;
    }

    try {
      const res = await ApiService.sendDirectCampaign({
        subject: directSubject,
        body: directBody,
        customer_ids: directSelectedCustomers,
        emails: emailsArray
      });
      setDirectSubject('');
      setDirectBody('');
      setDirectEmails('');
      setDirectSelectedCustomers([]);
      showSuccess(res.message || 'Пряму розсилку успішно надіслано!');
    } catch (err: any) {
      setError(err.message || 'Не вдалося надіслати розсилку');
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 5000);
  };

  const filteredCustomers = customers.filter(c => 
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.first_name && c.first_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.last_name && c.last_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Поштові розсилки</h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 text-green-600 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            className={`flex-1 py-4 px-6 text-sm font-medium ${activeTab === 'lists' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('lists')}
          >
            Списки розсилки
          </button>
          <button
            className={`flex-1 py-4 px-6 text-sm font-medium ${activeTab === 'direct' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('direct')}
          >
            Пряма розсилка
          </button>
          <button
            className={`flex-1 py-4 px-6 text-sm font-medium ${activeTab === 'settings' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('settings')}
          >
            Налаштування
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'settings' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Нижній колонтитул (Footer) листів (підтримується HTML)</label>
                <textarea
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="<p>З повагою, команда Tesla Parts Center</p>"
                />
                <p className="text-xs text-gray-500 mt-1">Цей текст буде автоматично додаватися в кінці кожного відправленого листа.</p>
              </div>
              <button
                onClick={handleSaveFooter}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition"
              >
                Зберегти налаштування
              </button>
            </div>
          )}

          {activeTab === 'lists' && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setEditingListId(null);
                    setNewListName('');
                    setSelectedCustomers([]);
                    setIsCreateModalOpen(true);
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition"
                >
                  <Plus className="w-4 h-4" /> Створити список
                </button>
              </div>
              
              {loading ? (
                <div className="text-center py-8 text-gray-500">Завантаження...</div>
              ) : lists.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Списки розсилки не знайдено.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lists.map(list => (
                    <div key={list.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{list.name}</h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingListId(list.id);
                              setNewListName(list.name);
                              setSelectedCustomers(list.customers.map((c: any) => c.id));
                              setIsCreateModalOpen(true);
                            }} 
                            className="text-gray-400 hover:text-blue-600"
                            title="Редагувати"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteList(list.id)} className="text-gray-400 hover:text-red-600" title="Видалити">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                        <Users className="w-4 h-4" /> {list.customers?.length || 0} користувачів
                      </p>
                      <button
                        onClick={() => { setActiveListId(list.id); setIsSendModalOpen(true); }}
                        className="w-full bg-gray-50 text-gray-700 px-4 py-2 rounded-lg border border-gray-200 flex items-center justify-center gap-2 hover:bg-gray-100 transition"
                      >
                        <Send className="w-4 h-4" /> Надіслати розсилку
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'direct' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тема</label>
                <input
                  type="text"
                  value={directSubject}
                  onChange={e => setDirectSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="Тема розсилки"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тіло листа (підтримується HTML)</label>
                <MailToolbar areaKey="direct" value={directBody} setValue={setDirectBody} />
                <textarea
                  ref={el => { bodyRefs.current['direct'] = el; }}
                  value={directBody}
                  onChange={e => setDirectBody(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="Текст листа..."
                />
                <MailPreview body={directBody} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Додаткові email-адреси (через кому або з нового рядка)</label>
                <textarea
                  value={directEmails}
                  onChange={e => setDirectEmails(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-gray-700">Оберіть клієнтів</label>
                  <button 
                    onClick={() => {
                      if (directSelectedCustomers.length === customers.length && customers.length > 0) {
                        setDirectSelectedCustomers([]); // Deselect all
                      } else {
                        setDirectSelectedCustomers(customers.map(c => c.id)); // Select all
                      }
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    {customers.length > 0 && directSelectedCustomers.length === customers.length ? 'Зняти виділення' : 'Обрати всіх'}
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {customers.map(c => (
                    <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={directSelectedCustomers.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setDirectSelectedCustomers([...directSelectedCustomers, c.id]);
                          else setDirectSelectedCustomers(directSelectedCustomers.filter(id => id !== c.id));
                        }}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm truncate">{c.first_name} {c.last_name} ({c.email})</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSendDirect}
                disabled={loading || !directSubject || !directBody}
                className="w-full bg-red-600 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition disabled:opacity-50"
              >
                <Send className="w-5 h-5" /> Надіслати пряму розсилку
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create List Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingListId ? 'Редагувати список' : 'Створити список розсилки'}</h2>
              <button onClick={() => { setIsCreateModalOpen(false); setEditingListId(null); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва списку</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="наприклад, VIP клієнти"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-gray-700">Пошук та вибір клієнтів</label>
                  <button 
                    onClick={() => {
                      if (selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0) {
                        setSelectedCustomers([]); // Deselect all if all are selected
                      } else {
                        setSelectedCustomers(filteredCustomers.map(c => c.id)); // Select all filtered
                      }
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    {filteredCustomers.length > 0 && selectedCustomers.length === filteredCustomers.length ? 'Зняти виділення' : 'Обрати всіх'}
                  </button>
                </div>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Пошук за ім'ям або email..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="border border-gray-200 rounded-lg h-48 overflow-y-auto p-2 space-y-1">
                  {filteredCustomers.map(c => (
                    <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCustomers([...selectedCustomers, c.id]);
                          else setSelectedCustomers(selectedCustomers.filter(id => id !== c.id));
                        }}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm truncate">{c.first_name} {c.last_name} ({c.email})</span>
                    </label>
                  ))}
                </div>
                <div className="text-sm text-gray-500 mt-1">{selectedCustomers.length} обрано</div>
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button
                onClick={() => { setIsCreateModalOpen(false); setEditingListId(null); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Скасувати
              </button>
              <button
                onClick={handleCreateOrUpdateList}
                disabled={!newListName}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                Зберегти список
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Campaign Modal */}
      {isSendModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Надіслати розсилку списку</h2>
              <button onClick={() => setIsSendModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тема</label>
                <input
                  type="text"
                  value={campaignSubject}
                  onChange={e => setCampaignSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="Тема розсилки"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тіло листа (підтримується HTML)</label>
                <MailToolbar areaKey="campaign" value={campaignBody} setValue={setCampaignBody} />
                <textarea
                  ref={el => { bodyRefs.current['campaign'] = el; }}
                  value={campaignBody}
                  onChange={e => setCampaignBody(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="Текст листа..."
                />
                <MailPreview body={campaignBody} />
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button
                onClick={() => setIsSendModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Скасувати
              </button>
              <button
                onClick={handleSendCampaign}
                disabled={!campaignSubject || !campaignBody}
                className="px-4 py-2 bg-red-600 text-white flex items-center gap-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Надіслати зараз
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

