import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Space, Input, Tag } from 'antd';
import { listSessions, deleteSession, getSession } from '../api';
import SessionDetailModal from '../components/SessionDetailModal';

const { Search } = Input;

export default function DashboardPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await listSessions();
      const clean = Array.isArray(r.sessions) ? r.sessions : [];

      // dedupe by id (defensive)
      const unique = clean.filter((s, idx, arr) => s.id && arr.findIndex(x => x.id === s.id) === idx);

      // sort by AI overall score descending (fallback to ai.score or 0)
      const sortedByScore = unique.slice().sort((a, b) => {
        const sa = a.aiResult?.overall?.score ?? a.aiResult?.score ?? 0;
        const sb = b.aiResult?.overall?.score ?? b.aiResult?.score ?? 0;
        return sb - sa;
      });

      setSessions(sortedByScore);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    await deleteSession(id);
    await load();
  }

  async function openDetail(id) {
    const r = await getSession(id);
    if (r.ok) setSelected(r.session);
  }

  // Immutable filtered array (search)
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(s =>
      (s.candidate?.name || '').toLowerCase().includes(q) ||
      (s.candidate?.email || '').toLowerCase().includes(q) ||
      (s.candidate?.phone || '').toLowerCase().includes(q) ||
      (s.aiResult?.overall?.summary || '').toLowerCase().includes(q)
    );
  }, [sessions, searchText]);

  const columns = [
    {
      title: 'Name',
      dataIndex: ['candidate', 'name'],
      key: 'name',
      sorter: (a, b) => (a.candidate?.name || '').localeCompare(b.candidate?.name || ''),
      render: (name, row) => (
        <Button type="link" onClick={() => openDetail(row.id)}>
          {name || <i style={{ color: '#888' }}>N/A</i>}
        </Button>
      ),
    },

    {
      title: 'Email',
      dataIndex: ['candidate', 'email'],
      key: 'email',
      ellipsis: true,
      responsive: ['sm', 'md', 'lg', 'xl'],
      render: email => email ? <a href={`mailto:${email}`}>{email}</a> : <i style={{ color: '#888' }}>N/A</i>,
    },

    {
      title: 'Phone',
      dataIndex: ['candidate', 'phone'],
      key: 'phone',
      ellipsis: true,
      responsive: ['md', 'lg', 'xl'],
      render: phone => phone || <i style={{ color: '#888' }}>N/A</i>,
    },

    {
      title: 'Score',
      dataIndex: ['aiResult', 'overall', 'score'],
      key: 'score',
      sorter: (a, b) => (a.aiResult?.overall?.score ?? 0) - (b.aiResult?.overall?.score ?? 0),
      defaultSortOrder: 'descend',
      render: (_, row) => {
        const score = row.aiResult?.overall?.score ?? (row.aiResult?.score ?? '-');
        if (score === '-') return '-';
        const color = score >= 70 ? 'green' : score >= 40 ? 'gold' : 'red';
        return <Tag color={color}>{score}</Tag>;
      },
    },

    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'date',
      responsive: ['sm', 'md', 'lg', 'xl'],
      sorter: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
      render: v => v ? new Date(v).toLocaleString() : '',
    },

    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => openDetail(row.id)}>View</Button>
          <Button danger size="small" onClick={() => handleDelete(row.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="dashboard-wrap">

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
        <Search
          placeholder="Search by name, email, phone, or summary"
          allowClear
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 'min(760px, 92%)' }}
        />
      </div>

      <Table
        rowKey={record => record.id || record.createdAt}
        loading={loading}
        dataSource={[...filtered]}         // clone to avoid AntD in-place mutation issues
        columns={columns}
        pagination={{
          pageSize: 6,
          showSizeChanger: false,
          position: ['bottomCenter'],
        }}
        // allow horizontal scroll on very small screens; otherwise table fits container
        scroll={{ x: 'max-content' }}
      />

      <SessionDetailModal session={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
