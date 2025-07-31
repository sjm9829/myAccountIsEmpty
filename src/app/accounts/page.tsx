'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';

interface Institution {
  id: string;
  name: string;
  type: string;
  contactNumber?: string;
  websiteUrl?: string;
}

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  nickname?: string;
  createdAt: string;
  institution: Institution;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    institutionId: '',
    accountNumber: '',
    accountType: '일반계좌',
    nickname: '',
  });
  const [error, setError] = useState('');
  const router = useRouter();

  // 기관 유형 한글 변환
  const getInstitutionTypeLabel = (type: string) => {
    const typeLabels: { [key: string]: string } = {
      SECURITIES: '증권사',
      BANK: '은행',
      INSURANCE: '보험사',
      CRYPTO: '가상화폐 거래소',
      INVESTMENT: '투자회사/자산운용사',
      OTHER: '기타'
    };
    return typeLabels[type] || type;
  };

  // 기관 유형별 그룹화
  const groupedInstitutions = institutions.reduce((groups, institution) => {
    const type = institution.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(institution);
    return groups;
  }, {} as { [key: string]: Institution[] });

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  }, [router]);

  const fetchInstitutions = useCallback(async () => {
    try {
      const response = await fetch('/api/institutions');
      if (response.ok) {
        const data = await response.json();
        setInstitutions(data.institutions);
      }
    } catch (error) {
      console.error('Failed to fetch institutions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchAccounts();
      await fetchInstitutions();
    };
    loadData();
  }, [fetchAccounts, fetchInstitutions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.institutionId || !formData.accountNumber) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchAccounts();
        setShowForm(false);
        setFormData({
          institutionId: '',
          accountNumber: '',
          accountType: '일반계좌',
          nickname: '',
        });
      } else {
        const data = await response.json();
        setError(data.error || '계좌 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('Account creation error:', error);
      setError('서버 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('정말로 이 계좌를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchAccounts();
      } else {
        const data = await response.json();
        setError(data.error || '계좌 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Account deletion error:', error);
      setError('서버 오류가 발생했습니다.');
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      institutionId: account.institution.id,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      nickname: account.nickname || '',
    });
    setShowEditForm(true);
    setError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!editingAccount || !formData.institutionId || !formData.accountNumber) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchAccounts();
        setShowEditForm(false);
        setEditingAccount(null);
        setFormData({
          institutionId: '',
          accountNumber: '',
          accountType: '일반계좌',
          nickname: '',
        });
      } else {
        try {
          const data = await response.json();
          setError(data.error || '계좌 수정에 실패했습니다.');
        } catch (jsonError) {
          console.error('JSON parsing error:', jsonError);
          setError(`계좌 수정에 실패했습니다. (상태코드: ${response.status})`);
        }
      }
    } catch (error) {
      console.error('Account update error:', error);
      setError('서버 오류가 발생했습니다.');
    }
  };

  const cancelEdit = () => {
    setShowEditForm(false);
    setEditingAccount(null);
    setFormData({
      institutionId: '',
      accountNumber: '',
      accountType: '일반계좌',
      nickname: '',
    });
    setError('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 페이지 헤더 */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">계좌 관리</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                증권사별 계좌를 등록하고 관리하세요.
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {showForm ? '취소' : '계좌 추가'}
            </button>
          </div>
        </div>

        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* 계좌 등록 폼 */}
          {showForm && (
            <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">새 계좌 등록</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      금융기관
                    </label>
                    <select
                      value={formData.institutionId}
                      onChange={(e) => setFormData(prev => ({ ...prev, institutionId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">금융기관을 선택하세요</option>
                      {Object.entries(groupedInstitutions).map(([type, typeInstitutions]) => (
                        <optgroup key={type} label={getInstitutionTypeLabel(type)}>
                          {typeInstitutions.map((institution) => (
                            <option key={institution.id} value={institution.id}>
                              {institution.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      계좌번호
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="계좌번호를 입력하세요"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      계좌 별명
                    </label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="별명을 입력하세요 (선택사항)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      계좌유형
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="일반계좌">일반계좌</option>
                      <option value="ISA계좌">ISA계좌</option>
                      <option value="연금계좌">연금계좌</option>
                      <option value="CMA계좌">CMA계좌</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    계좌 등록
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 계좌 수정 폼 */}
          {showEditForm && editingAccount && (
            <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">계좌 정보 수정</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      금융기관
                    </label>
                    <select
                      value={formData.institutionId}
                      onChange={(e) => setFormData(prev => ({ ...prev, institutionId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">금융기관을 선택하세요</option>
                      {Object.entries(groupedInstitutions).map(([type, typeInstitutions]) => (
                        <optgroup key={type} label={getInstitutionTypeLabel(type)}>
                          {typeInstitutions.map((institution) => (
                            <option key={institution.id} value={institution.id}>
                              {institution.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      계좌번호
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="계좌번호를 입력하세요"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      계좌 별명
                    </label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="별명을 입력하세요 (선택사항)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      계좌유형
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="일반계좌">일반계좌</option>
                      <option value="ISA계좌">ISA계좌</option>
                      <option value="연금계좌">연금계좌</option>
                      <option value="CMA계좌">CMA계좌</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    수정 완료
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 계좌 목록 */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">등록된 계좌</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">등록된 계좌가 없습니다.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    위의 &apos;계좌 추가&apos; 버튼을 클릭하여 첫 번째 계좌를 등록해보세요.
                  </p>
                </div>
              ) : (
                accounts.map((account) => (
                  <div key={account.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {account.institution.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {account.nickname ? `${account.nickname} (${account.institution.name})` : account.institution.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {account.accountNumber} ({account.accountType})
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(account.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleEdit(account)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
