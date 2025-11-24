import React, { useState } from 'react';
import { Card, Upload, Button, Form, Input, Alert, Typography, Space } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { uploadResume } from '../api';

const { Dragger } = Upload;
const { Title, Text } = Typography;

export default function ResumeUploader({ onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState(null);

  const beforeUpload = (file) => {
    const allowed = ['pdf', 'docx', 'doc'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext)) {
      setError('Unsupported file type. Please upload PDF or DOCX.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Max size 5MB.');
      return Upload.LIST_IGNORE;
    }
    setError(null);
    return true;
  };

  const handleUpload = async (file) => {
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const data = await uploadResume(fd);
      if (!data.ok) {
        setError(data.error || 'Failed to parse resume.');
      } else {
        setParsed({
          name: data.parsed.name || '',
          email: data.parsed.email || '',
          phone: data.parsed.phone || ''
        });
        setFileName(file.name);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to parse resume. Try another file.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!parsed) return;
    if (!parsed.name || !parsed.email || !parsed.phone) {
      setError('Please provide Name, Email, and Phone before continuing.');
      return;
    }
    setError(null);
    if (onConfirm) onConfirm(parsed);
  };

  return (
    <Card  title={<Title level={4} style={{ margin: 0, textAlign:"center" }}>UPLOAD RESUME (PDF / DOCX)</Title>}>
      

      <Dragger
        multiple={false}
        beforeUpload={beforeUpload}
        customRequest={({ file, onSuccess }) => { setTimeout(() => onSuccess('ok'), 0); handleUpload(file); }}
        showUploadList={false}
        disabled={loading}
        style={{ marginBottom: 12 }}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Drag & drop a file here or click to select.</p>
        <p className="ant-upload-hint">Accepted: PDF, DOCX. Max size 5MB.</p>
      </Dragger>

      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}

      {!parsed && (<div style={{ marginTop: 8 }}><Text type="secondary">No resume parsed yet.</Text></div>)}

      {parsed && (
        <>
          <Form layout="vertical" initialValues={parsed} onValuesChange={(changed, all) => setParsed(all)}>
            <Form.Item label="Uploaded file"><Text strong>{fileName}</Text></Form.Item>
            <Form.Item label="Name" name="name" rules={[{ required: true }]}><Input value={parsed.name} onChange={(e) => setParsed(p => ({ ...p, name: e.target.value }))} /></Form.Item>
            <Form.Item label="Email" name="email" rules={[{ type: 'email', required: true }]}><Input value={parsed.email} onChange={(e) => setParsed(p => ({ ...p, email: e.target.value }))} /></Form.Item>
            <Form.Item label="Phone" name="phone" rules={[{ required: true }]}><Input value={parsed.phone} onChange={(e) => setParsed(p => ({ ...p, phone: e.target.value }))} /></Form.Item>
          </Form>

          <Space style={{ marginTop: 8 }}>
            <Button type="primary" onClick={handleConfirm} loading={loading}>Confirm & Continue</Button>
            <Button onClick={() => { setParsed(null); setFileName(null); }}>Upload another</Button>
          </Space>
        </>
      )}
    </Card>
  );
}
