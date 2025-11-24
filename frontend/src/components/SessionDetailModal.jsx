import React from "react";
import { Modal, List, Tag, Descriptions, Divider, Typography } from "antd";

const { Title, Text, Paragraph } = Typography;

/**
 * SessionDetailModal
 * Props:
 *  - session: session object (required)
 *  - onClose: function to call to close modal
 *
 * Enhancements over original:
 *  - Candidate profile (name, email, phone, uploaded filename)
 *  - Prominent AI overall score & summary
 *  - Per-question display with: question, difficulty tag, candidate answer, AI score & feedback
 *  - Shows timestamps if available (falls back to session.createdAt)
 */
export default function SessionDetailModal({ session, onClose }) {
  if (!session) return null;

  const candidate = session.candidate || {};
  const ai = session.aiResult || {};
  const perAnswer = ai.perAnswer || []; // expected array of { index, score, feedback }

  // build map for ai feedback lookup by question index
  const aiMap = (perAnswer || []).reduce((acc, it) => {
    if (it && typeof it.index !== "undefined") acc[it.index] = it;
    return acc;
  }, {});

  // helper to format timestamp (supports numbers or ISO strings)
  const formatTimestamp = (ts) => {
    if (!ts) return "";
    const n = Number(ts);
    if (!Number.isFinite(n)) {
      try {
        return new Date(ts).toLocaleString();
      } catch {
        return String(ts);
      }
    }
    return new Date(n).toLocaleString();
  };

  return (
    <Modal
      title={
        <Title level={4} style={{ margin: 0 }}>
          {candidate.name
            ? `Session — ${candidate.name}`
            : `Session: ${session.id}`}
        </Title>
      }
      open={true}
      onCancel={onClose}
      footer={null}
      width={900}
      bodyStyle={{ maxHeight: "70vh", overflowY: "auto" }}
      centered
      destroyOnClose
    >
      {/* Candidate profile + basic metadata */}
      <Descriptions
        column={2}
        bordered
        size="small"
        style={{ marginBottom: 12 }}
      >
        <Descriptions.Item label="Name">
          {candidate.name || "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Email">
          {candidate.email || "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Phone">
          {candidate.phone || "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Uploaded file">
          {candidate.filename || "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Session ID">{session.id}</Descriptions.Item>
        <Descriptions.Item label="Created">
          {formatTimestamp(session.createdAt)}
        </Descriptions.Item>
      </Descriptions>

      {/* AI summary / overall score */}
      <div style={{ marginBottom: 12 }}>
        <Text strong>Final AI Summary & Score</Text>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700 }}>
            {ai.overall?.score ?? ai.score ?? "-"}
          </div>
          <div>
            <Paragraph style={{ margin: 0 }}>
              {ai.overall?.summary ?? ai.summary ?? "-"}
            </Paragraph>
          </div>
        </div>
      </div>

      <Divider />

      {/* Q&A list (question, difficulty, answer, ai feedback, timestamp) */}
      <List
        header={<div style={{ fontWeight: 600 }}>Q & A (chat history)</div>}
        dataSource={session.questions || []}
        renderItem={(q, i) => {
          const ansObj = session.answers?.[i] || {};
          const aiObj = aiMap[i] || null;
          const answeredAt =
            ansObj.submittedAt || ansObj.timestamp || session.createdAt;
          return (
            <List.Item key={i}>
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <Text strong>Q{i + 1}:</Text> <Text>{q.text}</Text>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Tag
                        color={
                          q.difficulty === "easy"
                            ? "green"
                            : q.difficulty === "medium"
                            ? "gold"
                            : "red"
                        }
                      >
                        {q.difficulty?.toUpperCase() || "N/A"}
                      </Tag>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {q.timeLimit ? `${q.timeLimit}s` : ""}
                      </Text>
                    </div>
                  </div>

                  <div style={{ minWidth: 180, textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Answered</div>
                    <div style={{ fontWeight: 700 }}>
                      {answeredAt ? formatTimestamp(answeredAt) : "-"}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        AI score
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {aiObj?.score ?? "-"}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Text strong>A:</Text>{" "}
                  {ansObj?.text ? (
                    <Text>{ansObj.text}</Text>
                  ) : (
                    <Text type="secondary">(Không có câu trả lời)</Text>
                  )}
                </div>

                <div style={{ marginTop: 8 }}>
                  <Text strong>AI feedback:</Text>{" "}
                  {aiObj?.feedback ? (
                    <Text>{aiObj.feedback}</Text>
                  ) : (
                    <Text type="secondary">Không có feedback</Text>
                  )}
                </div>
              </div>
            </List.Item>
          );
        }}
      />
    </Modal>
  );
}
