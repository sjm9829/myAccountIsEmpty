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
  createdAt: string;
  _count: {
    accounts: number;
  };
}

export default function AdminDashboard() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'SECURITIES',
    contactNumber: '',
    websiteUrl: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  const institutionTypes = [
    { value: 'SECURITIES', label: '증권사' },
    { value: 'BANK', label: '은행' },
    { value: 'INSURANCE', label: '보험사' },
    { value: 'CRYPTO', label: '가상화폐 거래소' },
    { value: 'INVESTMENT', label: '투자회사/자산운용사' },
    { value: 'OTHER', label: '기타' },
  ];

  const fetchInstitutions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/institutions');
      if (response.ok) {
        const data = await response.json();
        setInstitutions(data.institutions);
      } else if (response.status === 403) {
        setError('관리자 권한이 필요합니다.');
        setTimeout(() => router.push('/'), 2000);
      } else {
        const data = await response.json();
        setError(data.error || '데이터를 불러오는 데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch institutions:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'SECURITIES',
      contactNumber: '',
      websiteUrl: '',
    });
    setEditingInstitution(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleEdit = (institution: Institution) => {
    setFormData({
      name: institution.name,
      type: institution.type,
      contactNumber: institution.contactNumber || '',
      websiteUrl: institution.websiteUrl || '',
    });
    setEditingInstitution(institution);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name || !formData.type) {
      setError('기관명과 유형은 필수입니다.');
      return;
    }

    try {
      const url = editingInstitution 
        ? `/api/admin/institutions/${editingInstitution.id}`
        : '/api/admin/institutions';
      
      const method = editingInstitution ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(editingInstitution ? '금융기관이 수정되었습니다.' : '금융기관이 등록되었습니다.');
        await fetchInstitutions();
        resetForm();
      } else {
        const data = await response.json();
        setError(data.error || '처리 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Institution operation error:', error);
      setError('서버 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (institutionId: string, institutionName: string) => {
    if (!confirm(`정말로 '${institutionName}'을(를) 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/institutions/${institutionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('금융기관이 삭제되었습니다.');
        await fetchInstitutions();
      } else {
        const data = await response.json();
        setError(data.error || '삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Institution deletion error:', error);
      setError('서버 오류가 발생했습니다.');
    }
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

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 페이지 헤더 */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">관리자 - 금융기관 관리</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                금융기관을 등록, 수정, 삭제할 수 있습니다.
              </p>
            </div>
            <button
              onClick={() => {
                if (showForm) {
                  resetForm();
                } else {
                  setShowForm(true);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {showForm ? '취소' : '금융기관 추가'}
            </button>
          </div>
        </div>

        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* 금융기관 등록/수정 폼 */}
          {showForm && (
            <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {editingInstitution ? '금융기관 수정' : '새 금융기관 등록'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      기관명 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="기관명을 입력하세요"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      기관 유형 *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {institutionTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      연락처
                    </label>
                    <input
                      type="text"
                      value={formData.contactNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="연락처를 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      웹사이트
                    </label>
                    <input
                      type="url"
                      value={formData.websiteUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {editingInstitution ? '수정' : '등록'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 금융기관 목록 */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">등록된 금융기관</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                총 {institutions.length}개 기관이 등록되어 있습니다.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      기관명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      유형
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      계좌 수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      연락처
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      등록일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {institutions.map((institution) => (
                    <tr key={institution.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {institution.name}
                        </div>
                        {institution.websiteUrl && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            <a
                              href={institution.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {institution.websiteUrl}
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {getInstitutionTypeLabel(institution.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {institution._count.accounts}개
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {institution.contactNumber || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(institution.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEdit(institution)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(institution.id, institution.name)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          disabled={institution._count.accounts > 0}
                          title={institution._count.accounts > 0 ? '연결된 계좌가 있어 삭제할 수 없습니다.' : ''}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {institutions.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">등록된 금융기관이 없습니다.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    위의 &apos;금융기관 추가&apos; 버튼을 클릭하여 첫 번째 기관을 등록해보세요.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
